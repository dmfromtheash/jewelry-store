/**
 * AURELIA — SEO & marketing foundation verification (Этап 72A)
 *
 * Proves the SEO/marketing foundation is honest + safe end-to-end:
 *   - CANONICAL policy: query/hash stripped, trailing slash collapsed, root preserved; absolute
 *     URLs resolve against the configured/demo site origin.
 *   - SITEMAP eligibility: only published + available products with a real slug; hidden,
 *     `coming_soon`, and `coming-soon`-slug rows excluded. Static routes exclude admin/account/
 *     cart/checkout/api/favorites/search.
 *   - ROBOTS: admin/account/checkout/cart/api disallowed; sitemap referenced.
 *   - OPEN GRAPH images: a real product asset only — a placeholder yields NO image (never a fake).
 *   - STRUCTURED DATA honesty: Product JSON-LD keeps UAH offers + honest availability + NO
 *     aggregateRating without approved reviews; Organization carries no fabricated address/phone/
 *     payment/rating; WebSite SearchAction points at the real on-site search; BreadcrumbList is
 *     well-formed (1-based positions, last item has no URL).
 *   - SEO COVERAGE + BLOCKERS (pure): description/OG/slug counts; local-demo domain + missing
 *     brand OG asset + photo/description gaps surface as honest blockers.
 *   - AGGREGATION over REAL throwaway products (created + DELETED in `finally`): the data-layer
 *     row→coverage mapping agrees with the pure summary, and evaluating NEVER mutates a product.
 *
 * Server-only modules (seo-readiness-data.ts) can't be imported under tsx, so the DB path MIRRORS
 * the data layer using the SAME pure helpers it uses (productOgImages + summarizeProductSeo +
 * isSitemapEligibleProduct). Works only on throwaway `zzz-verify-seo-` products, deleted in
 * `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:seo-marketing
 */

import { PrismaClient } from '@prisma/client'
import {
  canonicalPath,
  absoluteUrl,
  isLocalDemoSiteUrl,
  isSitemapEligibleProduct,
  productSitemapPath,
  productOgImages,
  buildBreadcrumbJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  serializeJsonLd,
  STATIC_SITEMAP_ROUTES,
  ROBOTS_DISALLOW,
  SITE_URL,
  sitemapUrl,
} from '../src/lib/seo/site'
import { buildProductJsonLd } from '../src/lib/seo/product-seo'
import {
  summarizeProductSeo,
  buildSeoBlockers,
  siteUrlSignal,
  structuredDataCoverage,
  type SeoProductRow,
  type SiteUrlStatus,
} from '../src/lib/seo/seo-readiness'
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

