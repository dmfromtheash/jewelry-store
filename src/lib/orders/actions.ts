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

function generateOrderCode(): string {
  // 8 hex chars (~4.3B combos); uniqueness is also enforced by the DB + retry.
  return `AUR-${randomBytes(4).toString('hex').toUpperCase()}`
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
  const products = await prisma.product.findMany({
    where: { slug: { in: [...requested.keys()] } },
    select: { id: true, slug: true, name: true, sku: true, price: true, status: true },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  // 4) Build snapshot line items, rejecting anything not orderable.
  const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = []
  let subtotalAmount = 0
  for (const [slug, qty] of requested) {
    const product = bySlug.get(slug)
    if (!product) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${slug}» больше не доступен.` }
    }
    if (product.status !== 'available' || product.price == null) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${product.name}» сейчас нельзя заказать.` }
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

  // 5) Persist Order + OrderItems atomically (nested create is one transaction).
  //    Retry only on the (rare) order-code collision.
  const totalAmount = subtotalAmount // no delivery cost / discounts in 16A
  const itemCount = itemRows.reduce((n, r) => n + (r.quantity ?? 0), 0)
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode()
    try {
      const order = await prisma.order.create({
        data: {
          orderCode,
          status: 'submitted',
          customerName: input.customerName.trim(),
          customerPhone: input.customerPhone.trim(),
          customerEmail: input.customerEmail?.trim() ? input.customerEmail.trim() : null,
          deliveryCity: input.deliveryCity.trim(),
          deliveryMethod: input.deliveryMethod,
          paymentMethod: input.paymentMethod,
          subtotalAmount,
          totalAmount,
          items: { create: itemRows },
        },
        select: { orderCode: true },
      })
      // Analytics: order CODE + coarse totals only — never customer PII.
      await recordDraftOrderCreated({ orderCode: order.orderCode, itemCount, totalMinor: totalAmount })
      return { ok: true, orderCode: order.orderCode }
    } catch (e) {
      if (isUniqueViolation(e) && attempt < 4) continue
      console.error('createOrderDraft failed:', e)
      await recordCheckoutError({ errorType: 'server', itemCount })
      return { ok: false, error: 'Не удалось создать заказ. Попробуйте ещё раз.' }
    }
  }
  await recordCheckoutError({ errorType: 'server', itemCount })
  return { ok: false, error: 'Не удалось создать заказ. Попробуйте ещё раз.' }
}
