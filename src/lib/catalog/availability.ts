/**
 * AURELIA — Product purchasability policy (Этап 28A; stock added 28B)
 *
 * Single source of truth for "can a customer actually BUY this product right
 * now". Visibility (`isPublished`, Этап 26M) is a separate, earlier gate: a
 * hidden product never reaches the storefront at all. This module covers the
 * remaining gaps — a PUBLISHED product can still be non-purchasable by status
 * (e.g. `coming_soon`, Этап 28A) or by being out of stock (Этап 28B). Only an
 * available, priced, in-stock product is purchasable; everything else is
 * conservatively treated as not purchasable.
 *
 * Pure + dependency-free (no Prisma, no React), so it is safe to import from the
 * client cart, the server order action, and the verify script alike. The single
 * purchasable value `'available'` matches BOTH the Prisma enum value
 * (`ProductStatus.available`) and the UI status union (`'available'`), so one
 * predicate serves every layer.
 */

/** The only product status a customer can buy. Conservative by design. */
export const PURCHASABLE_PRODUCT_STATUSES = ['available'] as const
export type PurchasableProductStatus = (typeof PURCHASABLE_PRODUCT_STATUSES)[number]

/** True when the status string is one a customer may purchase. */
export function isPurchasableStatus(status: string): boolean {
  return (PURCHASABLE_PRODUCT_STATUSES as readonly string[]).includes(status)
}

/**
 * Stock policy (Этап 28B): `null`/`undefined` means stock is NOT tracked, so the
 * product stays purchasable on status+price alone (legacy/demo items). A tracked
 * stock is purchasable only while it is strictly greater than zero.
 */
export function isInStock(stockQuantity?: number | null): boolean {
  return stockQuantity == null || stockQuantity > 0
}

/**
 * True when a product can actually be ordered: a purchasable status, a real
 * price, AND in stock. `coming_soon` (no price), any non-available status, and a
 * tracked `stockQuantity` of 0 all return false. Accepts the minimal shape shared
 * by the UI `Product` and a DB row.
 */
export function isProductPurchasable(product: {
  status: string
  price?: number | null
  stockQuantity?: number | null
}): boolean {
  return (
    isPurchasableStatus(product.status) &&
    typeof product.price === 'number' &&
    isInStock(product.stockQuantity)
  )
}
