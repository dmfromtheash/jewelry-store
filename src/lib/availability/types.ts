/**
 * AURELIA — Availability-interest types (Этап 79A)
 *
 * Shared, serializable types for the back-in-stock "Повідомити про наявність" flow. Safe to
 * import from client + server (no Prisma). The DB model is `ProductAvailabilityInterest`.
 * NO reservation/hold is implied anywhere here.
 */

export const AVAIL_SOURCE_PDP = 'pdp'

/** What the availability-notify form submits. */
export interface AvailabilityInterestInput {
  productSlug: string
  /** Optional variant id (must belong to the product, else treated as product-level). */
  variantId?: string
  email: string
  /** Must be true — contact consent is required to store the email. */
  consent?: boolean
  /** Honeypot — must stay empty. */
  website?: string
}

export type AvailabilityInterestFieldErrors = Partial<Record<'email' | 'consent', string>>

export type AvailabilityInterestResult =
  | { ok: true; deduped: boolean }
  | { ok: false; error: string; fieldErrors?: AvailabilityInterestFieldErrors }
