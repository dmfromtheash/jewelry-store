/**
 * AURELIA — Cart line resolution (Этап 30D) — pure
 *
 * Pure helpers shared by the client cart (CartProvider) and the verify script.
 * No React, no Prisma, no `server-only`: just (product + optional variantId) →
 * a resolved line (chosen variant, unit price in UAH, availability, label).
 *
 * The SERVER stays authoritative on price/stock (createOrderDraft, 30B). These
 * helpers only drive client display + the composite cart identity, and they MUST
 * mirror the server's default-fallback so an old cart line (no variantId) resolves
 * to the same variant the server would pick.
 */

import { isProductPurchasable } from '../catalog/availability'
import type { Product, ProductVariantRef } from '../catalog/types'

/**
 * Composite cart-line identity: `slug::variantId` (Этап 30D). The same product in
 * two variants are two distinct lines; a product without a variant keeps the bare
 * `slug::` key, so old `{ slug, qty }` entries map cleanly to it.
 */
export function cartLineKey(slug: string, variantId?: string | null): string {
  return `${slug}::${variantId ?? ''}`
}

/**
 * Deterministic default variant — mirrors the server's `pickDefaultVariant`
 * (30B): the `isDefault` row when exactly one is marked, otherwise the first by
 * (sortOrder, value, id). Returns null for an empty list.
 */
export function pickDefaultVariantRef(
  variants: readonly ProductVariantRef[],
): ProductVariantRef | null {
  if (variants.length === 0) return null
  const defaults = variants.filter((v) => v.isDefault)
  if (defaults.length === 1) return defaults[0]
  const pool = defaults.length > 1 ? defaults : variants
  return [...pool].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder ||
      a.value.localeCompare(b.value) ||
      a.id.localeCompare(b.id),
  )[0]
}

/** True when a variant can be ordered on its own stock (null = not tracked → ok). */
export function isVariantInStock(variant: ProductVariantRef): boolean {
  return variant.stockQuantity == null || variant.stockQuantity > 0
}

/** Short, language-correct label for the cart/checkout subtext (value only). */
export function variantLabel(variant: ProductVariantRef | null): string | null {
  return variant ? variant.value : null
}

export interface ResolvedCartLine {
  /** Orderable now? false → routed to the cart's "unavailable" bucket. */
  available: boolean
  /** Chosen variant, or null for a product sold without variants. */
  variant: ProductVariantRef | null
  /** Unit price in UAH incl. variant priceDelta; null when not orderable/priced. */
  unitPrice: number | null
  /** Subtext label for the line, or null. */
  label: string | null
}

const UNAVAILABLE: ResolvedCartLine = { available: false, variant: null, unitPrice: null, label: null }

/**
 * Resolve one cart entry for display + submission (Этап 30D):
 *  - missing/non-purchasable product → unavailable;
 *  - product WITHOUT variants → unchanged behaviour (price = product.price);
 *  - product WITH variants → resolve by variantId, else the default fallback; a
 *    variantId that no longer exists (deleted) or an out-of-stock variant →
 *    unavailable (removable, excluded from totals, checkout-blocked).
 */
export function resolveCartLine(
  product: Product | undefined,
  variantId?: string | null,
): ResolvedCartLine {
  if (!product || !isProductPurchasable(product)) return UNAVAILABLE

  const variants = product.variants ?? []
  const basePrice = typeof product.price === 'number' ? product.price : null

  if (variants.length === 0) {
    // No-variant product: exactly as before 30D.
    return { available: true, variant: null, unitPrice: basePrice, label: null }
  }

  const variant = variantId
    ? variants.find((v) => v.id === variantId) ?? null
    : pickDefaultVariantRef(variants)

  // variantId pointed at a now-deleted/foreign variant → not orderable.
  if (!variant) return UNAVAILABLE
  // Variant tracked and out of stock → not orderable (route to unavailable).
  if (!isVariantInStock(variant)) {
    return { available: false, variant, unitPrice: null, label: variantLabel(variant) }
  }

  const unitPrice = basePrice == null ? null : basePrice + (variant.priceDelta ?? 0)
  return { available: unitPrice != null, variant, unitPrice, label: variantLabel(variant) }
}
