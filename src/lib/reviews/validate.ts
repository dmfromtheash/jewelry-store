/**
 * AURELIA — Review validation (Этап 59A)
 *
 * Pure, dependency-free validation + normalisation for review submissions. This is
 * the AUTHORITATIVE check the server action runs; the client form reuses it for
 * instant UX feedback (no duplicated rules). No Prisma, no cookies.
 *
 * Rules are conservative: an integer 1–5 rating, a length-capped public name and
 * body, and a hard reject of any HTML/script/`javascript:`/`data:` payload — the
 * same unsafe-markup predicate the customer/site-settings writers use, so a review
 * can never carry raw markup into storage or render.
 */

import { hasUnsafeMarkup } from '../customer/validate'
import {
  RATING_MIN,
  RATING_MAX,
  REVIEW_AUTHOR_MIN,
  REVIEW_AUTHOR_MAX,
  REVIEW_BODY_MIN,
  REVIEW_BODY_MAX,
  type ReviewFieldErrors,
  type ReviewSubmitInput,
} from './types'

export { hasUnsafeMarkup }

export interface NormalizedReview {
  rating: number
  authorName: string
  body: string
}

export interface ReviewValidationResult {
  errors: ReviewFieldErrors
  /** Present only when `errors` is empty. */
  value?: NormalizedReview
}

/**
 * Validates + normalises a review.
 *
 * `fallbackAuthorName` (the logged-in customer's display name) is used when the
 * payload omits an explicit author name — so a logged-in customer need not retype
 * their name, while a guest must supply one.
 */
export function validateReviewInput(
  input: ReviewSubmitInput,
  fallbackAuthorName?: string | null,
): ReviewValidationResult {
  const errors: ReviewFieldErrors = {}

  // Rating: an INTEGER within [1,5]. Reject NaN / fractional / out-of-range.
  const rating = Number(input.rating)
  if (!Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    errors.rating = `Оцінка має бути цілим числом від ${RATING_MIN} до ${RATING_MAX}.`
  }

  // Author name: explicit input wins, else the logged-in profile name.
  const rawName = (input.authorName ?? '').trim() || (fallbackAuthorName ?? '').trim()
  if (rawName.length < REVIEW_AUTHOR_MIN) {
    errors.authorName = 'Вкажіть імʼя (мінімум 2 символи).'
  } else if (rawName.length > REVIEW_AUTHOR_MAX) {
    errors.authorName = 'Імʼя задовге.'
  } else if (hasUnsafeMarkup(rawName)) {
    errors.authorName = 'Імʼя містить недопустимі символи.'
  }

  const body = (input.body ?? '').trim()
  if (body.length < REVIEW_BODY_MIN) {
    errors.body = 'Відгук закороткий.'
  } else if (body.length > REVIEW_BODY_MAX) {
    errors.body = 'Відгук задовгий.'
  } else if (hasUnsafeMarkup(body)) {
    errors.body = 'Відгук містить недопустимі символи.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { rating, authorName: rawName, body } }
}

export function hasReviewErrors(errors: ReviewFieldErrors): boolean {
  return Object.keys(errors).length > 0
}

/** Computes the average (1-decimal) + count for a set of approved ratings. */
export function summarizeRatings(ratings: number[]): { average: number; count: number } {
  const count = ratings.length
  if (count === 0) return { average: 0, count: 0 }
  const sum = ratings.reduce((n, r) => n + r, 0)
  return { average: Math.round((sum / count) * 10) / 10, count }
}
