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

import type {
  CategorySlug,
  Product,
  ProductImageRef,
  ProductSpec,
  ProductVariantRef,
} from './types'

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
  /** Optional in fixtures; real catalog rows always include it (Этап 28B). */
  stockQuantity?: number | null
  sku: string | null
  brand: string | null
  description: string | null
  tag: string | null
  tagGold: boolean
  rating: number
  reviewsCount: number
  specs: unknown
  category: { slug: string }
  /** Variant rows. The legacy `coating` flattening only needs name/value/sortOrder;
   *  the optional 30D fields (id/isDefault/priceDelta/stockQuantity/sku) drive the
   *  storefront selector. They are optional so older fixtures keep compiling. */
  variants: {
    name: string
    value: string
    sortOrder: number
    id?: string
    isDefault?: boolean
    priceDelta?: number | null
    stockQuantity?: number | null
    sku?: string | null
  }[]
  /** Optional — only mapped when the catalog query includes images. */
  images?: DbProductImageForMapping[]
}

export function mapDbProductToProduct(row: DbProductForMapping): Product {
  const coatings = row.variants
    .filter((v) => v.name === 'coating')
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((v) => v.value)

  // Full variant refs for the storefront selector (Этап 30D). Only mapped when
  // the rows carry an `id` (real catalog query); price delta is converted from DB
  // minor units → whole UAH to match Product.price. Ordered like the default
  // policy (sortOrder, then value).
  const variantRefs: ProductVariantRef[] = row.variants
    .filter((v): v is typeof v & { id: string } => typeof v.id === 'string')
    .sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value))
    .map((v) => ({
      id: v.id,
      name: v.name,
      value: v.value,
      isDefault: v.isDefault ?? false,
      sortOrder: v.sortOrder,
      priceDelta: v.priceDelta == null ? null : v.priceDelta / 100,
      stockQuantity: v.stockQuantity ?? null,
      sku: v.sku ?? undefined,
    }))

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
    // Stock passes through unchanged (null = not tracked, Этап 28B).
    stockQuantity: row.stockQuantity ?? null,
    sku: row.sku ?? undefined,
    brand: row.brand ?? undefined,
    coatings: coatings.length > 0 ? coatings : undefined,
    variants: variantRefs.length > 0 ? variantRefs : undefined,
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
