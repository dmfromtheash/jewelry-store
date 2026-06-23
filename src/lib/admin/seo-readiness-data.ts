/**
 * AURELIA — SEO & marketing readiness data layer (Этап 72A) — server-only
 *
 * Server-only Prisma reads for the /admin/seo view. READ-ONLY: it never mutates anything, never
 * touches availability/checkout, and never selects a secret / token / cookie / PII. It projects a
 * few safe counts per product (description LENGTH only — never the text, slug, real-image flag,
 * status) and hands them to the PURE summary in src/lib/seo/seo-readiness.ts.
 *
 * Scale: the catalog is demo-scale (a few hundred products). One bounded query reads the rows;
 * the OG-image "real photo" check reuses the same honest policy the storefront uses.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import {
  SITE_URL,
  STATIC_SITEMAP_ROUTES,
  ROBOTS_DISALLOW,
  isLocalDemoSiteUrl,
  isSitemapEligibleProduct,
  productOgImages,
  sitemapUrl,
} from '../seo/site'
import {
  buildMarketingReadinessNotes,
  buildSeoBlockers,
  siteUrlSignal,
  structuredDataCoverage,
  summarizeProductSeo,
  type MarketingNote,
  type ProductSeoCoverage,
  type SeoSignal,
  type SiteUrlStatus,
  type StructuredDataCoverage,
} from '../seo/seo-readiness'

const PRODUCT_LIMIT = 1000

/** Whether a brand-level OG asset is configured. None exists yet — honest gap. */
const HAS_BRAND_OG_ASSET = false

export interface SeoReadinessOverview {
  siteUrl: SiteUrlStatus
  siteUrlSignal: SeoSignal
  sitemap: { url: string; staticRoutes: number; productRoutes: number; totalRoutes: number }
  robots: { disallow: string[]; sitemapReferenced: boolean }
  coverage: ProductSeoCoverage
  structuredData: StructuredDataCoverage
  blockers: SeoSignal[]
  marketing: MarketingNote[]
  hasBrandOgAsset: boolean
}

/**
 * Builds the SEO/marketing readiness overview from REAL catalog data + the build's static SEO
 * facts (sitemap/robots/structured-data). Deliberately UNFILTERED by visibility so hidden products
 * are still counted in `total` (the coverage summary marks only published+available as indexable).
 */
export async function getSeoReadinessOverview(): Promise<SeoReadinessOverview> {
  const rows = await prisma.product.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: PRODUCT_LIMIT,
    select: {
      slug: true,
      status: true,
      isPublished: true,
      description: true,
      images: { select: { url: true, isPrimary: true, position: true }, orderBy: { position: 'asc' } },
    },
  })

  const seoRows = rows.map((r) => {
    // Real primary image = the honest OG-image policy: an uploaded, non-empty primary/first asset.
    const primary = r.images.find((i) => i.isPrimary) ?? r.images[0]
    const hasRealImage = productOgImages({ imageUrl: primary?.url ?? null }).length > 0
    return {
      slug: r.slug,
      status: r.status,
      isPublished: r.isPublished,
      descriptionLength: (r.description ?? '').trim().length,
      hasRealImage,
    }
  })

  const coverage = summarizeProductSeo(seoRows)

  const productRoutes = rows.filter((r) =>
    isSitemapEligibleProduct({ slug: r.slug, status: r.status, isPublished: r.isPublished }),
  ).length
  const staticRoutes = STATIC_SITEMAP_ROUTES.length

  const siteUrl: SiteUrlStatus = {
    url: SITE_URL,
    configured: (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim().length > 0,
    localDemo: isLocalDemoSiteUrl(SITE_URL),
  }

  return {
    siteUrl,
    siteUrlSignal: siteUrlSignal(siteUrl),
    sitemap: {
      url: sitemapUrl(),
      staticRoutes,
      productRoutes,
      totalRoutes: staticRoutes + productRoutes,
    },
    robots: { disallow: [...ROBOTS_DISALLOW], sitemapReferenced: true },
    coverage,
    structuredData: structuredDataCoverage(),
    blockers: buildSeoBlockers({ siteUrl, coverage, hasBrandOgAsset: HAS_BRAND_OG_ASSET }),
    marketing: buildMarketingReadinessNotes(),
    hasBrandOgAsset: HAS_BRAND_OG_ASSET,
  }
}
