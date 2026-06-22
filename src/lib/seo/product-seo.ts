/**
 * AURELIA — Product/catalog SEO helpers (Этап 62A)
 *
 * Pure, dependency-free builders for product/category metadata + Product JSON-LD.
 * No Prisma, no React, no `server-only` — safe to import from server components AND
 * the verify script. The storefront stays Ukrainian; prices are whole UAH.
 *
 * Honesty rules (must never drift):
 *   - `aggregateRating` is emitted ONLY when there is ≥1 APPROVED review. A product
 *     with no approved reviews carries NO rating in its structured data — we never
 *     fabricate a rating or review count.
 *   - `offers` are emitted only for a really-priced product, with currency UAH and an
 *     availability derived from the shared purchasability policy (no payment provider
 *     is implied — this is catalog metadata only).
 */

import { isProductPurchasable } from '../catalog/availability'
import type { Product } from '../catalog/types'
import type { ReviewSummary } from '../reviews/types'

/** schema.org currency code for the storefront. */
export const SEO_CURRENCY = 'UAH'

const DEFAULT_DESCRIPTION = 'Прикраса AURELIA — біжутерія без меж.'

/** Canonical storefront path for a product (relative; resolved via metadataBase). */
export function productCanonicalPath(slug: string): string {
  return `/product/${slug}`
}

/** A safe, non-empty product description for meta tags. */
export function productMetaDescription(product: Pick<Product, 'description'>): string {
  const d = (product.description ?? '').trim()
  return d.length > 0 ? d : DEFAULT_DESCRIPTION
}

export interface ProductMetaParts {
  title: string
  description: string
  canonical: string
  /** Absolute-or-relative image URL when an asset exists; else undefined. */
  image?: string
}

/**
 * Builds the plain metadata parts for a product PDP. Pure + total: never throws on a
 * sparse product (missing description/image just fall back). The route's
 * `generateMetadata` maps these onto the Next `Metadata` object (title/OG/canonical).
 */
export function buildProductMetaParts(product: Product): ProductMetaParts {
  return {
    title: `${product.name} — AURELIA`,
    description: productMetaDescription(product),
    canonical: productCanonicalPath(product.slug),
    image: product.imageUrl ?? undefined,
  }
}

/** schema.org Offer availability URL for a product. */
function availabilityUrl(product: Product): string {
  return isProductPurchasable(product)
    ? 'https://schema.org/InStock'
    : 'https://schema.org/OutOfStock'
}

/**
 * Builds a schema.org Product JSON-LD object. `aggregateRating` is included ONLY when
 * `summary.count > 0`; `offers` only when the product has a real price. Returns a
 * plain JSON-serializable object (the caller stringifies it into a ld+json script).
 */
export function buildProductJsonLd(
  product: Product,
  summary: ReviewSummary,
): Record<string, unknown> {
  const jsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: productMetaDescription(product),
    brand: { '@type': 'Brand', name: product.brand ?? 'AURELIA' },
  }

  if (product.sku) jsonLd.sku = product.sku
  if (product.imageUrl) jsonLd.image = product.imageUrl

  // Offers only for a really-priced product (whole UAH). No payment provider implied.
  if (typeof product.price === 'number') {
    jsonLd.offers = {
      '@type': 'Offer',
      price: product.price.toString(),
      priceCurrency: SEO_CURRENCY,
      availability: availabilityUrl(product),
    }
  }

  // Honest: NEVER emit a rating without at least one approved review.
  if (summary.count > 0) {
    jsonLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: summary.average.toString(),
      reviewCount: summary.count,
      bestRating: '5',
      worstRating: '1',
    }
  }

  return jsonLd
}
