/**
 * AURELIA — Site-level SEO foundation (Этап 72A)
 *
 * Pure, dependency-free SEO primitives shared by the storefront routes (layout / home /
 * product / category), the sitemap + robots routes, the admin SEO-readiness view, and the
 * verify script. NO Prisma, NO React, NO `server-only` — so the exact same canonical/OG/
 * structured-data logic that ships to users is asserted by `db:verify:seo-marketing`.
 *
 * Honesty rules (must never drift):
 *   - The site URL is the PUBLIC `NEXT_PUBLIC_SITE_URL` when configured (it is NOT a secret),
 *     else a clearly-marked local/demo fallback. We never claim a production domain we do not
 *     have.
 *   - Canonicals are clean PATHS (query strings stripped) so noisy filter/search combinations
 *     never spawn duplicate indexable URLs.
 *   - Open Graph images use a real product asset ONLY. There is NO brand OG asset yet, so when a
 *     product has no real photo we emit NO image — we never fall back to a placeholder or invent
 *     a photo.
 *   - Organization / WebSite / Breadcrumb structured data carry only generic, true fields. No
 *     address, phone, payment, rating, or availability is fabricated.
 */

/** The local/demo fallback used when no public site URL is configured. */
export const DEMO_SITE_URL = 'http://localhost:5000'

/** The storefront brand name used across structured data. */
export const SITE_NAME = 'AURELIA'

/**
 * Resolves the public site origin (no trailing slash). Reads `NEXT_PUBLIC_SITE_URL` (public,
 * not a secret); falls back to the documented local/demo origin. Guarded so a malformed value
 * can never throw at build/render time.
 */
export function resolveSiteUrl(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim() || DEMO_SITE_URL
  try {
    const u = new URL(raw)
    return u.origin
  } catch {
    return DEMO_SITE_URL
  }
}

/** The resolved site origin for the current process. */
export const SITE_URL = resolveSiteUrl()

/** A `URL` for Next's `metadataBase`, or undefined if (impossibly) unparseable. */
export function metadataBaseUrl(): URL | undefined {
  try {
    return new URL(SITE_URL)
  } catch {
    return undefined
  }
}

/** True when the resolved site URL is the local/demo fallback (no real public domain yet). */
export function isLocalDemoSiteUrl(url: string = SITE_URL): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase()
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local')
  } catch {
    return true
  }
}

/**
 * Normalises a path into a clean canonical PATH: keeps the pathname (no query, no hash),
 * collapses a trailing slash (except root). Pure + total — accepts a bare path or a full URL.
 */
export function canonicalPath(input: string): string {
  let pathname = input
  try {
    // Resolve against the site origin so a full URL OR a bare path both work.
    pathname = new URL(input, SITE_URL).pathname
  } catch {
    // Strip a query/hash manually if URL parsing fails for an odd input.
    pathname = input.split('#')[0].split('?')[0] || '/'
  }
  if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.replace(/\/+$/, '')
  return pathname || '/'
}

/** Absolute URL for a path, resolved against the site origin (query stripped → canonical). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${canonicalPath(path)}`
}

// ── Sitemap eligibility ────────────────────────────────────────────────────────────────────

/**
 * Static, always-crawlable public routes for the sitemap. Deliberately EXCLUDES transactional /
 * personal / internal areas (admin, account, cart, checkout, api, favorites) and noisy query
 * surfaces (search). The product detail pages are added dynamically from the DB.
 */
export const STATIC_SITEMAP_ROUTES: readonly string[] = [
  '/',
  '/category/bijouterie',
  '/category/gifts',
  '/about',
  '/contacts',
  '/delivery',
  '/help',
  '/returns',
  '/stores',
]

/** The minimal product shape the sitemap eligibility check needs. */
export interface SitemapProductLike {
  slug: string
  status: string
  /** Optional: storefront reads are already published-only, but we double-check when present. */
  isPublished?: boolean
}

/**
 * A product is sitemap-eligible only when it is published AND available (a real, sellable page).
 * Hidden, `coming_soon`, and slug-less rows are excluded so the sitemap never advertises a page
 * a crawler would find empty/404 or a not-yet-purchasable product.
 */
