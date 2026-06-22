/**
 * AURELIA — Server-authoritative cart pricing (Этап 63A)
 *
 * Single source of truth for turning the client's requested cart lines (slug + qty +
 * optional variantId) into priced, snapshot order lines and an authoritative subtotal — all
 * recomputed from PostgreSQL. The client price/name/status is NEVER trusted.
 *
 * Extracted (behaviour-preserving) from createOrderDraft so the SAME pricing drives both the
 * order commit AND the checkout promo preview, guaranteeing the discount preview and the
 * stored order agree. The order action remains authoritative: it re-runs this at submit and
 * recomputes the discount, so a stale/forged client total can never be persisted.
 *
 * `import 'server-only'` keeps Prisma out of the client bundle.
 */

import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { PURCHASABLE_PRODUCT_STATUSES, isPurchasableStatus } from '../catalog/availability'
import { resolveOrderLineVariant } from './variants'
import { QTY_MAX, QTY_MIN, type OrderDraftItemInput } from './types'

/** A stock level that must be decremented atomically at order commit. */
export interface StockDecrement {
  source: 'variant' | 'product'
  id: string
  name: string
  qty: number
}

export type PricedCart =
  | {
      ok: true
      subtotalMinor: number
      itemRows: Prisma.OrderItemCreateWithoutOrderInput[]
      stockDecrements: StockDecrement[]
      itemCount: number
    }
  | {
      ok: false
      /** Customer-safe message. */
      error: string
      /** Coarse analytics bucket (the order action records it; the preview ignores it). */
      errorType:
        | 'invalid_quantity'
        | 'empty_cart'
        | 'product_unavailable'
    }

/**
 * Prices the requested cart lines server-side. Mirrors the exact rules createOrderDraft used:
 * line identity is (slug, variantId); hidden/non-purchasable products are gated out in the
 * query; variant resolution + unit price + stock target come from resolveOrderLineVariant;
 * the subtotal is the sum of line totals (BEFORE any discount).
 */
export async function priceOrderItems(items: OrderDraftItemInput[]): Promise<PricedCart> {
  // Normalise + merge duplicate (slug, variantId) lines, summing quantities.
  const requested = new Map<string, { slug: string; variantId: string | null; qty: number }>()
  for (const item of items ?? []) {
    const slug = typeof item?.slug === 'string' ? item.slug : ''
    const variantId =
      typeof item?.variantId === 'string' && item.variantId.trim() ? item.variantId.trim() : null
    const qty = Math.floor(Number(item?.qty))
    if (!slug || !Number.isFinite(qty) || qty < QTY_MIN || qty > QTY_MAX) {
      return { ok: false, error: 'Некоректна кількість товару в замовленні.', errorType: 'invalid_quantity' }
    }
    const key = `${slug}::${variantId ?? ''}`
    const existing = requested.get(key)
    requested.set(key, { slug, variantId, qty: (existing?.qty ?? 0) + qty })
  }
  if (requested.size === 0) {
    return { ok: false, error: 'Кошик порожній.', errorType: 'empty_cart' }
  }

  // Pull real products — never trust client price/name/status. Two authoritative gates in
  // the query: published-only (26M) + purchasable status (28A). A non-orderable slug
  // resolves to undefined below → "no longer available" rejection.
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

  const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = []
  const stockDecrements: StockDecrement[] = []
  let subtotalMinor = 0

  for (const { slug, variantId, qty } of requested.values()) {
    const product = bySlug.get(slug)
    if (!product) {
      return { ok: false, error: `Товар «${slug}» більше не доступний.`, errorType: 'product_unavailable' }
    }
    if (!isPurchasableStatus(product.status) || product.price == null) {
      return { ok: false, error: `Товар «${product.name}» зараз не можна замовити.`, errorType: 'product_unavailable' }
    }
    const resolved = resolveOrderLineVariant({
      productPrice: product.price,
      productStock: product.stockQuantity,
      variants: product.variants,
      variantId,
    })
    if (!resolved.ok) {
      const msg =
        resolved.reason === 'invalid_price'
          ? `Товар «${product.name}» зараз не можна замовити.`
          : `Обраний варіант товару «${product.name}» недоступний.`
      return { ok: false, error: msg, errorType: 'product_unavailable' }
    }
    const { variant, unitPrice, stockSource, availableStock } = resolved

    if (stockSource && availableStock != null && availableStock < qty) {
      return {
        ok: false,
        error: `Товар «${product.name}»: на складі недостатньо (${availableStock} шт.).`,
        errorType: 'product_unavailable',
      }
    }
    if (stockSource === 'variant' && variant) {
      stockDecrements.push({ source: 'variant', id: variant.id, name: product.name, qty })
    } else if (stockSource === 'product') {
      stockDecrements.push({ source: 'product', id: product.id, name: product.name, qty })
    }

    const lineTotal = unitPrice * qty
    subtotalMinor += lineTotal
    itemRows.push({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productSku: variant?.sku ?? product.sku ?? null,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      variantValue: variant?.value ?? null,
      stockSource: stockSource ?? null,
      unitPrice,
      quantity: qty,
      lineTotal,
    })
  }

  const itemCount = itemRows.reduce((n, r) => n + (r.quantity ?? 0), 0)
  return { ok: true, subtotalMinor, itemRows, stockDecrements, itemCount }
}
