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

/**
 * A selectable product variant for the storefront (Этап 30D). Mirrors the
 * orderable subset of the DB ProductVariant the customer can pick. `priceDelta`
 * is in WHOLE UAH here (same unit as `Product.price`), already converted from the
 * DB minor units by the mapper. The server stays authoritative on price/stock.
 */
export interface ProductVariantRef {
  id: string
  /** Attribute group, e.g. "coating". */
  name: string
  /** Attribute value shown on the selector, e.g. "Позолота". */
  value: string
  isDefault: boolean
  sortOrder: number
  /** UAH added to the product price; null/0 = same as product price. */
  priceDelta?: number | null
  /** null = not tracked (falls back to product stock); 0 = out of stock. */
  stockQuantity?: number | null
  sku?: string
}

export interface Product {
  /** unique URL id — latin only, used for /product/[slug] */
  slug: string
  name: string
  /** storefront caption, e.g. "Серьги · позолота" */
  category: string
  categorySlug: CategorySlug
  status: ProductStatus
  /** UAH; null/undefined renders the "— ₴" coming-soon state */
  price?: number | null
  /** Product-level stock (Этап 28B): null = not tracked, 0 = out of stock,
   *  >0 = in stock. Used by the purchasability policy (isProductPurchasable). */
  stockQuantity?: number | null
  sku?: string
  /** own placeholder brand — always AURELIA for now */
  brand?: string
  /** coating variant labels */
  coatings?: string[]
  /** Selectable variants (Этап 30D). Absent/empty → product sold as-is (no
   *  selector); the storefront keeps the exact pre-30D behaviour. */
  variants?: ProductVariantRef[]
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