export function isSitemapEligibleProduct(p: SitemapProductLike): boolean {
  if (!p.slug || p.slug === 'coming-soon') return false
  if (p.isPublished === false) return false
  return p.status === 'available'
}

/** Canonical sitemap path for a product. */
export function productSitemapPath(slug: string): string {
  return `/product/${slug}`
}

// ── Robots policy ──────────────────────────────────────────────────────────────────────────

/**
 * Paths a crawler must never index: the admin area, personal account, the cart/checkout flow,
 * and internal API. Public storefront content is allowed by default. Search is left crawlable
 * but its result pages carry `noindex` at the route level to avoid noisy query combinations.
 */
export const ROBOTS_DISALLOW: readonly string[] = ['/admin', '/account', '/checkout', '/cart', '/api/']

/** Absolute URL of the sitemap (referenced from robots). */
export function sitemapUrl(): string {
  return absoluteUrl('/sitemap.xml')
}

// ── Structured data (honest JSON-LD) ─────────────────────────────────────────────────────────

/**
 * Organization structured data. Only generic, true fields: name + site URL (+ optional
 * description). NO address, phone, payment method, sameAs, or rating is emitted — we never
 * fabricate business identifiers we do not have.
 */
export function buildOrganizationJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    description: 'Інтернет-магазин біжутерії, прикрас та аксесуарів AURELIA.',
  }
}

/**
 * WebSite structured data with a SearchAction pointing at the on-site `/search?q=` route (which
 * really exists). The query placeholder uses the schema.org convention.
 */
export function buildWebSiteJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  }
}

/**
 * Map of HTML/script-significant characters → their JSON unicode escape. `<` is the one that
 * matters most (a value containing `</script>` could otherwise break out of an inline
 * `<script type="application/ld+json">`); `>` and `&` are escaped for completeness, and the
 * U+2028 / U+2029 line separators (legal in JSON strings but able to terminate an inline script
 * in some engines) are neutralised too. Every replacement is still valid JSON / JSON-LD.
 */
const JSON_LD_ESCAPES: Record<string, string> = {
  '<': '\\u003c',
  '>': '\\u003e',
  '&': '\\u0026',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029',
}

/**
 * Serialises a JSON-LD object for safe injection into an inline
 * `<script type="application/ld+json">` (Этап 76A — closes 75A finding F6).
 *
 * Plain `JSON.stringify` leaves a literal `<` in the output, so admin-authored data containing
 * `</script>` (or `<!--`) could break out of the script element. Our inputs are admin-controlled
 * and customer free-text already rejects markup, so this is defence in depth — but it is small,
 * design-safe, and removes the break-out risk entirely. The rendered structured data is unchanged;
 * only the byte encoding of a handful of characters is made safer.
 */
export function serializeJsonLd(node: unknown): string {
  return JSON.stringify(node).replace(/[<>&\u2028\u2029]/g, (ch) => JSON_LD_ESCAPES[ch] ?? ch)
}

/** A single breadcrumb step. `href` is optional for the current (last) item. */
export interface BreadcrumbStep {
  label: string
  href?: string
}

/**
 * BreadcrumbList structured data from an ordered list of steps. Each item carries a 1-based
 * `position`; only steps with an `href` get an absolute `item` URL (the current page may omit it).
 * Returns null for an empty trail so callers can skip emitting an empty list.
 */
export function buildBreadcrumbJsonLd(steps: BreadcrumbStep[]): Record<string, unknown> | null {
  if (!steps || steps.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: steps.map((step, i) => {
      const el: Record<string, unknown> = {
        '@type': 'ListItem',
        position: i + 1,
        name: step.label,
      }
      if (step.href) el.item = absoluteUrl(step.href)
      return el
    }),
  }
}

// ── Open Graph image policy (honest) ─────────────────────────────────────────────────────────

/** The minimal product shape the OG-image policy needs. */
export interface OgProductLike {
  imageUrl?: string | null
}

/**
 * Open Graph images for a product. Returns a real, absolute product-image URL ONLY when an
 * uploaded asset exists. When the product has no real photo we return an EMPTY array — we never
 * fall back to a placeholder image or invent a photo (there is no brand OG asset yet either).
 */
export function productOgImages(product: OgProductLike): string[] {
  const url = (product.imageUrl ?? '').trim()
  return url ? [absoluteUrl(url)] : []
}
