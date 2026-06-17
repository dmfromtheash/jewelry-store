/**
 * AURELIA — DB → frontend Product mapping (Этап 15D)
 *
 * Pure mapping from a Prisma product row (with category + coating variants) to
 * the frontend `Product` shape used across the storefront. No Prisma client and
 * no `server-only` import here, so this module is safe to use from the server
 * catalog layer AND from the runtime verify script.
 *
 * Conversions applied here (the storefront contract):
 *   - price: integer MINOR units in the DB → whole UAH for the UI
 *   - status: Prisma enum `coming_soon` → frontend `'coming-soon'`
 *   - coatings: `coating` variants (ordered) → `string[]`
 *   - categoryLabel → `category`; category.slug → `categorySlug`
 *   - specs JSON → `ProductSpec[]`
 */

import type { CategorySlug, Product, ProductImageRef, ProductSpec } from './types'

/** Minimal shape of a Prisma product image row needed for mapping. */
export interface DbProductImageForMapping {
  url: string | null
  alt: string | null
  isPrimary: boolean
  position: number
}

/** Minimal shape of a Prisma product row needed for mapping. */
export interface DbProductForMapping {
  slug: string
  name: string
  categoryLabel: string
  status: 'available' | 'coming_soon'
  price: number | null
  sku: string | null
  brand: string | null
  description: string | null
  tag: string | null
  tagGold: boolean
  rating: number
  reviewsCount: number
  specs: unknown
  category: { slug: string }
  variants: { name: string; value: string; sortOrder: number }[]
  /** Optional — only mapped when the catalog query includes images. */
  images?: DbProductImageForMapping[]
}

export function mapDbProductToProduct(row: DbProductForMapping): Product {
  const coatings = row.variants
    .filter((v) => v.name === 'coating')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.value)

  // Real images only (a row exists per slot but `url` stays null until an asset
  // is uploaded). Ordered by position; primary first so cards use it.
  const imageRows = (row.images ?? [])
    .filter((img): img is DbProductImageForMapping & { url: string } => !!img.url)
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.position - b.position)
  const images: ProductImageRef[] = imageRows.map((img) => ({
    url: img.url,
    alt: img.alt ?? undefined,
  }))
  const imageUrl = images.length > 0 ? images[0].url : undefined

  return {
    slug: row.slug,
    name: row.name,
    category: row.categoryLabel,
    categorySlug: row.category.slug as CategorySlug,
    status: row.status === 'coming_soon' ? 'coming-soon' : 'available',
    // Minor units → whole UAH; null stays null (coming-soon).
    price: row.price == null ? null : row.price / 100,
    sku: row.sku ?? undefined,
    brand: row.brand ?? undefined,
    coatings: coatings.length > 0 ? coatings : undefined,
    description: row.description ?? undefined,
    specs: Array.isArray(row.specs) ? (row.specs as ProductSpec[]) : undefined,
    tag: row.tag ?? undefined,
    tagGold: row.tagGold,
    rating: row.rating,
    reviewsCount: row.reviewsCount,
    imageUrl,
    images: images.length > 0 ? images : undefined,
  }
}
