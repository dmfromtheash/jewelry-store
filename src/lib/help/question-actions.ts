'use server'

/**
 * AURELIA — Help question server action (Этап 79A) — NO real email
 *
 * Accepts a general "Поставити запитання" Help submission and stores it as `new` for admin
 * triage. It is NEVER public until an admin answers + publishes it (anonymised). Safety:
 *   - honeypot: a filled `website` field silently succeeds without storing anything;
 *   - all fields validated + HTML-stripped server-side (./question-validate);
 *   - a durable throttle (51A limiter) slows spam — keyed by the verified customer when
 *     logged in, else a coarse hashed client IP; no raw IP/email is ever stored by the limiter;
 *   - the reply email is stored ONLY with explicit consent; `emailHash` (sha256) is stored for
 *     dedupe/abuse; the order/product refs are loose triage hints (no ownership is implied);
 *   - the success message is GENERIC and identical in every case (no enumeration). NO email
 *     is sent and NO outbox row is created for a Help question (answering is manual).
 */

import { headers } from 'next/headers'
import { prisma } from '../db/prisma'
import { getCurrentCustomer } from '../customer/session'
import { isThrottled, registerAttempt, type ThrottleRule } from '../customer/rate-limit'
import { hashEmail } from '../support/email-utils'
import { validateHelpQuestion, hasHelpQuestionErrors } from './question-validate'
import type { HelpQuestionInput, HelpQuestionResult } from './question-types'

const SERVER_ERROR = 'Не вдалося надіслати запитання. Спробуйте ще раз.'
const THROTTLED = 'Забагато запитів. Зачекайте трохи й спробуйте знову.'

/** Max 5 Help questions per 15 min per identity (spam guard, not security). */
const HELP_THROTTLE: ThrottleRule = { windowMs: 15 * 60 * 1000, max: 5 }

async function throttleKey(customerId: string | null): Promise<string> {
  if (customerId) return `help-question:cust:${customerId}`
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `help-question:${ip}`
}

export async function submitHelpQuestion(input: HelpQuestionInput): Promise<HelpQuestionResult> {
  // Honeypot: a real user never fills the hidden field. Pretend success (don't tip off bots).
  if ((input.website ?? '').trim()) return { ok: true }

  let customerId: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
  } catch {
    customerId = null
  }

  const key = await throttleKey(customerId)
  if (await isThrottled(key, HELP_THROTTLE)) return { ok: false, error: THROTTLED }

  const { errors, value } = validateHelpQuestion(input)
  if (!value || hasHelpQuestionErrors(errors)) {
    await registerAttempt(key, HELP_THROTTLE)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  try {
    await prisma.helpQuestion.create({
      data: {
        categorySlug: value.categorySlug,
        customerId,
        authorName: value.authorName,
        recipientEmail: value.email, // stored only when consent was given (validate enforces this)
        emailHash: value.email ? hashEmail(value.email) : null,
        subject: value.subject,
        message: value.message,
        productRef: value.productRef,
        orderRef: value.orderRef,
        consentAt: value.consentGiven ? new Date() : null,
        status: 'new', // ALWAYS new — never public until an admin answers + publishes.
      },
    })
    await registerAttempt(key, HELP_THROTTLE)
    return { ok: true }
  } catch (e) {
    console.error('submitHelpQuestion failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
