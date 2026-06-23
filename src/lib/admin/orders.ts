/**
 * AURELIA — Admin order data layer (Этап 17A)
 *
 * Server-only Prisma reads/updates for the local admin order screens. No raw
 * SQL, no deletes — orders are only listed, read, and have their `status`
 * changed. PII (customer name/phone/email) is selected only for the detail read,
 * which is rendered behind the local admin guard.
 */

import 'server-only'

import { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { buildMovementInput } from '../inventory/movements'

export const ORDER_STATUSES = Object.values(OrderStatus) as OrderStatus[]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Черновик',
  submitted: 'Оформлен',
  processing: 'В обработке',
  completed: 'Выполнен',
  cancelled: 'Отменён',
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value)
}

/**
 * Этап 27D — "needs attention" inbox status. Every storefront order is created
 * as `submitted` (see createOrderDraft), so that is the status the owner must
 * still act on. An order leaves the inbox as soon as its status changes (today
 * the only move from `submitted` is → `cancelled`; a dedicated "fulfilled"
 * status is a future lifecycle stage — see docs/ORDER_LIFECYCLE_SPEC.md §5).
 * No schema/enum change: this is purely a read over the existing status.
 */
export const NEEDS_ATTENTION_STATUS: OrderStatus = OrderStatus.submitted

/** Count of orders still awaiting owner action (status = submitted). */
export async function getNeedsAttentionOrderCount(): Promise<number> {
  return prisma.order.count({ where: { status: NEEDS_ATTENTION_STATUS } })
}

export interface AdminOrdersQuery {
  status?: string
  query?: string
}

export async function getAdminOrders(opts: AdminOrdersQuery = {}) {
  const where: Prisma.OrderWhereInput = {}

  if (opts.status && isOrderStatus(opts.status)) {
    where.status = opts.status
  }

  const q = opts.query?.trim()
  if (q) {
    where.OR = [
      { orderCode: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q, mode: 'insensitive' } },
    ]
  }

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      orderCode: true,
      status: true,
      customerName: true,
      deliveryCity: true,
      deliveryMethod: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  })
}

export async function getAdminOrderByCode(orderCode: string) {
  if (!orderCode) return null
  return prisma.order.findUnique({
    where: { orderCode },
    select: {
      orderCode: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      deliveryCity: true,
      deliveryMethod: true,
      deliveryDetails: true,
      deliveryBranch: true,
      deliveryComment: true,
      paymentMethod: true,
      subtotalAmount: true,
      // Promo/discount snapshot (Этап 63A). 0 / null on every pre-63A order.
      discountMinor: true,
      promoCode: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          productName: true,
          productSlug: true,
          productSku: true,
          // Variant snapshot (Этап 30B/30D) so the admin fulfils the exact pick.
          variantName: true,
          variantValue: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

/** Reads just the current status (for audit transition logging). No PII. */
export async function getAdminOrderStatus(orderCode: string): Promise<OrderStatus | null> {
  if (!orderCode) return null
  const row = await prisma.order.findUnique({
    where: { orderCode },
    select: { status: true },
  })
  return row?.status ?? null
}

/**
 * Updates ONLY the status. Never touches items, prices, or contact data.
 *
 * Этап 28C — restock on cancel: moving an order INTO `cancelled` returns its
 * reserved stock. Этап 30B makes this variant-aware: each line is restocked at
 * the SAME level it was decremented, read from the line's `stockSource` snapshot:
 *   - `stockSource === 'variant'` → re-increment ProductVariant.stockQuantity
 *     (by `variantId`); a deleted variant matches 0 rows → safe no-op (the stock
 *     is simply gone, like a deleted product today);
 *   - `stockSource === 'product'` OR legacy `null` (pre-30B orders that only ever
 *     decremented product stock) → re-increment Product.stockQuantity (28C).
 * Both paths keep the `stockQuantity: { not: null }` guard so an untracked (null)
 * level is never resurrected to a number, and deleted-product lines
 * (`productId == null`) are left untouched. The flip + restock run in ONE
 * transaction, and the `status: { not: cancelled }` guard makes the flip happen
 * AT MOST ONCE — so an already-cancelled order can never be restocked twice, even
 * under a hand-crafted concurrent POST. This is defensive on top of the terminal
 * transition guard (`canTransitionOrderStatus`), which the caller applies first.
 * Non-cancelling transitions keep the original status-only update (no stock side
 * effects on processing/completed).
 */
export async function updateAdminOrderStatus(orderCode: string, status: OrderStatus) {
  if (status !== OrderStatus.cancelled) {
    return prisma.order.update({
      where: { orderCode },
      data: { status },
      select: { orderCode: true, status: true },
    })
  }

  return prisma.$transaction(async (tx) => {
    // Atomically flip to cancelled ONLY if not already cancelled. `count === 1`
    // means we own this cancellation, so the restock below runs exactly once.
    const flipped = await tx.order.updateMany({
      where: { orderCode, status: { not: OrderStatus.cancelled } },
      data: { status: OrderStatus.cancelled },
    })

    if (flipped.count === 1) {
      const items = await tx.orderItem.findMany({
        where: { order: { orderCode } },
        select: { productId: true, variantId: true, stockSource: true, quantity: true },
      })
      for (const item of items) {
        if (item.stockSource === 'variant' && item.variantId) {
          // Variant-tracked line (Этап 30B): restock the variant row. A deleted
          // variant matches 0 rows → safe no-op. `not: null` leaves an untracked
          // variant untouched.
          const res = await tx.productVariant.updateMany({
            where: { id: item.variantId, stockQuantity: { not: null } },
            data: { stockQuantity: { increment: item.quantity } },
          })
          // Inventory ledger (Этап 70A): record the restock ONLY when it actually
          // applied (a tracked variant survived) — same tx, so it rolls back together.
          if (res.count === 1) {
            await tx.inventoryStockMovement.create({
              data: buildMovementInput({
                level: 'variant',
                delta: item.quantity,
                reason: 'order_cancelled_restock',
                productId: item.productId,
                variantId: item.variantId,
                orderCode,
              }),
            })
          }
          continue
        }
        // Product-level path: `stockSource === 'product'` AND legacy null lines
        // (pre-30B, which only ever decremented product stock). No product to
        // restock (deleted product → snapshot-only line) is skipped.
        if (!item.productId) continue
        // Restock ONLY tracked products. The `stockQuantity: { not: null }`
        // guard leaves untracked (null) stock null — never resurrected to 0.
        const res = await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: item.quantity } },
        })
        if (res.count === 1) {
          await tx.inventoryStockMovement.create({
            data: buildMovementInput({
              level: 'product',
              delta: item.quantity,
              reason: 'order_cancelled_restock',
              productId: item.productId,
              orderCode,
            }),
          })
        }
      }
    }

    const row = await tx.order.findUnique({
      where: { orderCode },
      select: { orderCode: true, status: true },
    })
    // Caller already confirmed the order exists (non-null prior status).
    return row!
  })
}

export type AdminOrderListItem = Awaited<ReturnType<typeof getAdminOrders>>[number]
export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrderByCode>>>
