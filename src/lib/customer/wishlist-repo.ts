/**
 * AURELIA — Server-side wishlist data layer (Этап 62A)
 *
 * Server-only Prisma reads/writes for the logged-in customer's persistent wishlist
 * (model CustomerWishlistItem). Guest favourites stay client-only (localStorage) — this
 * layer is only ever reached for an authenticated customer.
 *
 * Privacy + safety by construction:
 *   - EVERY function is HARD-SCOPED by `customerId` (the caller passes the id it just
 *     re-derived from the verified session), so one customer can never read/alter another's
 *     wishlist.
 *   - the storefront-facing reads return PUBLISHED products only (mapped to the same
 *     frontend `Product` shape), so a hidden/unpublished product is never surfaced as
 *     purchasable; a deleted product is auto-removed by the FK cascade.
 *   - "add" resolves a SLUG → a published product server-side (never trusts an arbitrary
 *     id) and is idempotent via the (customerId, productId) unique constraint.
 *
 * `import 'server-only'` keeps Prisma out of any client bundle.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { productInclude } from '../catalog/server'
import { mapDbProductToProduct } from '../catalog/map'
import type { Product } from '../catalog/types'

/** Latin storefront slug guard (matches the /product/[slug] route shape). */
const SLUG_RE = /^[a-z0-9-]{1,128}$/i

function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug)
}

/** Resolves a slug to a PUBLISHED product id, or null (hidden/unknown/invalid). */
async function resolvePublishedProductId(slug: string): Promise<string | null> {
  if (!isValidSlug(slug)) return null
  const row = await prisma.product.findFirst({
    where: { slug, isPublished: true },
    select: { id: true },
  })
  return row?.id ?? null
}

/**
 * Adds a product (by slug) to the customer's wishlist. Idempotent: a second add of the
 * same product is a no-op (handled by upsert on the unique key). Returns false when the
 * slug is invalid or resolves to no published product (so hidden/unknown products are
 * never silently stored).
 */
export async function addWishlistBySlug(customerId: string, slug: string): Promise<boolean> {
  if (!customerId) return false
  const productId = await resolvePublishedProductId(slug)
  if (!productId) return false
  await prisma.customerWishlistItem.upsert({
    where: { customerId_productId: { customerId, productId } },
    create: { customerId, productId },
    update: {},
  })
  return true
}

/** Removes a product (by slug) from the customer's wishlist. Safe no-op if absent. */
export async function removeWishlistBySlug(customerId: string, slug: string): Promise<boolean> {
  if (!customerId || !isValidSlug(slug)) return false
  // Resolve by slug WITHOUT the published filter so a now-hidden product can still be
  // removed from the wishlist. Scoped delete (deleteMany) never throws on a missing row.
  const product = await prisma.product.findFirst({ where: { slug }, select: { id: true } })
  if (!product) return false
  await prisma.customerWishlistItem.deleteMany({ where: { customerId, productId: product.id } })
  return true
}

/** Adds many slugs at once (one-time merge of guest favourites on login). Caps the batch
 *  and ignores invalid/hidden slugs. Returns the count actually stored. */
export async function addManyWishlistBySlug(customerId: string, slugs: string[]): Promise<number> {
  if (!customerId || !Array.isArray(slugs)) return 0
  const unique = Array.from(new Set(slugs.filter(isValidSlug))).slice(0, 200)
  let added = 0
  for (const slug of unique) {
    if (await addWishlistBySlug(customerId, slug)) added++
  }
  return added
}

/** Clears the entire wishlist for one customer. */
export async function clearWishlist(customerId: string): Promise<void> {
  if (!customerId) return
  await prisma.customerWishlistItem.deleteMany({ where: { customerId } })
}

/**
 * The customer's wishlist slugs (PUBLISHED products only), newest first. Used to seed the
 * client favourites store for a logged-in customer.
 */
export async function getWishlistSlugs(customerId: string): Promise<string[]> {
  if (!customerId) return []
  const rows = await prisma.customerWishlistItem.findMany({
    where: { customerId, product: { isPublished: true } },
    orderBy: { createdAt: 'desc' },
    select: { product: { select: { slug: true } } },
  })
  return rows.map((r) => r.product.slug)
}

/**
 * The customer's wishlist as fully-mapped storefront products (PUBLISHED only), in
 * wishlist order (newest first). Hidden products are filtered out; deleted products are
 * already gone via the FK cascade — so nothing dangling or non-purchasable leaks.
 */
export async function getWishlistProducts(customerId: string): Promise<Product[]> {
  if (!customerId) return []
  const rows = await prisma.customerWishlistItem.findMany({
    where: { customerId, product: { isPublished: true } },
    orderBy: { createdAt: 'desc' },
    select: { product: { include: productInclude } },
  })
  return rows.map((r) => mapDbProductToProduct(r.product))
}
