/**
 * AURELIA — Order draft types (Этап 16A)
 *
 * Shared, serializable types for the guest checkout draft flow. Safe to import
 * from both client (checkout form) and server (action) — no Prisma here.
 */

/** Cart line the client submits — ONLY slug + qty. Price/name come from the DB. */
export interface OrderDraftItemInput {
  slug: string
  qty: number
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
  paymentMethod: string
  items: OrderDraftItemInput[]
}

/** Max length for the optional free-text delivery note. */
export const DELIVERY_DETAILS_MAX = 200

/** Per-field validation messages, keyed by form field name. */
export type OrderFieldErrors = Partial<
  Record<
    | 'customerName'
    | 'customerPhone'
    | 'customerEmail'
    | 'deliveryCity'
    | 'deliveryMethod'
    | 'deliveryDetails'
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
