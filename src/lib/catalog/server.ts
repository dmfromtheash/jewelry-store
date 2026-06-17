/**
 * AURELIA — Server catalog layer (Этап 15D)
 *
 * DB-backed catalog reads for Server Components. This is the runtime source of
 * the storefront catalog (the mock in src/data/products.ts is now only the seed
 * source). Returns the same frontend `Product` shape the UI already expects, via
 * the pure mapper in ./map.
 *
 * `import 'server-only'` makes the build FAIL if a Client Component ever imports
 * this module — keeping Prisma out of the client bundle. Client components read
 * the catalog through the snapshot provided by ./CatalogProvider instead.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { mapDbProductToProduct } from './map'
import type { CategorySlug, Product } from './types'

// Relations the mapper needs. `include` also returns all Product scalar fields
// (price, status, specs, …). Ordered by SKU so the catalog order matches the
// original mock array (AU-1001, AU-1002, …).
const productInclude = {
  category: { select: { slug: true } },
  variants: {
    select: { name: true, value: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  images: {
    select: { url: true, alt: true, isPrimary: true, position: true },
    orderBy: { position: 'asc' as const },
  },
}

const orderBySku = { sku: 'asc' as const }

export async function getAllProductsFromDb(): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    include: productInclude,
    orderBy: orderBySku,
  })
  return rows.map(mapDbProductToProduct)
}

export async function getProductBySlugFromDb(slug: string): Promise<Product | null> {
  const row = await prisma.product.findUnique({
    where: { slug },
    include: productInclude,
  })
  return row ? mapDbProductToProduct(row) : null
}

export async function getProductsByCategorySlugFromDb(
  categorySlug: CategorySlug,
): Promise<Product[]> {
  const rows = await prisma.product.findMany({
    where: { category: { slug: categorySlug } },
    include: productInclude,
    orderBy: orderBySku,
  })
  return rows.map(mapDbProductToProduct)
}

export async function getAllProductSlugsFromDb(): Promise<string[]> {
  const rows = await prisma.product.findMany({
    select: { slug: true },
    orderBy: orderBySku,
  })
  return rows.map((r) => r.slug)
}

/**
 * Full catalog snapshot for client components (HeaderSearch / Cart / Favorites /
 * RecentlyViewed). Plain serializable `Product[]` passed from the root layout
 * into <CatalogProvider> — so the client never imports Prisma or this module.
 */
export async function getCatalogSnapshotForClient(): Promise<Product[]> {
  return getAllProductsFromDb()
}
