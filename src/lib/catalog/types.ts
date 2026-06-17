/**
 * AURELIA — Catalog types (Этап 8A)
 *
 * Minimal frontend-only product model for the mock catalog. No backend, API
 * or DB: products live in src/data/products.ts and are read through the pure
 * helpers in src/lib/catalog/index.ts.
 */

export type ProductStatus = 'available' | 'coming-soon'

export type CategorySlug = 'bijouterie' | 'gifts'

export interface ProductSpec {
  label: string
  value: string
}

/** A real product image (only present once an asset has been uploaded). */
export interface ProductImageRef {
  /** Relative public URL, e.g. "/uploads/products/<id>.webp". */
  url: string
  alt?: string
}

export interface Product {
  /** unique URL id — latin only, used for /product/[slug] */
  slug: string
  name: string
  /** storefront caption, e.g. "Серьги · позолота" */
  category: string
  categorySlug: CategorySlug
  status: ProductStatus
  /** RUB; null/undefined renders the "— ₽" coming-soon state */
  price?: number | null
  sku?: string
  /** own placeholder brand — always AURELIA for now */
  brand?: string
  /** coating variant labels */
  coatings?: string[]
  description?: string
  specs?: ProductSpec[]
  /** Primary image URL (first/primary uploaded asset). Absent → placeholder. */
  imageUrl?: string | null
  /** All uploaded images in display order. Absent/empty → placeholder. */
  images?: ProductImageRef[]
  /** card badge, e.g. "New" / "Хит" */
  tag?: string
  /** gold badge variant (otherwise dark) */
  tagGold?: boolean
  rating?: number
  reviewsCount?: number
}
