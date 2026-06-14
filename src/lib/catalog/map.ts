/**
 * AURELIA — DB → frontend Product mapping (Этап 15D)
 *
 * Pure mapping from a Prisma product row (with category + coating variants) to
 * the frontend `Product` shape used across the storefront. No Prisma client and
 * no `server-only` import here, so this module is safe to use from the server
 * catalog layer AND from the runtime verify script.
 *
 * Conversions applied here (the storefront contract):
 *   - price: integer MINOR units (kopecks) in the DB → whole RUB for the UI
 *   - status: Prisma enum `coming_soon` → frontend `'coming-soon'`
 *   - coatings: `coating` variants (ordered) → `string[]`
 *   - categoryLabel → `category`; category.slug → `categorySlug`
 *   - specs JSON → `ProductSpec[]`
 */

import type { CategorySlug, Product, ProductSpec } from './types'

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
}

export function mapDbProductToProduct(row: DbProductForMapping): Product {
  const coatings = row.variants
    .filter((v) => v.name === 'coating')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.value)

  return {
    slug: row.slug,
    name: row.name,
    category: row.categoryLabel,
    categorySlug: row.category.slug as CategorySlug,
    status: row.status === 'coming_soon' ? 'coming-soon' : 'available',
    // Minor units (kopecks) → whole RUB; null stays null (coming-soon).
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
  }
}
