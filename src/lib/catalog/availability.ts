/**
 * AURELIA — Product purchasability policy (Этап 28A)
 *
 * Single source of truth for "can a customer actually BUY this product right
 * now". Visibility (`isPublished`, Этап 26M) is a separate, earlier gate: a
 * hidden product never reaches the storefront at all. This module covers the
 * remaining gap — a PUBLISHED product can still be non-purchasable by status
 * (e.g. `coming_soon`). Only an explicitly available status is purchasable;
 * everything else is conservatively treated as not purchasable.
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
 * True when a product can actually be ordered: a purchasable status AND a real
 * price. `coming_soon` (no price) and any future non-available status return
 * false. Accepts the minimal shape shared by the UI `Product` and a DB row.
 */
export function isProductPurchasable(product: { status: string; price?: number | null }): boolean {
  return isPurchasableStatus(product.status) && typeof product.price === 'number'
}
