'use server'

/**
 * AURELIA — Availability-interest submission action (Этап 79A) — NO real email, NO reservation
 *
 * Records a guest/customer's back-in-stock interest in a product (and optional variant). It
 * ONLY stores the request — NOTHING is emailed, NO notification fires, and NO stock is reserved
 * or held. Safety:
 *   - honeypot: a filled `website` field silently succeeds without storing anything;
 *   - validation requires a valid email + explicit consent (./validate);
 *   - the product is resolved by slug → a published product server-side; dedupe is by emailHash;
 *   - a durable throttle (51A limiter) slows spam (hashed key — no raw IP/email stored);
 *   - the optional customer link comes from the VERIFIED session only;
 *   - the success copy is honest (no message will actually be delivered).
 */

import { headers } from 'next/headers'
import { getCurrentCustomer } from '../customer/session'
import { isThrottled, registerAttempt, type ThrottleRule } from '../customer/rate-limit'
import { recordAvailabilityInterest } from './repo'
import { validateAvailabilityInterest, hasAvailabilityInterestErrors } from './validate'
import { AVAIL_SOURCE_PDP, type AvailabilityInterestInput, type AvailabilityInterestResult } from './types'

const SERVER_ERROR = 'Не вдалося зберегти запит. Спробуйте ще раз.'
const THROTTLED = 'Забагато запитів. Зачекайте трохи й спробуйте знову.'
const PRODUCT_ERROR = 'Товар недоступний для відстеження наявності.'

/** Max 10 availability submissions per 15 min per identity (spam guard, not security). */
const AVAIL_THROTTLE: ThrottleRule = { windowMs: 15 * 60 * 1000, max: 10 }

async function throttleKey(customerId: string | null): Promise<string> {
  if (customerId) return `availability:cust:${customerId}`
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `availability:${ip}`
}

export async function submitAvailabilityInterest(
  input: AvailabilityInterestInput,
): Promise<AvailabilityInterestResult> {
  if ((input.website ?? '').trim()) return { ok: true, deduped: false } // honeypot

  let customerId: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
  } catch {
    customerId = null
  }

  const key = await throttleKey(customerId)
  if (await isThrottled(key, AVAIL_THROTTLE)) return { ok: false, error: THROTTLED }

  const { errors, value } = validateAvailabilityInterest(input)
  if (!value || hasAvailabilityInterestErrors(errors)) {
    await registerAttempt(key, AVAIL_THROTTLE)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  const slug = (input.productSlug ?? '').trim()
  if (!slug) return { ok: false, error: PRODUCT_ERROR }

  try {
    const outcome = await recordAvailabilityInterest({
      slug,
      email: value.email,
      variantId: input.variantId ?? null,
      customerId,
      source: AVAIL_SOURCE_PDP,
    })
    await registerAttempt(key, AVAIL_THROTTLE)
    if (!outcome.ok) return { ok: false, error: PRODUCT_ERROR }
    return { ok: true, deduped: outcome.deduped }
  } catch (e) {
    console.error('submitAvailabilityInterest failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
