/**
 * AURELIA — Order-line variant resolution policy (Этап 30B)
 *
 * Single source of truth for turning a requested order line (a product + an
 * optional `variantId`) into the authoritative variant choice, unit price, and
 * inventory target. Pricing and stock are decided HERE, server-side — the client
 * never sends a trusted price or stock level.
 *
 * Pure + dependency-free (no Prisma client, no `server-only`, no React), so the
 * exact same policy is shared by the server action (`createOrderDraft`), the
 * verify script (`verify-product-variants`, run under tsx), and the future 30D
 * storefront/cart — mirroring the `availability.ts` / `transitions.ts` pattern.
 *
 * v1 is single-axis: a product has either zero variants (legacy/no-variant
 * product, unchanged behaviour) or one attribute group of selectable rows. No
 * multi-axis matrix.
 */

/** Minimal variant-row shape this policy needs (a subset of ProductVariant). */
export interface VariantRow {
  id: string
  name: string
  value: string
  sortOrder: number
  isDefault: boolean
  priceDelta: number | null
  stockQuantity: number | null
  /** Optional variant SKU; not used by the policy, carried for the order snapshot. */
  sku: string | null
}

/** Which inventory level a resolved line decrements/restocks. */
export type StockSource = 'variant' | 'product'

/** Why a line could not be resolved (all map to a customer-safe rejection). */
export type VariantResolveError =
  | 'variant_not_found' // variantId given but not on this product (or product has none)
  | 'no_default' // product has variants but no resolvable default (should be unreachable)
  | 'invalid_price' // computed unitPrice is not a real positive integer

export type VariantResolution =
  | {
      ok: true
      /** The resolved variant, or `null` for a product without variants. */
      variant: VariantRow | null
      /** Server-authoritative unit price (minor units) incl. priceDelta. */
      unitPrice: number
      /** Inventory level to decrement; `null` = untracked (no decrement). */
      stockSource: StockSource | null
      /** Stock available at `stockSource`; `null` when untracked. */
      availableStock: number | null
    }
  | { ok: false; reason: VariantResolveError }

/**
 * Deterministic default variant for a variant product (Этап 30B fallback for an
 * old/no-variantId cart line — §6 backward compatibility, never rejected):
 * the `isDefault` row when exactly one is marked, otherwise the first by
 * (sortOrder, value, id) so the choice is stable and reproducible. Returns
 * `null` only for an empty list.
 */
export function pickDefaultVariant(variants: readonly VariantRow[]): VariantRow | null {
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

/**
 * Resolve one order line against its product.
 *
 *  - Product WITHOUT variants: `variant` is null, price = productPrice, stock
 *    falls back to product stock (28B). A `variantId` on a variant-less product
 *    is rejected (`variant_not_found`) — it cannot belong to this product.
 *  - Product WITH variants + no variantId: fall back to the default variant
 *    (§6, never rejected).
 *  - Product WITH variants + variantId: the id MUST belong to this product, else
 *    `variant_not_found` (covers both an unknown id and a foreign-product id —
 *    callers pass only this product's variants).
 *
 * Pricing: `unitPrice = productPrice + (variant.priceDelta ?? 0)`, rejected if it
 * is not a positive integer. Stock: variant stock when the resolved variant
 * tracks it (`!= null`), else product stock; `null` at both levels = untracked.
 */
export function resolveOrderLineVariant(args: {
  productPrice: number
  productStock: number | null
  variants: readonly VariantRow[]
  variantId?: string | null
}): VariantResolution {
  const { productPrice, productStock, variants, variantId } = args

  let variant: VariantRow | null = null
  if (variants.length > 0) {
    if (variantId) {
      variant = variants.find((v) => v.id === variantId) ?? null
      if (!variant) return { ok: false, reason: 'variant_not_found' }
    } else {
      variant = pickDefaultVariant(variants)
      if (!variant) return { ok: false, reason: 'no_default' }
    }
  } else if (variantId) {
    // A variantId for a product that has no variants can never belong to it.
    return { ok: false, reason: 'variant_not_found' }
  }

  const unitPrice = productPrice + (variant?.priceDelta ?? 0)
  if (!Number.isInteger(unitPrice) || unitPrice <= 0) {
    return { ok: false, reason: 'invalid_price' }
  }

  // Stock target: variant stock wins when the variant tracks it; else product
  // stock; else untracked (null at both levels).
  let stockSource: StockSource | null = null
  let availableStock: number | null = null
  if (variant && variant.stockQuantity != null) {
    stockSource = 'variant'
    availableStock = variant.stockQuantity
  } else if (productStock != null) {
    stockSource = 'product'
    availableStock = productStock
  }

  return { ok: true, variant, unitPrice, stockSource, availableStock }
}
