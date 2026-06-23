/**
 * AURELIA — Sitemap (Этап 72A)
 *
 * Next.js MetadataRoute sitemap served at /sitemap.xml. Lists ONLY public, crawlable storefront
 * routes: the home page, the static info pages, the two catalog categories, and every PUBLISHED +
 * AVAILABLE product (a real, sellable page). It deliberately excludes the admin area, the personal
 * account, the cart/checkout flow, the internal API, the personalised favorites page, the noisy
 * `/search` query surface, and any hidden / `coming_soon` product.
 *
 * Product rows come from the existing DB-backed catalog read (which is already published-only);
 * the eligibility filter additionally drops non-available products. Build/runtime safe: if the DB
 * read fails, the sitemap still returns the static routes rather than breaking the build.
 */

import type { MetadataRoute } from 'next'
import { getAllProductsFromDb } from '../src/lib/catalog/server'
import {
  STATIC_SITEMAP_ROUTES,
  absoluteUrl,
  isSitemapEligibleProduct,
  productSitemapPath,
} from '../src/lib/seo/site'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  const staticEntries: MetadataRoute.Sitemap = STATIC_SITEMAP_ROUTES.map((path) => ({
    url: absoluteUrl(path),
    lastModified: now,
  }))

  let productEntries: MetadataRoute.Sitemap = []
  try {
    const products = await getAllProductsFromDb()
    productEntries = products
      .filter(isSitemapEligibleProduct)
      .map((p) => ({ url: absoluteUrl(productSitemapPath(p.slug)), lastModified: now }))
  } catch {
    // DB unavailable → still return the static routes; never fail the build over the sitemap.
    productEntries = []
  }

  return [...staticEntries, ...productEntries]
}
