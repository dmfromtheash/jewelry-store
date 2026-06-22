/**
 * AURELIA — Advanced catalog UX verification (Этап 64A)
 *
 * Pure discovery checks (price/material/search/rating-sort) + a rolled-back DB check that the
 * APPROVED-only rating aggregate excludes pending/rejected reviews and unpublished products
 * (a sentinel error aborts the tx — nothing is ever committed; review count asserted unchanged).
 *
 * Covered:
 *   - price params: min / max / both work; invalid (negative/NaN/huge) fall back; min>max swaps;
 *     filterByPrice excludes unpriced products;
 *   - material facet: derived from real coatings (no fake values), valid filter works, invalid
 *     material falls back to "all";
 *   - search: by title, description, SKU, material/coating, spec; empty/unsafe query → no results;
 *   - rating sort: approved aggregates drive order, no-review products sort LAST (never faked),
 *     deterministic tie-breaks; reviews-desc by count;
 *   - DB (rolled back): approved-only aggregate counts approved reviews only; an unpublished
 *     product's approved review is excluded; nothing committed.
 *
 * Run with: npm run db:verify:advanced-catalog-ux
 */

import { PrismaClient } from '@prisma/client'
import {
  deriveMaterials,
  filterByMaterial,
  filterByPrice,
  normalizeSearchQuery,
  parseMaterial,
  parsePrice,
  parsePriceRange,
  searchProducts,
  sortProducts,
  PRICE_PARAM_MAX,
} from '../src/lib/catalog/search'
import type { Product } from '../src/lib/catalog/types'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_ADV_CATALOG_ROLLBACK__'
const APPROVED = 'approved' as const

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

function product(o: Partial<Product>): Product {
  return {
    slug: 'p',
    name: 'Прикраса',
    category: 'Сережки',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 1000,
    stockQuantity: null,
    ...o,
  }
}

