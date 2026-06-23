/**
 * AURELIA — Inventory stock-movement helpers (Этап 70A)
 *
 * Pure + dependency-light (only a TYPE import from Prisma, erased at runtime — like
 * transitions.ts), so the SAME movement-row shape is built by the server-only order/admin actions
 * AND asserted by the verify script (under tsx). Centralising `buildMovementInput` keeps the real
 * write paths and the verify's mirror from drifting apart.
 *
 * A movement row is an append-only AUDIT fact about a change to an existing `stockQuantity` field.
 * It NEVER carries a secret, token, cookie, request body, or customer PII (see schema doc).
 */

import type { StockMovementReason } from '@prisma/client'

/** Russian labels for the admin movements feed (admin UI is RU; storefront is UA). */
export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  order_created: 'Заказ оформлен (списание)',
  order_cancelled_restock: 'Отмена заказа (возврат)',
  manual_adjustment: 'Ручная корректировка',
  admin_correction: 'Корректировка администратора',
}

/** Inventory level a movement applies to (mirrors OrderItem.stockSource semantics). */
export type MovementLevel = 'product' | 'variant'

/** The exact, persistable shape of one InventoryStockMovement row (no Prisma client needed). */
export interface MovementInput {
  productId: string | null
  variantId: string | null
  level: MovementLevel
  delta: number
  quantityBefore: number | null
  quantityAfter: number | null
  reason: StockMovementReason
  orderCode: string | null
  actorLabel: string | null
  note: string | null
}

/**
 * Builds a normalised movement-input row. Defensive: quantities default to null, the level is
 * carried verbatim, and string fields default to null so a caller can omit them. The caller is
 * responsible for passing a non-zero `delta` (a zero-delta movement is never recorded).
 */
export function buildMovementInput(args: {
  level: MovementLevel
  delta: number
  reason: StockMovementReason
  productId?: string | null
  variantId?: string | null
  quantityBefore?: number | null
  quantityAfter?: number | null
  orderCode?: string | null
  actorLabel?: string | null
  note?: string | null
}): MovementInput {
  return {
    productId: args.productId ?? null,
    variantId: args.variantId ?? null,
    level: args.level,
    delta: args.delta,
    quantityBefore: args.quantityBefore ?? null,
    quantityAfter: args.quantityAfter ?? null,
    reason: args.reason,
    orderCode: args.orderCode ?? null,
    actorLabel: args.actorLabel ?? null,
    note: args.note ?? null,
  }
}
