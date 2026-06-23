/**
 * AURELIA — robots.txt (Этап 72A)
 *
 * Next.js MetadataRoute robots served at /robots.txt. Public storefront content is crawlable;
 * the admin area, the personal account, the cart/checkout flow, and the internal API are
 * disallowed. References the sitemap and declares the canonical host. Honest for the current
 * local/demo state — it claims no production deployment (the host is whatever the configured or
 * fallback site URL resolves to).
 */

import type { MetadataRoute } from 'next'
import { ROBOTS_DISALLOW, SITE_URL, sitemapUrl } from '../src/lib/seo/site'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...ROBOTS_DISALLOW],
    },
    sitemap: sitemapUrl(),
    host: SITE_URL,
  }
}
