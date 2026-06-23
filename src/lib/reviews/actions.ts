'use server'

/**
 * AURELIA — Review submission server action (Этап 59A)
 *
 * Accepts a storefront review and stores it as `pending` for admin moderation —
 * it NEVER becomes publicly visible without an explicit admin approval. Safety:
 *   - all fields validated + HTML-stripped server-side (src/lib/reviews/validate.ts);
 *   - the product must exist AND be published (a review can't target a hidden/unknown
 *     product); the slug is the ONLY product reference trusted from the client;
 *   - the author is linked to the VERIFIED customer session when logged in (never
 *     trusted from the payload); guests may submit but must supply a display name;
 *   - a light durable throttle (reusing the 51A limiter) slows review spam — keyed by
 *     customer id when logged in, else a coarse client IP. No PII is stored by the
 *     limiter (the key is hashed).
 * No email/notification is sent. Nothing about who-can-review is leaked.
 */

import { headers } from 'next/headers'
import { prisma } from '../db/prisma'
import { getCurrentCustomer } from '../customer/session'
import { isThrottled, registerAttempt, type ThrottleRule } from '../customer/rate-limit'
import { recordReviewSubmitted } from '../analytics/record'
import { validateReviewInput, hasReviewErrors } from './validate'
import type { ReviewSubmitInput, ReviewSubmitResult } from './types'

const THROTTLED_ERROR = 'Забагато відгуків. Зачекайте трохи й спробуйте знову.'
const SERVER_ERROR = 'Не вдалося надіслати відгук. Спробуйте ще раз.'
const PRODUCT_ERROR = 'Товар недоступний для відгуку.'

/** Max 5 submitted reviews per 15 min per identity (spam guard, not security). */
const REVIEW_THROTTLE: ThrottleRule = { windowMs: 15 * 60 * 1000, max: 5 }

async function reviewThrottleKey(customerId: string | null): Promise<string> {
  if (customerId) return `review:cust:${customerId}`
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `review:${ip}`
}

export async function submitProductReview(input: ReviewSubmitInput): Promise<ReviewSubmitResult> {
  // Optional customer link from the VERIFIED session (never the client payload).
  let customerId: string | null = null
  let customerName: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
    customerName = customer?.name ?? null
  } catch {
    customerId = null
  }

  const key = await reviewThrottleKey(customerId)
  if (await isThrottled(key, REVIEW_THROTTLE)) {
    return { ok: false, error: THROTTLED_ERROR }
  }

  const { errors, value } = validateReviewInput(input, customerName)
  if (!value || hasReviewErrors(errors)) {
    await registerAttempt(key, REVIEW_THROTTLE)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  const slug = (input.productSlug ?? '').trim()
  if (!slug) return { ok: false, error: PRODUCT_ERROR }

  try {
    // Product must exist AND be published — never review a hidden/unknown product.
    const product = await prisma.product.findFirst({
      where: { slug, isPublished: true },
      select: { id: true },
    })
    if (!product) return { ok: false, error: PRODUCT_ERROR }

    await prisma.productReview.create({
      data: {
        productId: product.id,
        customerId,
        authorName: value.authorName,
        rating: value.rating,
        body: value.body,
        status: 'pending', // ALWAYS pending — invisible until an admin approves it.
      },
    })

    // Anonymous analytics count (best-effort) — productId + rating only, no author/body.
    await recordReviewSubmitted({ productId: product.id, rating: value.rating })

    await registerAttempt(key, REVIEW_THROTTLE)
    return { ok: true }
  } catch (e) {
    console.error('submitProductReview failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
