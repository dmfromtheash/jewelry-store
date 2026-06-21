/**
 * AURELIA — Order draft types (Этап 16A)
 *
 * Shared, serializable types for the guest checkout draft flow. Safe to import
 * from both client (checkout form) and server (action) — no Prisma here.
 */

/**
 * Cart line the client submits — slug + qty, and an OPTIONAL `variantId`
 * (Этап 30B). Price/name/variant snapshot all come from the DB. A line without
 * `variantId` for a product that has variants falls back to the product's
 * default variant server-side (§6 backward compatibility); a no-variant product
 * ignores it entirely.
 */
export interface OrderDraftItemInput {
  slug: string
  qty: number
  variantId?: string
}

/** Customer + cart payload posted from the checkout form. */
export interface OrderDraftInput {
  customerName: string
  customerPhone: string
  customerEmail?: string
  deliveryCity: string
  deliveryMethod: string
  /** Optional free-text delivery note (отделение/адрес/комментарий). */
  deliveryDetails?: string
  /** Optional manual branch/department/warehouse text (Этап 59A). No carrier API. */
  deliveryBranch?: string
  /** Optional separate delivery comment (Этап 59A). */
  deliveryComment?: string
  paymentMethod: string
  items: OrderDraftItemInput[]
}

/** Max length for the optional free-text delivery note. */
export const DELIVERY_DETAILS_MAX = 200
/** Max length for the manual branch/department text (Этап 59A). */
export const DELIVERY_BRANCH_MAX = 120
/** Max length for the optional delivery comment (Этап 59A). */
export const DELIVERY_COMMENT_MAX = 300

/** Per-field validation messages, keyed by form field name. */
export type OrderFieldErrors = Partial<
  Record<
    | 'customerName'
    | 'customerPhone'
    | 'customerEmail'
    | 'deliveryCity'
    | 'deliveryMethod'
    | 'deliveryDetails'
    | 'deliveryBranch'
    | 'deliveryComment'
    | 'paymentMethod'
    | 'items',
    string
  >
>

/** Typed result returned by the server action. */
export type OrderDraftResult =
  | { ok: true; orderCode: string }
  | { ok: false; error: string; fieldErrors?: OrderFieldErrors }

export const QTY_MIN = 1
export const QTY_MAX = 99
