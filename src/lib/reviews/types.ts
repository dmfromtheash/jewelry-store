/**
 * AURELIA — Review types (Этап 59A)
 *
 * Shared, serializable types for the moderated product-review foundation. Safe to
 * import from client and server alike (no Prisma here). The DB model is
 * `ProductReview` (see prisma/schema.prisma).
 */

/** Public-facing review (already moderated/approved) shown on the PDP. */
export interface PublicReview {
  id: string
  authorName: string
  rating: number
  body: string
  /** ISO date string — serializable for client components. */
  createdAt: string
  /** True for seeded/sample reviews so the UI can label them honestly. */
  isDemo: boolean
}

/** Aggregate rating summary, computed from APPROVED reviews only. */
export interface ReviewSummary {
  /** Average rating rounded to one decimal; 0 when there are no approved reviews. */
  average: number
  /** Count of approved reviews. */
  count: number
}

/** What the storefront review form submits. */
export interface ReviewSubmitInput {
  productSlug: string
  rating: number
  /** Optional for logged-in customers (falls back to the profile/display name). */
  authorName?: string
  body: string
}

/** Per-field validation messages for the review form. */
export type ReviewFieldErrors = Partial<
  Record<'rating' | 'authorName' | 'body', string>
>

/** Typed result returned by the submit action. */
export type ReviewSubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: ReviewFieldErrors }

export const RATING_MIN = 1
export const RATING_MAX = 5
export const REVIEW_AUTHOR_MIN = 2
export const REVIEW_AUTHOR_MAX = 80
export const REVIEW_BODY_MIN = 4
export const REVIEW_BODY_MAX = 1000
