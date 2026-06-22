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
import { PURCHASABLE_PRODUCT_STATUSES, isPurchasableStatus } from '../catalog/availability'
import { resolveOrderLineVariant } from './variants'
import { getCurrentCustomer } from '../customer/session'
import { enqueueOrderConfirmationEmail } from '../email/outbox'

function generateOrderCode(): string {
  // 8 hex chars (~4.3B combos); uniqueness is also enforced by the DB + retry.
  return `AUR-${randomBytes(4).toString('hex').toUpperCase()}`
}

/** Thrown inside the order transaction when a tracked product's OR variant's
 *  stock ran out between validation and the conditional decrement (28B / 30B).
 *  Forces rollback. */
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
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors }
  }

  // 2) Normalise the requested items. Line identity is the composite
  //    (slug, variantId) (Этап 30B): the same product in two variants are two
  //    distinct lines. `variantId` is optional — an absent/blank id resolves to
  //    the product's default variant later (§6 backward compatibility), so old
  //    { slug, qty } payloads keep working unchanged.
  const requested = new Map<string, { slug: string; variantId: string | null; qty: number }>()
  for (const item of input.items) {
    const slug = typeof item?.slug === 'string' ? item.slug : ''
    const variantId =
      typeof item?.variantId === 'string' && item.variantId.trim() ? item.variantId.trim() : null
    const qty = Math.floor(Number(item?.qty))
    if (!slug || !Number.isFinite(qty) || qty < QTY_MIN || qty > QTY_MAX) {
      await recordCheckoutError({ errorType: 'invalid_quantity' })
      return { ok: false, error: 'Некоректна кількість товару в замовленні.' }
    }
    const key = `${slug}::${variantId ?? ''}`
    const existing = requested.get(key)
    requested.set(key, { slug, variantId, qty: (existing?.qty ?? 0) + qty })
  }
  if (requested.size === 0) {
    await recordCheckoutError({ errorType: 'empty_cart', itemCount: 0 })
    return { ok: false, error: 'Кошик порожній.', fieldErrors: { items: 'Кошик порожній.' } }
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
  const slugs = [...new Set([...requested.values()].map((l) => l.slug))]
  const products = await prisma.product.findMany({
    where: {
      slug: { in: slugs },
      isPublished: true,
      status: { in: [...PURCHASABLE_PRODUCT_STATUSES] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      price: true,
      status: true,
      stockQuantity: true,
      // Variants for server-side resolution/pricing/stock (Этап 30B). A product
      // with zero rows behaves exactly as before (no-variant path).
      variants: {
        select: {
          id: true,
          name: true,
          value: true,
          sortOrder: true,
          isDefault: true,
          priceDelta: true,
          stockQuantity: true,
          sku: true,
        },
      },
    },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  // 4) Build snapshot line items, rejecting anything not orderable. The status is
  //    already gated by the query; this re-checks status + price defensively
  //    (single source of truth: isProductPurchasable / PURCHASABLE_PRODUCT_STATUSES).
  const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = []
  // Tracked lines whose stock must be decremented atomically (28B / 30B). Each
  // carries which level to hit: a stock-tracked variant ('variant') else the
  // product ('product'). Untracked lines (null at both levels) never appear here.
  const stockDecrements: { source: 'variant' | 'product'; id: string; name: string; qty: number }[] = []
  let subtotalAmount = 0
  for (const { slug, variantId, qty } of requested.values()) {
    const product = bySlug.get(slug)
    if (!product) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${slug}» більше не доступний.` }
    }
    // Status + price gate (Этап 28A). Stock is checked variant-aware below, so it
    // is intentionally NOT folded into this status/price guard.
    if (!isPurchasableStatus(product.status) || product.price == null) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${product.name}» зараз не можна замовити.` }
    }
    // Server-authoritative variant resolution (Этап 30B): default fallback when
    // the line omits a variantId, rejection of an unknown/foreign id, and the
    // unit price = product.price + (priceDelta ?? 0). Never trusts a client price.
    const resolved = resolveOrderLineVariant({
      productPrice: product.price,
      productStock: product.stockQuantity,
      variants: product.variants,
      variantId,
    })
    if (!resolved.ok) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      const msg =
        resolved.reason === 'invalid_price'
          ? `Товар «${product.name}» зараз не можна замовити.`
          : `Обраний варіант товару «${product.name}» недоступний.`
      return { ok: false, error: msg }
    }
    const { variant, unitPrice, stockSource, availableStock } = resolved

    // Stock guard: the chosen level (variant when tracked, else product) must have
    // enough on hand. The authoritative, race-safe decrement happens in the
    // transaction below; this is the early, friendly rejection from the snapshot.
    if (stockSource && availableStock != null && availableStock < qty) {
      await recordCheckoutError({ errorType: 'product_unavailable' })
      return { ok: false, error: `Товар «${product.name}»: на складі недостатньо (${availableStock} шт.).` }
    }
    if (stockSource === 'variant' && variant) {
      stockDecrements.push({ source: 'variant', id: variant.id, name: product.name, qty })
    } else if (stockSource === 'product') {
      stockDecrements.push({ source: 'product', id: product.id, name: product.name, qty })
    }

    const lineTotal = unitPrice * qty
    subtotalAmount += lineTotal
    itemRows.push({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      // Variant SKU wins when present, else the product SKU (snapshot).
      productSku: variant?.sku ?? product.sku ?? null,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      variantValue: variant?.value ?? null,
      // Records WHICH level was decremented so restock-on-cancel re-increments
      // the exact same row (28C / 30B). Null = untracked (nothing decremented).
      stockSource: stockSource ?? null,
      unitPrice,
      quantity: qty,
      lineTotal,
    })
  }

  // 4b) Optional customer linking (Этап 47A). Resolved from the VERIFIED customer
  //     session server-side — never trusted from the client. Guest checkout keeps
  //     `customerId = null`; a logged-in customer's order is attached to their
  //     account so it shows in their order history. A lookup failure (e.g. stale
  //     session) safely falls back to a guest order rather than blocking checkout.
  let customerId: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
  } catch {
    customerId = null
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
        // The decrement hits the variant row when the line tracks variant stock,
        // else the product row (28B fallback) — both fully race-safe (Этап 30B).
        for (const d of stockDecrements) {
          const res =
            d.source === 'variant'
              ? await tx.productVariant.updateMany({
                  where: { id: d.id, stockQuantity: { gte: d.qty } },
                  data: { stockQuantity: { decrement: d.qty } },
                })
              : await tx.product.updateMany({
                  where: { id: d.id, stockQuantity: { gte: d.qty } },
                  data: { stockQuantity: { decrement: d.qty } },
                })
          if (res.count !== 1) throw new OutOfStockError(d.name)
        }
        return tx.order.create({
          data: {
            orderCode,
            status: 'submitted',
            // Server-resolved owner (Этап 47A): null for guests, the verified
            // customer id when logged in. Never read from the client payload.
            customerId,
            customerName: input.customerName.trim(),
            customerPhone: input.customerPhone.trim(),
            customerEmail: input.customerEmail?.trim() ? input.customerEmail.trim() : null,
            deliveryCity: input.deliveryCity.trim(),
            // Allowlisted by validateOrderDraftFields above — store the normalised
            // key, never a raw/unknown client value.
            deliveryMethod: input.deliveryMethod.trim(),
            // Optional free-text note (отделение/адрес/комментарий); null if blank.
            deliveryDetails: input.deliveryDetails?.trim() ? input.deliveryDetails.trim() : null,
            // Manual branch/department + separate comment (Этап 59A); null if blank.
            // Validated above (length + no-markup) — never a carrier API value.
            deliveryBranch: input.deliveryBranch?.trim() ? input.deliveryBranch.trim() : null,
            deliveryComment: input.deliveryComment?.trim() ? input.deliveryComment.trim() : null,
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
      // Email foundation (Этап 59A; processing 60A): record an order-confirmation outbox
      // row. NO email is sent (no provider) — the no-send processor settles it to a terminal
      // state such as `skipped_no_provider`. Best-effort: the email helper swallows its own
      // errors, so this can never break a successful checkout. The recipient is stored only
      // if the customer supplied an email.
      await enqueueOrderConfirmationEmail(
        order.orderCode,
        input.customerEmail?.trim() ? input.customerEmail.trim() : null,
      )
      return { ok: true, orderCode: order.orderCode }
    } catch (e) {
      // Lost a stock race (someone else took the last unit while we checked out).
      if (e instanceof OutOfStockError) {
        await recordCheckoutError({ errorType: 'product_unavailable', itemCount })
        return { ok: false, error: `Товар «${e.productName}» закінчився. Оновіть кошик.` }
      }
      if (isUniqueViolation(e) && attempt < 4) continue
      console.error('createOrderDraft failed:', e)
      await recordCheckoutError({ errorType: 'server', itemCount })
      return { ok: false, error: 'Не вдалося створити замовлення. Спробуйте ще раз.' }
    }
  }
  await recordCheckoutError({ errorType: 'server', itemCount })
  return { ok: false, error: 'Не вдалося створити замовлення. Спробуйте ще раз.' }
}
