'use server'

/**
 * AURELIA — Product question submission action (Этап 79A) — NO real email
 *
 * Accepts a product question and stores it as `pending` for admin moderation — it NEVER
 * becomes publicly visible without an explicit admin answer + publish. Safety mirrors the
 * review action:
 *   - honeypot: a filled `website` field silently succeeds without storing anything;
 *   - all fields validated + HTML-stripped server-side (./validate);
 *   - the product must exist AND be published; the slug is the ONLY product reference trusted
 *     from the client;
 *   - the author is linked to the VERIFIED customer session when logged in (never from the
 *     payload); guests may submit but must supply a display name;
 *   - the reply email is stored ONLY with consent; `emailHash` (sha256) is stored for dedupe;
 *   - a durable throttle (51A limiter) slows spam (hashed key — no raw IP/email stored).
 * No email/notification is sent.
 */

import { headers } from 'next/headers'
import { prisma } from '../db/prisma'
import { getCurrentCustomer } from '../customer/session'
import { isThrottled, registerAttempt, type ThrottleRule } from '../customer/rate-limit'
import { hashEmail } from '../support/email-utils'
import { validateProductQuestion, hasProductQuestionErrors } from './validate'
import type { ProductQuestionInput, ProductQuestionResult } from './types'

const SERVER_ERROR = 'Не вдалося надіслати запитання. Спробуйте ще раз.'
const THROTTLED = 'Забагато запитів. Зачекайте трохи й спробуйте знову.'
const PRODUCT_ERROR = 'Товар недоступний для запитань.'

/** Max 5 questions per 15 min per identity (spam guard, not security). */
const PQ_THROTTLE: ThrottleRule = { windowMs: 15 * 60 * 1000, max: 5 }

async function throttleKey(customerId: string | null): Promise<string> {
  if (customerId) return `product-question:cust:${customerId}`
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `product-question:${ip}`
}

export async function submitProductQuestion(
  input: ProductQuestionInput,
): Promise<ProductQuestionResult> {
  if ((input.website ?? '').trim()) return { ok: true } // honeypot

  let customerId: string | null = null
  let customerName: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
    customerName = customer?.name ?? null
  } catch {
    customerId = null
  }

  const key = await throttleKey(customerId)
  if (await isThrottled(key, PQ_THROTTLE)) return { ok: false, error: THROTTLED }

  const { errors, value } = validateProductQuestion(input, customerName)
  if (!value || hasProductQuestionErrors(errors)) {
    await registerAttempt(key, PQ_THROTTLE)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  const slug = (input.productSlug ?? '').trim()
  if (!slug) return { ok: false, error: PRODUCT_ERROR }

  try {
    const product = await prisma.product.findFirst({
      where: { slug, isPublished: true },
      select: { id: true },
    })
    if (!product) return { ok: false, error: PRODUCT_ERROR }

    await prisma.productQuestion.create({
      data: {
        productId: product.id,
        customerId,
        authorName: value.authorName,
        recipientEmail: value.email,
        emailHash: value.email ? hashEmail(value.email) : null,
        body: value.body,
        consentAt: value.consentGiven ? new Date() : null,
        status: 'pending', // ALWAYS pending — invisible until an admin answers + publishes.
      },
    })
    await registerAttempt(key, PQ_THROTTLE)
    return { ok: true }
  } catch (e) {
    console.error('submitProductQuestion failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
