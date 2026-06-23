/**
 * AURELIA — Product content readiness verification (Этап 71A)
 *
 * Proves the product content-readiness layer is honest + safe end-to-end:
 *   - PURE rules: every issue code fires on the right condition, with the right severity + the
 *     right level-blocking; placeholders are honest for local/buyer demo but a GAP for public
 *     demo / real sale; an EXPLICIT untracked-stock policy is allowed (never a blocker); and NO
 *     fake review/rating is ever required (absence of reviews is info, not a blocker).
 *   - PURE detectors: isSafeSlug, isPlaceholderDescription, countSpecs, productRowToReadinessInput.
 *   - SEO honesty (reuses src/lib/seo): meta description falls back when empty; Product JSON-LD
 *     carries NO aggregateRating without ≥1 approved review, and UAH offers only when priced.
 *   - AGGREGATION over REAL throwaway products (created + DELETED in `finally`): the data-layer
 *     row→input mapping + approved-review counting agree with the pure rules, and evaluating a
 *     product NEVER mutates it.
 *   - DASHBOARD attention (pure): a readiness blocker surfaces as a `warn` item → /admin/readiness.
 *
 * Server-only modules (readiness-data.ts) can't be imported under tsx, so the DB path MIRRORS the
 * data layer using the SAME pure helpers it uses (productRowToReadinessInput + evaluate). Works only
 * on throwaway `zzz-verify-readiness-` products, deleted in `finally` (images/variants/reviews
 * cascade with the product). No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:product-readiness
 */

import { PrismaClient } from '@prisma/client'
import {
  evaluateProductReadiness,
  productRowToReadinessInput,
  summarizeReadiness,
  isSafeSlug,
  isPlaceholderDescription,
  countSpecs,
  type ProductReadinessInput,
  type ReadinessIssueCode,
} from '../src/lib/product-readiness/rules'
import { buildAttentionQueue, type AttentionInput } from '../src/lib/admin/operations-dashboard'
import { productMetaDescription, buildProductJsonLd } from '../src/lib/seo/product-seo'
import type { Product } from '../src/lib/catalog/types'

const prisma = new PrismaClient()

let failures = 0
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    console.error(`  ✗ ${name}`)
    failures++
  }
}

/** A fully real-sale-ready product input — each test overrides only what it needs. */
function readyInput(over: Partial<ProductReadinessInput> = {}): ProductReadinessInput {
  return {
    name: 'Серьги-капля «Аврора»',
    slug: 'serogi-kaplya-avrora',
    categoryLabel: 'Серьги · позолота',
    status: 'available',
    isPublished: true,
    currency: 'UAH',
    price: 199000,
    stockQuantity: 10,
    sku: 'AU-1001',
    description: 'Лёгкие серьги-капли с гипоаллергенным позолоченным покрытием 585° пробы.',
    specCount: 3,
    realImageCount: 2,
    realGalleryCount: 1,
    primaryImageMissingAlt: false,
    hasDuplicateImageUrl: false,
    variantCount: 2,
    hasDefaultVariant: true,
    approvedReviewCount: 2,
    legacyRating: 4.5,
    ...over,
  }
}

const has = (codes: ReadinessIssueCode[], code: ReadinessIssueCode) => codes.includes(code)

const PRODUCT_PREFIX = 'zzz-verify-readiness-'
let seq = 0
const productSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
const createdProductIds: string[] = []

let categoryId = ''
let categoryName = ''

