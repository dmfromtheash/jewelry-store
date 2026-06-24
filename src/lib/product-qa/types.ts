/**
 * AURELIA — Product Q&A types (Этап 79A)
 *
 * Shared, serializable types for the product-level pre-sale Q&A. DISTINCT from reviews:
 * a question has no rating. Safe to import from client + server (no Prisma). The DB model
 * is `ProductQuestion`.
 */

export const PQ_BODY_MIN = 6
export const PQ_BODY_MAX = 1000
export const PQ_NAME_MIN = 2
export const PQ_NAME_MAX = 80

/** A published, answered question shown on the public PDP. */
export interface PublicProductQuestion {
  id: string
  authorName: string
  body: string
  answer: string
  /** ISO date string — serializable for client components. */
  createdAt: string
  answeredAt: string | null
  isDemo: boolean
}

/** What the product question form submits. */
export interface ProductQuestionInput {
  productSlug: string
  body: string
  /** Optional for logged-in customers (falls back to the profile/display name). */
  authorName?: string
  /** Optional reply email; if present, consent must be accepted. */
  email?: string
  consent?: boolean
  /** Honeypot — must stay empty. */
  website?: string
}

export type ProductQuestionFieldErrors = Partial<
  Record<'body' | 'authorName' | 'email' | 'consent', string>
>

export type ProductQuestionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: ProductQuestionFieldErrors }