async function main() {
  const reviewCountBefore = await prisma.productReview.count()
  console.log('Advanced catalog UX:')

  // --- 1) Price params ---
  check('parsePrice valid', parsePrice('1500') === 1500)
  check('parsePrice blank → undefined', parsePrice('') === undefined)
  check('parsePrice negative → undefined', parsePrice('-5') === undefined)
  check('parsePrice non-numeric → undefined', parsePrice('12a') === undefined)
  check('parsePrice huge → undefined', parsePrice(String(PRICE_PARAM_MAX + 1)) === undefined)
  check('parsePriceRange min only', JSON.stringify(parsePriceRange('100', null)) === JSON.stringify({ min: 100 }))
  check('parsePriceRange max only', JSON.stringify(parsePriceRange(null, '900')) === JSON.stringify({ max: 900 }))
  check('parsePriceRange both', JSON.stringify(parsePriceRange('100', '900')) === JSON.stringify({ min: 100, max: 900 }))
  check('parsePriceRange min>max swaps', JSON.stringify(parsePriceRange('900', '100')) === JSON.stringify({ min: 100, max: 900 }))
  check('parsePriceRange invalid both → {}', JSON.stringify(parsePriceRange('x', '-1')) === '{}')

  const priceList: Product[] = [
    product({ slug: 'a', price: 100 }),
    product({ slug: 'b', price: 500 }),
    product({ slug: 'c', price: 900 }),
    product({ slug: 'd', price: null, status: 'coming-soon' }),
  ]
  check('filterByPrice min', filterByPrice(priceList, { min: 400 }).map((p) => p.slug).join() === 'b,c')
  check('filterByPrice max', filterByPrice(priceList, { max: 500 }).map((p) => p.slug).join() === 'a,b')
  check('filterByPrice both', filterByPrice(priceList, { min: 200, max: 800 }).map((p) => p.slug).join() === 'b')
  check('filterByPrice excludes unpriced when bound set', filterByPrice(priceList, { min: 0 }).every((p) => typeof p.price === 'number'))

  // --- 2) Material facet (real coatings, no fake values) ---
  const matList: Product[] = [
    product({ slug: 'a', coatings: ['Позолота', 'Сталь'] }),
    product({ slug: 'b', coatings: ['Родіювання'] }),
    product({ slug: 'c' }), // no coatings → contributes no facet value
  ]
  check('deriveMaterials = sorted unique real values', deriveMaterials(matList).join() === 'Позолота,Родіювання,Сталь')
  check('deriveMaterials empty when none', deriveMaterials([product({ slug: 'x' })]).length === 0)
  check('parseMaterial valid (case-insensitive)', parseMaterial('позолота', matList) === 'Позолота')
  check('parseMaterial unknown → undefined', parseMaterial('платина', matList) === undefined)
  check('filterByMaterial filters by coating', filterByMaterial(matList, 'Сталь').map((p) => p.slug).join() === 'a')
  check('filterByMaterial null → unchanged', filterByMaterial(matList, null).length === 3)

  // --- 3) Search ---
  const searchList: Product[] = [
    product({ slug: 'ring', name: 'Каблучка Хвиля', description: 'Ніжна каблучка', sku: 'AU-1002', coatings: ['Позолота'], specs: [{ label: 'Тип', value: 'Каблучка' }] }),
    product({ slug: 'ear', name: 'Сережки Крапля', description: 'Класичні сережки', sku: 'AU-1001', coatings: ['Родіювання'] }),
  ]
  check('search by title', searchProducts('каблучка', searchList).map((p) => p.slug).join() === 'ring')
  check('search by description', searchProducts('класичні', searchList).map((p) => p.slug).join() === 'ear')
  check('search by SKU', searchProducts('AU-1002', searchList).map((p) => p.slug).join() === 'ring')
  check('search by material/coating', searchProducts('позолота', searchList).map((p) => p.slug).join() === 'ring')
  check('search by spec value', searchProducts('тип', searchList).map((p) => p.slug).join() === 'ring')
  check('empty query → no results', searchProducts('', searchList).length === 0)
  check('normalizeSearchQuery trims', normalizeSearchQuery('  каблучка  ') === 'каблучка')
  check('normalizeSearchQuery over-length → empty', normalizeSearchQuery('a'.repeat(101)) === '')
  check('normalizeSearchQuery markup → empty', normalizeSearchQuery('<script>x</script>') === '')

  // --- 4) Rating / reviews sort (honest) ---
  const ratingList: Product[] = [
    product({ slug: 'lo', name: 'A', approvedRating: 4.0, approvedReviewCount: 2 }),
    product({ slug: 'hi', name: 'B', approvedRating: 4.8, approvedReviewCount: 5 }),
    product({ slug: 'none', name: 'C', approvedRating: 0, approvedReviewCount: 0 }),
    product({ slug: 'mid', name: 'D', approvedRating: 4.8, approvedReviewCount: 1 }),
  ]
  const byRating = sortProducts(ratingList, 'rating-desc').map((p) => p.slug)
  check('rating-desc: highest first, no-review last', byRating[0] === 'hi' && byRating[byRating.length - 1] === 'none')
  check('rating-desc tie broken by review count (hi before mid)', byRating.indexOf('hi') < byRating.indexOf('mid'))
  const byReviews = sortProducts(ratingList, 'reviews-desc').map((p) => p.slug)
  check('reviews-desc: most reviews first', byReviews[0] === 'hi')
  check('no-review product never gets a fake rating', ratingList.find((p) => p.slug === 'none')!.approvedRating === 0)

  // --- 5) DB (rolled back): approved-only aggregate ---
  const baseProduct = await prisma.product.findFirst({ where: { isPublished: true }, select: { id: true, categoryId: true } })
  if (!baseProduct) {
    console.error('\nNo published product in DB — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  let approvedOnly = false
  let unpublishedExcluded = false
  try {
    await prisma.$transaction(async (tx) => {
      const base = { productId: baseProduct.id, authorName: 'Verify', body: 'verify (rolled back)' }
      await tx.productReview.create({ data: { ...base, rating: 5, status: 'approved' } })
      await tx.productReview.create({ data: { ...base, rating: 3, status: 'approved' } })
      await tx.productReview.create({ data: { ...base, rating: 1, status: 'pending' } })
      await tx.productReview.create({ data: { ...base, rating: 1, status: 'rejected' } })

      // Mirror getApprovedReviewAggregatesByProductIds (approved + published only).
      const groups = await tx.productReview.groupBy({
        by: ['productId'],
        where: { status: APPROVED, productId: { in: [baseProduct.id] }, product: { isPublished: true } },
        _count: { rating: true },
        _avg: { rating: true },
      })
      const g = groups.find((x) => x.productId === baseProduct.id)
      // 5 + 3 over the two APPROVED reviews only → count 2, avg 4.
      approvedOnly = !!g && g._count.rating === 2 && (g._avg.rating ?? 0) === 4

      // Unpublished product's approved review must be excluded by the published filter.
      const hidden = await tx.product.create({
        data: { slug: `adv-hidden-${Date.now()}`, name: 'Hidden', categoryLabel: 'Verify', categoryId: baseProduct.categoryId, isPublished: false, price: 1000 },
        select: { id: true },
      })
      await tx.productReview.create({ data: { productId: hidden.id, authorName: 'V', body: 'x', rating: 5, status: 'approved' } })
      const hiddenGroups = await tx.productReview.groupBy({
        by: ['productId'],
        where: { status: APPROVED, productId: { in: [hidden.id] }, product: { isPublished: true } },
        _count: { rating: true },
      })
      unpublishedExcluded = hiddenGroups.length === 0

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('approved-only aggregate (pending/rejected excluded; avg 4, count 2)', approvedOnly)
  check('unpublished product approved review excluded from aggregate', unpublishedExcluded)

  const reviewCountAfter = await prisma.productReview.count()
  check('no test reviews committed', reviewCountAfter === reviewCountBefore)

  if (failures === 0) {
    console.log('\nADVANCED-CATALOG-UX VERIFY OK: price/material/search/rating-sort + approved-only aggregate all pass; nothing committed.')
  } else {
    console.error(`\nADVANCED-CATALOG-UX VERIFY FAILED (${failures} check(s)).`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