const PRODUCT_PREFIX = 'zzz-verify-seo-'
let seq = 0
const productSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`

const seoProduct = (over: Partial<Product> = {}): Product =>
  ({
    name: 'X',
    slug: 'x',
    category: 'C',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 1990,
    brand: 'AURELIA',
    sku: 'S',
    imageUrl: null,
    ...over,
  }) as unknown as Product

async function main() {
  // ── 1) Canonical / absolute URL policy ──
  console.log('Canonical & URL policy:')
  check('strips query params', canonicalPath('/search?q=каблучка&sort=price') === '/search')
  check('strips hash', canonicalPath('/category/gifts#top') === '/category/gifts')
  check('collapses trailing slash', canonicalPath('/about/') === '/about')
  check('root preserved', canonicalPath('/') === '/' && canonicalPath('') === '/')
  check('absoluteUrl resolves against site origin (query stripped)', absoluteUrl('/product/x?ref=ad') === `${SITE_URL}/product/x`)
  check('absoluteUrl handles bare path', absoluteUrl('/about').startsWith('http') && absoluteUrl('/about').endsWith('/about'))

  // ── 2) Sitemap eligibility + static routes ──
  console.log('Sitemap eligibility:')
  check('published+available is eligible', isSitemapEligibleProduct({ slug: 'ring', status: 'available', isPublished: true }))
  check('coming_soon excluded', !isSitemapEligibleProduct({ slug: 'ring', status: 'coming_soon', isPublished: true }))
  check('unpublished excluded', !isSitemapEligibleProduct({ slug: 'ring', status: 'available', isPublished: false }))
  check('coming-soon slug excluded', !isSitemapEligibleProduct({ slug: 'coming-soon', status: 'available', isPublished: true }))
  check('empty slug excluded', !isSitemapEligibleProduct({ slug: '', status: 'available', isPublished: true }))
  check('static routes include home + categories + info', ['/', '/category/bijouterie', '/category/gifts', '/about', '/contacts', '/delivery', '/help', '/returns', '/stores'].every((r) => STATIC_SITEMAP_ROUTES.includes(r)))
  check('static routes EXCLUDE admin/account/cart/checkout/api/favorites/search', !STATIC_SITEMAP_ROUTES.some((r) => /^\/(admin|account|cart|checkout|api|favorites|search)/.test(r)))
  check('product sitemap path', productSitemapPath('serogi') === '/product/serogi')

  // ── 3) Robots policy ──
  console.log('Robots policy:')
  for (const p of ['/admin', '/account', '/checkout', '/cart', '/api/']) {
    check(`robots disallows ${p}`, ROBOTS_DISALLOW.includes(p))
  }
  check('robots does NOT disallow public storefront roots', !ROBOTS_DISALLOW.some((d) => ['/product', '/category', '/', '/about'].includes(d)))
  check('sitemap URL points at /sitemap.xml', sitemapUrl() === `${SITE_URL}/sitemap.xml`)

  // ── 4) Open Graph image honesty ──
  console.log('Open Graph image honesty:')
  check('real image → absolute OG url', (() => { const imgs = productOgImages({ imageUrl: '/uploads/products/p.webp' }); return imgs.length === 1 && imgs[0] === `${SITE_URL}/uploads/products/p.webp` })())
  check('placeholder/null image → NO og image (never a fake photo)', productOgImages({ imageUrl: null }).length === 0 && productOgImages({ imageUrl: '   ' }).length === 0)

  // ── 5) Product JSON-LD honesty (reuses src/lib/seo/product-seo) ──
  console.log('Product JSON-LD honesty:')
  const noRating = buildProductJsonLd(seoProduct(), { average: 0, count: 0 })
  const withRating = buildProductJsonLd(seoProduct(), { average: 4.5, count: 3 })
  check('NO aggregateRating without approved reviews', !('aggregateRating' in noRating))
  check('aggregateRating present with approved reviews', 'aggregateRating' in withRating)
  check('UAH offer for a priced product', (() => { const o = noRating.offers as Record<string, unknown> | undefined; return !!o && o.priceCurrency === 'UAH' })())
  check('availability InStock for available+priced+in-stock', (() => { const o = buildProductJsonLd(seoProduct({ stockQuantity: 5 }), { average: 0, count: 0 }).offers as Record<string, unknown>; return o.availability === 'https://schema.org/InStock' })())
  check('availability OutOfStock for zero stock', (() => { const o = buildProductJsonLd(seoProduct({ stockQuantity: 0 }), { average: 0, count: 0 }).offers as Record<string, unknown>; return o.availability === 'https://schema.org/OutOfStock' })())
  check('no offers without a price', !('offers' in buildProductJsonLd(seoProduct({ price: null }), { average: 0, count: 0 })))

  // ── 6) Organization / WebSite / Breadcrumb honesty ──
  console.log('Organization / WebSite / Breadcrumb:')
  const org = buildOrganizationJsonLd()
  check('Organization has no fabricated address/phone/payment/rating', !('address' in org) && !('telephone' in org) && !('paymentAccepted' in org) && !('aggregateRating' in org))
  check('Organization has name + url', org.name === 'AURELIA' && typeof org.url === 'string')
  const site = buildWebSiteJsonLd()
  const action = site.potentialAction as Record<string, unknown>
  check('WebSite SearchAction targets on-site /search?q=', typeof action.target === 'string' && (action.target as string).includes('/search?q={search_term_string}'))
  check('WebSite SearchAction declares query-input', action['query-input'] === 'required name=search_term_string')
  const crumbs = buildBreadcrumbJsonLd([
    { label: 'Головна', href: '/' },
    { label: 'Біжутерія', href: '/category/bijouterie' },
    { label: 'Серьги' },
  ])
  const items = (crumbs?.itemListElement ?? []) as Record<string, unknown>[]
  check('Breadcrumb positions are 1-based & ordered', items.length === 3 && items[0].position === 1 && items[2].position === 3)
  check('Breadcrumb last item has no URL (current page)', !('item' in items[2]) && items[0].item === `${SITE_URL}/`)
  check('Breadcrumb empty trail → null', buildBreadcrumbJsonLd([]) === null)

  // ── 6b) JSON-LD serialization escaping (Этап 76A — 75A finding F6) ──
  console.log('JSON-LD escaping (safe inline ld+json):')
  const LS = String.fromCharCode(0x2028) // line separator
  const PS = String.fromCharCode(0x2029) // paragraph separator
  const hostile = serializeJsonLd({ name: `</script><x>& done${LS}${PS}`, ok: 'plain spaces kept' })
  check('serializeJsonLd escapes "<" (no break-out)', !hostile.includes('<'))
  check('serializeJsonLd escapes ">"', !hostile.includes('>'))
  check('serializeJsonLd escapes "&"', !hostile.includes('&'))
  check('serializeJsonLd escapes U+2028/U+2029 line separators', !hostile.includes(LS) && !hostile.includes(PS))
  check('serializeJsonLd emits the \\u003c escape for "<"', hostile.includes('\\u003c'))
  check('serializeJsonLd round-trips to identical data', (() => {
    const parsed = JSON.parse(hostile) as Record<string, string>
    return parsed.name === `</script><x>& done${LS}${PS}` && parsed.ok === 'plain spaces kept'
  })())
  check('serializeJsonLd preserves ordinary whitespace (only separators escaped)', serializeJsonLd({ a: 'a b  c' }).includes('a b  c'))

  // ── 7) SEO coverage + blockers (pure) ──
  console.log('SEO coverage & blockers:')
  const rows: SeoProductRow[] = [
    { slug: 'ready', status: 'available', isPublished: true, descriptionLength: 120, hasRealImage: true },
    { slug: 'placeholder', status: 'available', isPublished: true, descriptionLength: 5, hasRealImage: false },
    { slug: 'soon', status: 'coming_soon', isPublished: true, descriptionLength: 80, hasRealImage: false },
    { slug: 'Bad Slug', status: 'available', isPublished: true, descriptionLength: 80, hasRealImage: true },
  ]
  const cov = summarizeProductSeo(rows)
  check('coverage total/indexable', cov.total === 4 && cov.indexable === 3)
  check('coverage description split', cov.withDescription === 3 && cov.missingDescription === 1)
  check('coverage OG image gap counts indexable placeholders only', cov.ogImageGap === 1)
  check('coverage slug issues (indexable only)', cov.slugIssues === 1)
  const localStatus: SiteUrlStatus = { url: 'http://localhost:5000', configured: false, localDemo: true }
  check('local-demo site URL → gap signal', siteUrlSignal(localStatus).status === 'gap')
  const blockers = buildSeoBlockers({ siteUrl: localStatus, coverage: cov, hasBrandOgAsset: false })
  check('blockers: no public domain', blockers.some((b) => b.key === 'no-public-domain'))
  check('blockers: no brand OG asset', blockers.some((b) => b.key === 'no-brand-og'))
  check('blockers: product photo gap', blockers.some((b) => b.key === 'product-photo-gap'))
  check('blockers: missing descriptions', blockers.some((b) => b.key === 'missing-descriptions'))
  const publicStatus: SiteUrlStatus = { url: 'https://aurelia.example', configured: true, localDemo: false }
  check('public domain → no "no-public-domain" blocker, ok signal', siteUrlSignal(publicStatus).status === 'ok' && !buildSeoBlockers({ siteUrl: publicStatus, coverage: { ...cov, ogImageGap: 0, missingDescription: 0, slugIssues: 0 }, hasBrandOgAsset: true }).some((b) => b.key === 'no-public-domain'))
  check('structured-data coverage all present', (() => { const sd = structuredDataCoverage(); return sd.organization && sd.website && sd.breadcrumb && sd.product })())
  check('site URL resolves & local-demo detector consistent', typeof SITE_URL === 'string' && isLocalDemoSiteUrl('http://localhost:5000') && !isLocalDemoSiteUrl('https://aurelia.example'))

  // ── 8) Aggregation over REAL throwaway products (created + deleted) ──
  console.log('Aggregation over real products (created + deleted):')
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  const categoryId = category.id
  const categoryName = category.name

  // p1: published available, REAL image + full description → eligible, no OG gap.
  const p1 = await prisma.product.create({
    data: {
      slug: productSlug(), name: 'SEO готовый verify', categoryId, categoryLabel: categoryName, status: 'available',
      isPublished: true, currency: 'UAH', price: 199000, stockQuantity: 10, sku: 'AU-SEO-1',
      description: 'Лёгкие серьги-капли с гипоаллергенным позолоченным покрытием для повседневной носки.',
      images: { create: [{ position: 0, url: '/uploads/zzz-seo-p1.webp', alt: 'Серьги', isPrimary: true }] },
    },
    select: { id: true },
  })
  // p2: published available, PLACEHOLDER image (url null) + short description → eligible, OG gap.
  const p2 = await prisma.product.create({
    data: {
      slug: productSlug(), name: 'SEO плейсхолдер verify', categoryId, categoryLabel: categoryName, status: 'available',
      isPublished: true, currency: 'UAH', price: 99000, stockQuantity: 5, sku: 'AU-SEO-2', description: 'Кольцо.',
      images: { create: [{ position: 0, url: null, alt: null, isPrimary: true }] },
    },
    select: { id: true },
  })
  // p3: published coming_soon → NOT eligible.
  const p3 = await prisma.product.create({
    data: { slug: productSlug(), name: 'SEO скоро verify', categoryId, categoryLabel: categoryName, status: 'coming_soon', isPublished: true, currency: 'UAH', price: null, sku: 'AU-SEO-3' },
    select: { id: true },
  })
  // p4: hidden available → NOT eligible.
  const p4 = await prisma.product.create({
    data: { slug: productSlug(), name: 'SEO скрытый verify', categoryId, categoryLabel: categoryName, status: 'available', isPublished: false, currency: 'UAH', price: 50000, stockQuantity: 3, sku: 'AU-SEO-4', description: 'Скрытый товар для проверки.' },
    select: { id: true },
  })
  const ids = [p1.id, p2.id, p3.id, p4.id]

  // Mirror seo-readiness-data: read rows + derive the SAME safe projection via the SAME helpers.
  const dbRows = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: {
      slug: true, status: true, isPublished: true, description: true,
      images: { select: { url: true, isPrimary: true, position: true }, orderBy: { position: 'asc' } },
    },
  })
  const mirroredRows: SeoProductRow[] = dbRows.map((r) => {
    const primary = r.images.find((i) => i.isPrimary) ?? r.images[0]
    return {
      slug: r.slug,
      status: r.status,
      isPublished: r.isPublished,
      descriptionLength: (r.description ?? '').trim().length,
      hasRealImage: productOgImages({ imageUrl: primary?.url ?? null }).length > 0,
    }
  })
  const eligibleCount = dbRows.filter((r) => isSitemapEligibleProduct({ slug: r.slug, status: r.status, isPublished: r.isPublished })).length
  check('exactly 2 of 4 throwaway products are sitemap-eligible (p1, p2)', eligibleCount === 2)
  const mirroredCov = summarizeProductSeo(mirroredRows)
  check('data-layer mirror: indexable === 2', mirroredCov.indexable === 2)
  check('data-layer mirror: 1 OG-image gap (p2 placeholder)', mirroredCov.ogImageGap === 1)
  check('data-layer mirror: exactly 1 product has a real OG image (p1)', mirroredRows.filter((r) => r.hasRealImage).length === 1)

  // Evaluating must NOT mutate a product.
  const p2After = await prisma.product.findUnique({ where: { id: p2.id }, select: { description: true, price: true, isPublished: true } })
  check('SEO read did NOT mutate the product', p2After?.price === 99000 && p2After?.isPublished === true && p2After?.description === 'Кольцо.')

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: canonical/sitemap/robots policy, honest OG images, Product/Organization/WebSite/Breadcrumb structured data, SEO coverage + blockers, and real-product aggregation (no mutation) all pass.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: delete every throwaway product (images cascade). No reset/seed/drop.
    try {
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} product(s) (images cascaded).`)
      const leftover = await prisma.product.count({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      if (leftover !== 0) console.error(`Cleanup WARNING: ${leftover} product row(s) remain.`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