async function main() {
  // ── 1) Fully-ready product ──
  console.log('Fully-ready product:')
  const ready = evaluateProductReadiness(readyInput())
  check('no issues', ready.issues.length === 0)
  check('reached level = real_sale', ready.reachedLevel === 'real_sale')
  check('realSaleReady + publicDemoReady', ready.realSaleReady && ready.publicDemoReady)
  check('score 100', ready.score === 100)
  check('no photo gap', ready.hasPhotoGap === false)

  // ── 2) Placeholder photo = honest for demo, gap for public/sale ──
  console.log('Placeholder photo gap:')
  const placeholder = evaluateProductReadiness(readyInput({ realImageCount: 0, realGalleryCount: 0 }))
  const phCodes = placeholder.issues.map((i) => i.code)
  check('photo-gap issue present (warning)', has(phCodes, 'photo-gap') && placeholder.issues.find((i) => i.code === 'photo-gap')?.severity === 'warning')
  check('hasPhotoGap true', placeholder.hasPhotoGap)
  check('local + buyer demo still reachable (placeholders honest)', placeholder.reachedLevel === 'buyer_demo')
  check('public demo + real sale NOT ready (placeholder is a gap)', !placeholder.publicDemoReady && !placeholder.realSaleReady)

  // ── 3) Core data issues ──
  console.log('Core data issues:')
  check('missing category → blocker, below local demo', (() => { const r = evaluateProductReadiness(readyInput({ categoryLabel: '' })); return r.issues.some((i) => i.code === 'category-missing' && i.severity === 'blocker') && r.reachedLevel === null })())
  check('available without price → blocker, below local demo', (() => { const r = evaluateProductReadiness(readyInput({ price: null })); return r.issues.some((i) => i.code === 'price-missing-available' && i.severity === 'blocker') && r.reachedLevel === null })())
  check('coming_soon without price → NOT a price blocker', (() => { const r = evaluateProductReadiness(readyInput({ status: 'coming_soon', price: null })); return !r.issues.some((i) => i.code === 'price-missing-available') })())
  check('currency not UAH → warning blocking public demo', (() => { const r = evaluateProductReadiness(readyInput({ currency: 'USD' })); return r.issues.some((i) => i.code === 'currency-not-uah') && !r.publicDemoReady })())
  check('missing name → blocker', evaluateProductReadiness(readyInput({ name: '' })).issues.some((i) => i.code === 'name-missing'))
  check('short name → warning', evaluateProductReadiness(readyInput({ name: 'AB' })).issues.some((i) => i.code === 'name-short' && i.severity === 'warning'))
  check('unsafe slug → warning', evaluateProductReadiness(readyInput({ slug: 'Серьги Капля' })).issues.some((i) => i.code === 'slug-unsafe'))

  // ── 4) Description / specs ──
  console.log('Description & specs:')
  check('missing description → warning, meta falls back', (() => { const r = evaluateProductReadiness(readyInput({ description: null })); return r.issues.some((i) => i.code === 'description-missing') && !r.publicDemoReady })())
  check('placeholder description → warning', evaluateProductReadiness(readyInput({ description: 'lorem ipsum dolor sit amet' })).issues.some((i) => i.code === 'description-placeholder'))
  check('short (real) description → info blocking only real_sale', (() => { const r = evaluateProductReadiness(readyInput({ description: 'Короткое.' })); return r.issues.some((i) => i.code === 'description-short' && i.severity === 'info') && r.publicDemoReady && !r.realSaleReady })())
  check('no specs → info', evaluateProductReadiness(readyInput({ specCount: 0 })).issues.some((i) => i.code === 'specs-missing'))
  check('thin specs → info', evaluateProductReadiness(readyInput({ specCount: 1 })).issues.some((i) => i.code === 'specs-thin'))

  // ── 5) Images ──
  console.log('Image readiness:')
  check('duplicate image url → warning', evaluateProductReadiness(readyInput({ hasDuplicateImageUrl: true })).issues.some((i) => i.code === 'image-duplicate'))
  check('primary image missing alt → info', evaluateProductReadiness(readyInput({ realImageCount: 1, realGalleryCount: 0, primaryImageMissingAlt: true })).issues.some((i) => i.code === 'image-alt-missing'))
  check('single real photo → gallery-missing info', evaluateProductReadiness(readyInput({ realImageCount: 1, realGalleryCount: 0 })).issues.some((i) => i.code === 'gallery-missing'))

  // ── 6) Commerce + honesty ──
  console.log('Commerce & honesty:')
  check('variants without default → warning', evaluateProductReadiness(readyInput({ hasDefaultVariant: false })).issues.some((i) => i.code === 'variant-no-default'))
  check('missing sku → info', evaluateProductReadiness(readyInput({ sku: null })).issues.some((i) => i.code === 'sku-missing'))
  check('zero stock on available → warning blocking only real_sale', (() => { const r = evaluateProductReadiness(readyInput({ stockQuantity: 0 })); return r.issues.some((i) => i.code === 'stock-zero-available') && r.publicDemoReady && !r.realSaleReady })())
  check('UNTRACKED stock is an explicit policy → never blocks real_sale', (() => { const r = evaluateProductReadiness(readyInput({ stockQuantity: null })); return r.issues.some((i) => i.code === 'stock-untracked-available' && i.severity === 'info' && i.blocksFrom === null) && r.realSaleReady })())
  check('NO approved reviews → info only, never a blocker (no fake reviews required)', (() => { const r = evaluateProductReadiness(readyInput({ approvedReviewCount: 0, legacyRating: 0 })); return r.issues.some((i) => i.code === 'no-approved-reviews' && i.severity === 'info') && r.realSaleReady })())
  check('legacy rating but no approved reviews → warning (honest)', evaluateProductReadiness(readyInput({ approvedReviewCount: 0, legacyRating: 4.5 })).issues.some((i) => i.code === 'legacy-rating-no-reviews'))

  // ── 7) Pure detectors ──
  console.log('Pure detectors:')
  check('isSafeSlug ok', isSafeSlug('serogi-kaplya') && !isSafeSlug('Серьги') && !isSafeSlug('a b') && !isSafeSlug('-x-'))
  check('isPlaceholderDescription', isPlaceholderDescription('Lorem ipsum') && isPlaceholderDescription('заглушка') && !isPlaceholderDescription('Лёгкие серьги-капли из стали.'))
  check('countSpecs tolerates non-array', countSpecs([{ label: 'a', value: 'b' }]) === 1 && countSpecs(null) === 0 && countSpecs('x') === 0)
  check('productRowToReadinessInput maps images/variants/specs', (() => {
    const input = productRowToReadinessInput({
      name: 'X', slug: 'x', categoryLabel: 'C', status: 'available', isPublished: true, currency: 'UAH',
      price: 1000, stockQuantity: 5, sku: 'S', description: 'd', specs: [{ label: 'a', value: 'b' }], rating: 0,
      images: [
        { url: null, alt: null, isPrimary: false, position: 2 },
        { url: '/p.webp', alt: '', isPrimary: true, position: 0 },
        { url: '/g.webp', alt: 'g', isPrimary: false, position: 1 },
      ],
      variants: [{ isDefault: false }, { isDefault: true }],
      approvedReviewCount: 0,
    })
    return input.realImageCount === 2 && input.realGalleryCount === 1 && input.primaryImageMissingAlt === true &&
      input.variantCount === 2 && input.hasDefaultVariant === true && input.specCount === 1
  })())
  check('duplicate-url detection in mapper', (() => {
    const input = productRowToReadinessInput({
      name: 'X', slug: 'x', categoryLabel: 'C', status: 'available', isPublished: true, currency: 'UAH',
      price: 1000, stockQuantity: 5, sku: 'S', description: 'd', specs: [], rating: 0,
      images: [
        { url: '/same.webp', alt: 'a', isPrimary: true, position: 0 },
        { url: '/same.webp', alt: 'b', isPrimary: false, position: 1 },
      ],
      variants: [], approvedReviewCount: 0,
    })
    return input.hasDuplicateImageUrl === true
  })())

  // ── 8) SEO honesty (reuses src/lib/seo) ──
  console.log('SEO honesty:')
  check('meta description falls back when empty', productMetaDescription({ description: undefined }).length > 0 && productMetaDescription({ description: '  ' }).length > 0)
  const seoProduct = { name: 'X', slug: 'x', category: 'C', categorySlug: 'bijouterie', status: 'available', price: 1990, brand: 'AURELIA', sku: 'S', imageUrl: null } as unknown as Product
  const noRating = buildProductJsonLd(seoProduct, { average: 0, count: 0 })
  const withRating = buildProductJsonLd(seoProduct, { average: 4.5, count: 3 })
  check('JSON-LD: NO aggregateRating without approved reviews', !('aggregateRating' in noRating))
  check('JSON-LD: aggregateRating present with approved reviews', 'aggregateRating' in withRating)
  check('JSON-LD: UAH offer for a priced product', (() => { const o = noRating.offers as Record<string, unknown> | undefined; return !!o && o.priceCurrency === 'UAH' })())

  // ── 9) Aggregation over REAL throwaway products ──
  console.log('Aggregation over real products (created + deleted):')
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // p1: fully ready (real images + default variant + specs + approved review + a pending review).
  const p1 = await prisma.product.create({
    data: {
      slug: productSlug(), name: 'Аврора verify', categoryId, categoryLabel: categoryName, status: 'available',
      isPublished: true, currency: 'UAH', price: 199000, stockQuantity: 10, sku: 'AU-RDY-1',
      description: 'Лёгкие серьги-капли с гипоаллергенным позолоченным покрытием для повседневной носки.',
      specs: [{ label: 'Материал', value: 'Сталь' }, { label: 'Покрытие', value: 'Позолота' }, { label: 'Размер', value: '2 см' }],
      images: { create: [
        { position: 0, url: '/uploads/zzz-verify-p1-a.webp', alt: 'Серьги спереди', isPrimary: true },
        { position: 1, url: '/uploads/zzz-verify-p1-b.webp', alt: 'Серьги сбоку', isPrimary: false },
      ] },
      variants: { create: [
        { name: 'coating', value: 'Позолота', isDefault: true, sortOrder: 0 },
        { name: 'coating', value: 'Сталь', isDefault: false, sortOrder: 1 },
      ] },
      reviews: { create: [
        { authorName: 'Олена', rating: 5, body: 'Дуже гарні серьги, рекомендую!', status: 'approved' },
        { authorName: 'Спам', rating: 1, body: 'pending review', status: 'pending' },
      ] },
    },
    select: { id: true },
  })
  createdProductIds.push(p1.id)

  // p2: placeholder only (no real image), no specs, no reviews.
  const p2 = await prisma.product.create({
    data: {
      slug: productSlug(), name: 'Плейсхолдер verify', categoryId, categoryLabel: categoryName, status: 'available',
      isPublished: true, currency: 'UAH', price: 99000, stockQuantity: 5, sku: 'AU-PH-1',
      description: 'Просте кольцо зі сталі для щоденного образу та подарунку.',
      images: { create: [{ position: 0, url: null, alt: null, isPrimary: true }] },
    },
    select: { id: true },
  })
  createdProductIds.push(p2.id)

  // Mirror the data layer: read with the same shape + approved-review counts via a grouped query.
  const reviewGroups = await prisma.productReview.groupBy({
    by: ['productId'], where: { status: 'approved', productId: { in: [p1.id, p2.id] } }, _count: { _all: true },
  })
  const reviewCount = new Map(reviewGroups.map((g) => [g.productId, g._count._all]))

  const rows = await prisma.product.findMany({
    where: { id: { in: [p1.id, p2.id] } },
    select: {
      id: true, slug: true, name: true, categoryLabel: true, status: true, isPublished: true, currency: true,
      price: true, stockQuantity: true, sku: true, description: true, specs: true, rating: true,
      images: { select: { url: true, alt: true, isPrimary: true, position: true } },
      variants: { select: { isDefault: true } },
    },
  })

  const evaluated = new Map(rows.map((r) => {
    const input = productRowToReadinessInput({ ...r, approvedReviewCount: reviewCount.get(r.id) ?? 0 })
    return [r.id, evaluateProductReadiness(input)]
  }))

  check('approved-review count ignores pending (p1 → 1 approved)', reviewCount.get(p1.id) === 1)
  check('fully-stocked p1 is real-sale ready', evaluated.get(p1.id)?.realSaleReady === true)
  check('placeholder p2 has photo gap', evaluated.get(p2.id)?.hasPhotoGap === true)
  check('placeholder p2 reaches only buyer demo', evaluated.get(p2.id)?.reachedLevel === 'buyer_demo')

  const summary = summarizeReadiness([...evaluated.values()])
  check('summary: 1 of 2 real-sale ready', summary.realSaleReady === 1 && summary.total === 2)
  check('summary: 1 with photo gap', summary.withPhotoGap === 1)

  // Evaluating must NOT mutate the product.
  const p2After = await prisma.product.findUnique({ where: { id: p2.id }, select: { stockQuantity: true, description: true, price: true } })
  check('readiness check did NOT mutate the product', p2After?.stockQuantity === 5 && p2After?.price === 99000)

  // ── 10) Dashboard attention (pure) ──
  console.log('Dashboard attention:')
  const zero: AttentionInput = {
    orders: { submitted: 0, processing: 0 },
    reviews: { pending: 0 },
    email: { queued: 0, failed: 0 },
    promos: { exhausted: 0, expiringSoon: 0 },
    catalog: { withoutPrice: 0, withoutImage: 0, zeroStockPurchasable: 0, lowStockPurchasable: 0 },
    customers: { unverified: 0 },
    interests: { active: 0 },
  }
  const withBlockers = buildAttentionQueue({ ...zero, readiness: { realSaleBlockers: 3 } })
  check('readiness blocker → warn item → /admin/readiness?filter=blockers', withBlockers.some((i) => i.key === 'readiness-blockers' && i.severity === 'warn' && i.href === '/admin/readiness?filter=blockers' && i.count === 3))
  check('no readiness item when readiness omitted', buildAttentionQueue(zero).every((i) => i.key !== 'readiness-blockers'))
  const photoQueue = buildAttentionQueue({ ...zero, catalog: { withoutPrice: 0, withoutImage: 4, zeroStockPurchasable: 0, lowStockPurchasable: 0 } })
  check('photo-gap item links to /admin/readiness?filter=photo-gap', photoQueue.some((i) => i.key === 'catalog-noimage' && i.href === '/admin/readiness?filter=photo-gap'))

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: readiness rules (levels/severities/photo-gap/honesty), pure detectors, SEO honesty, real-product aggregation (no mutation), and dashboard attention all pass.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: delete every throwaway product (images/variants/reviews cascade). No reset/seed/drop.
    try {
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} product(s) (images/variants/reviews cascaded).`)
      const leftover = await prisma.product.count({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      if (leftover !== 0) console.error(`Cleanup WARNING: ${leftover} product row(s) remain.`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
