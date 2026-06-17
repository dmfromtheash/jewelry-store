'use server'

/**
 * AURELIA — Order draft server action (Этап 16A)
 *
 * Creates a guest checkout draft order. The ONLY things trusted from the client
 * are product slugs and quantities; every price, name, sku and availability is
 * read from PostgreSQL and recomputed server-side, so a tampered client price
 * can never affect the stored order. No payment / auth / shipping.
 */

import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { validateOrderDraftFields, hasErrors } from './validate'
import { QTY_MAX, QTY_MIN, type OrderDraftInput, type OrderDraftResult } from './types'
import { recordCheckoutError, recordDraftOrderCreated } from '../analytics/record'
import { PURCHASABLE_PRODUCT_STATUSES, isProductPurchasable } from '../catalog/availability'

function generateOrderCode(): string {
  // 8 hex chars (~4.3B combos); uniqueness is also enforced by the DB + retry.
  return `AUR-${randomBytes(4).toString('hex').toUpperCase()}`
}

/** Thrown inside the order transaction when a tracked product's stock ran out
 *  between validation and the conditional decrement (Этап 28B). Forces rollback. */
class OutOfStockError extends Error {
  constructor(public readonly productName: string) {
    super('out_of_stock')
    this.name = 'OutOfStockError'
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export async function createOrderDraft(input: OrderDraftInput): Promise<OrderDraftResult> {
  // 1) Field validation (authoritative; the form reuses the same rules for UX).
  const fieldErrors = validateOrderDraftFields(input)
  if (hasErrors(fieldErrors)) {
    await recordCheckoutError({ errorType: 'validation' })
    return { ok: false, error: 'Проверьте поля формы.', fieldErrors }
  }

  // 2) Normalise the requested items (slug + integer qty in range).
  const requested = new Map<string, number>()
  for (const item of input.items) {
    const slug = typeof item?.slug === 'string' ? item.slug : ''
    const qty = Math.floor(Number(item?.qty))
    if (!slug || !Number.isFinite(qty) || qty < QTY_MIN || qty > QTY_MAX) {
      await recordCheckoutError({ errorType: 'invalid_quantity' })
      return { ok: false, error: 'Некорректное количество товара в заказе.' }
    }
    requested.set(slug, (requested.get(slug) ?? 0) + qty)
  }
  if (requested.size === 0) {
    await recordCheckoutError({ errorType: 'empty_cart', itemCount: 0 })
    return { ok: false, error: 'Корзина пуста.', fieldErrors: { items: 'Корзина пуста.' } }
  }

  // 3) Pull the real products from the DB — never trust client price/name/status.
  //    TWO authoritative purchasability gates are applied right in the query:
  //      - `isPublished: true` — visibility gate (Этап 26M): a hidden product is
  //        never fetched, so it can NEVER enter an Order/OrderItem.
  //      - `status in PURCHASABLE_PRODUCT_STATUSES` — availability gate (Этап 28A):
  //        a published-but-non-purchasable product (e.g. `coming_soon`) is never
  //        fetched either. A non-orderable slug simply resolves to `undefined`
  //        below and falls into the "no longer available" rejection — even if a
  //        tampered client payload smuggles its slug in.
  const products = await prisma.product.findMany({
    where: {
      slug: { in: [...requested.keys()] },
      isPublished: true,
      status: { in: [...PURCHASABLE_PRODUCT_STATUSES] },
    },
    select: { id: true, slug: true, name: true, sku: true, price: true, status: true, stockQuantity: true },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  // 4) Build snapshot line items, rejecting anything not orderable. The status is
  //    already gated by the query; this re-checks status + price defensively
  //    (single source of truth: isProductPurchasable / PURCHASABLE_PRODUCT_STATUSES).
  const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = []
  // Tracked lines whose stock must be decremented atomically (Этап 28B). Lines
  // with stockQuantity === null are NOT tracked and never decremented.
  const stockDecrements: { id: string; name: string; qty: number }[] = []
  let subtotalAmount = 0
  for (const [slug, qty] of requested) {
    const product = bySlug.get(slug)
    if (!product) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${slug}» больше не доступен.` }
    }
    if (!isProductPurchasable(product) || product.price == null) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${product.name}» сейчас нельзя заказать.` }
    }
    // Stock guard (Этап 28B): a tracked product must have enough on hand. The
    // authoritative, race-safe decrement happens in the transaction below; this
    // is the early, friendly rejection using the just-read snapshot.
    if (product.stockQuantity != null && product.stockQuantity < qty) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${product.name}»: на складе недостаточно (${product.stockQuantity} шт.).` }
    }
    if (product.stockQuantity != null) {
      stockDecrements.push({ id: product.id, name: product.name, qty })
    }
    const lineTotal = product.price * qty
    subtotalAmount += lineTotal
    itemRows.push({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productSku: product.sku ?? null,
      unitPrice: product.price,
      quantity: qty,
      lineTotal,
    })
  }

  // 5) Persist Order + OrderItems AND decrement tracked stock in ONE transaction,
  //    so they never partially succeed. Retry only on the (rare) order-code
  //    collision; a rollback also undoes any stock decrement, so the retry is safe.
  const totalAmount = subtotalAmount // no delivery cost / discounts in 16A
  const itemCount = itemRows.reduce((n, r) => n + (r.quantity ?? 0), 0)
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode()
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Conditional decrement: `stockQuantity >= qty` in the WHERE guarantees
        // stock can never go negative and prevents oversell under concurrent
        // orders (a racing tx that already took the stock makes count === 0).
        for (const d of stockDecrements) {
          const res = await tx.product.updateMany({
            where: { id: d.id, stockQuantity: { gte: d.qty } },
            data: { stockQuantity: { decrement: d.qty } },
          })
          if (res.count !== 1) throw new OutOfStockError(d.name)
        }
        return tx.order.create({
          data: {
            orderCode,
            status: 'submitted',
            customerName: input.customerName.trim(),
            customerPhone: input.customerPhone.trim(),
            customerEmail: input.customerEmail?.trim() ? input.customerEmail.trim() : null,
            deliveryCity: input.deliveryCity.trim(),
            // Allowlisted by validateOrderDraftFields above — store the normalised
            // key, never a raw/unknown client value.
            deliveryMethod: input.deliveryMethod.trim(),
            // Optional free-text note (отделение/адрес/комментарий); null if blank.
            deliveryDetails: input.deliveryDetails?.trim() ? input.deliveryDetails.trim() : null,
            paymentMethod: input.paymentMethod.trim(),
            subtotalAmount,
            totalAmount,
            items: { create: itemRows },
          },
          select: { orderCode: true },
        })
      })
      // Analytics: order CODE + coarse totals only — never customer PII.
      await recordDraftOrderCreated({ orderCode: order.orderCode, itemCount, totalMinor: totalAmount })
      return { ok: true, orderCode: order.orderCode }
    } catch (e) {
      // Lost a stock race (someone else took the last unit while we checked out).
      if (e instanceof OutOfStockError) {
        await recordCheckoutError({ errorType: 'product_unavailable', itemCount })
        return { ok: false, error: `Товар «${e.productName}» закончился. Обновите корзину.` }
      }
      if (isUniqueViolation(e) && attempt < 4) continue
      console.error('createOrderDraft failed:', e)
      await recordCheckoutError({ errorType: 'server', itemCount })
      return { ok: false, error: 'Не удалось создать заказ. Попробуйте ещё раз.' }
    }
  }
  await recordCheckoutError({ errorType: 'server', itemCount })
  return { ok: false, error: 'Не удалось создать заказ. Попробуйте ещё раз.' }
}
