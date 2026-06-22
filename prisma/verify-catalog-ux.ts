/**
 * AURELIA — Catalog UX / SEO verification (Этап 62A)
 *
 * Pure, dependency-free checks (no DB writes) for the catalog-UX superblock:
 *   - rating honesty: an empty approved-review set summarises to 0/0 (the PDP then shows
 *     "Ще немає відгуків" — never a fabricated 5-star), and a non-empty set yields the
 *     correct average/count;
 *   - SEO JSON-LD: NO aggregateRating without ≥1 approved review; offers carry price +
 *     currency UAH; availability reflects the purchasability policy;
 *   - product metadata builder is total (no throw) on a sparse product + falls back to a
 *     non-empty description;
 *   - sort/filter: price asc/desc order, newest-by-createdAt, invalid sort/status params
 *     fall back safely, and the "available" filter excludes non-available products.
 *
 * Run with: npm run db:verify:catalog-ux
 */

import { summarizeRatings } from '../src/lib/reviews/validate'
import {
  buildProductJsonLd,
  buildProductMetaParts,
  SEO_CURRENCY,
} from '../src/lib/seo/product-seo'
import {
  filterByStatus,
  parseSort,
  parseStatus,
  sortProducts,
} from '../src/lib/catalog/search'
import type { Product } from '../src/lib/catalog/types'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

function product(overrides: Partial<Product>): Product {
  return {
    slug: 'p',
    name: 'Прикраса',
    category: 'Сережки',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 1000,
    stockQuantity: null,
    ...overrides,
  }
}

function main() {
  console.log('Catalog UX / SEO:')

  // --- 1) Rating honesty ---
  check('no approved reviews → summary 0/0', summarizeRatings([]).count === 0 && summarizeRatings([]).average === 0)
  const summ = summarizeRatings([5, 4])
  check('approved reviews → correct average/count', summ.count === 2 && summ.average === 4.5)

  // --- 2) JSON-LD ---
  const noReview = buildProductJsonLd(product({ price: 2490, sku: 'AU-1' }), { average: 0, count: 0 })
  check('JSON-LD omits aggregateRating when no approved reviews', !('aggregateRating' in noReview))
  check('JSON-LD has offers with UAH currency when priced', !!noReview.offers && (noReview.offers as Record<string, unknown>).priceCurrency === SEO_CURRENCY)
  check('JSON-LD offer price is the whole-UAH price', (noReview.offers as Record<string, unknown>).price === '2490')
  check('JSON-LD available product → InStock', (noReview.offers as Record<string, unknown>).availability === 'https://schema.org/InStock')

  const withReview = buildProductJsonLd(product({}), { average: 4.5, count: 2 })
  const agg = withReview.aggregateRating as Record<string, unknown> | undefined
  check('JSON-LD includes aggregateRating when approved reviews exist', !!agg && agg.reviewCount === 2 && agg.ratingValue === '4.5')

  const outOfStock = buildProductJsonLd(product({ stockQuantity: 0 }), { average: 0, count: 0 })
  check('JSON-LD out-of-stock product → OutOfStock', (outOfStock.offers as Record<string, unknown>).availability === 'https://schema.org/OutOfStock')

  const comingSoon = buildProductJsonLd(product({ status: 'coming-soon', price: null }), { average: 0, count: 0 })
  check('JSON-LD coming-soon (no price) → no offers', !('offers' in comingSoon))

  // --- 3) Metadata builder is total ---
  const sparse = buildProductMetaParts(product({ description: undefined, imageUrl: undefined }))
  check('metadata: title built', sparse.title.includes('AURELIA'))
  check('metadata: description falls back (non-empty)', sparse.description.length > 0)
  check('metadata: canonical path is /product/<slug>', sparse.canonical === '/product/p')
  check('metadata: no image when none uploaded', sparse.image === undefined)

  // --- 4) Sort / filter ---
  const list: Product[] = [
    product({ slug: 'a', price: 300, status: 'coming-soon', createdAt: '2026-01-01T00:00:00.000Z' }),
    product({ slug: 'b', price: 100, createdAt: '2026-03-01T00:00:00.000Z' }),
    product({ slug: 'c', price: 200, createdAt: '2026-02-01T00:00:00.000Z' }),
  ]
  const asc = sortProducts(list, 'price-asc').map((p) => p.price)
  check('sort price-asc orders ascending', asc[0] === 100 && asc[2] === 300)
  const desc = sortProducts(list, 'price-desc').map((p) => p.price)
  check('sort price-desc orders descending', desc[0] === 300 && desc[2] === 100)
  const newest = sortProducts(list, 'new').map((p) => p.slug)
  check('sort new orders by createdAt desc', newest[0] === 'b' && newest[2] === 'a')

  check('parseSort invalid → recommended', parseSort('bogus') === 'recommended')
  check('parseSort valid passes through', parseSort('price-asc') === 'price-asc')
  check('parseStatus invalid → all', parseStatus('💥') === 'all')
  check('parseStatus valid passes through', parseStatus('available') === 'available')

  const available = filterByStatus(list, 'available')
  check('available filter excludes non-available products', available.length === 2 && available.every((p) => p.status === 'available'))

  if (failures === 0) {
    console.log('\nCATALOG-UX VERIFY OK: rating honesty, JSON-LD, metadata + sort/filter all pass.')
  } else {
    console.error(`\nCATALOG-UX VERIFY FAILED (${failures} check(s)).`)
    process.exitCode = 1
  }
}

main()
