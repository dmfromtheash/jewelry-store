/**
 * AURELIA — Analytics event taxonomy (pure) — Этап 23A
 *
 * Stable event names + the pure validation/sanitization helpers shared by the
 * server-only recorder (record.ts) and the verification script. This module is
 * intentionally dependency-free (NO `server-only`, NO Prisma, NO next/headers)
 * so it can be imported from a plain tsx script and unit-reasoned in isolation.
 *
 * Contract: docs/backend/ANALYTICS_EVENT_TAXONOMY.md.
 */

/** Stable snake_case event identifiers (taxonomy §5–§9). */
export const ANALYTICS_EVENTS = {
  // Storefront
  pageView: 'page_view',
  categoryView: 'category_view',
  collectionView: 'collection_view',
  productView: 'product_view',
  productImageView: 'product_image_view',
  addToCart: 'add_to_cart',
  removeFromCart: 'remove_from_cart',
  cartView: 'cart_view',
  beginCheckout: 'begin_checkout',
  checkoutStepView: 'checkout_step_view',
  checkoutSubmitAttempt: 'checkout_submit_attempt',
  draftOrderCreated: 'draft_order_created',
  checkoutError: 'checkout_error',
  // Search / discovery
  searchPerformed: 'search_performed',
  searchResultClicked: 'search_result_clicked',
  searchNoResults: 'search_no_results',
  filterApplied: 'filter_applied',
  sortChanged: 'sort_changed',
  // Marketing / source
  landingPageView: 'landing_page_view',
  utmCaptured: 'utm_captured',
  referrerCaptured: 'referrer_captured',
  campaignVisit: 'campaign_visit',
  // Site health
  serverError: 'server_error',
  notFound: 'not_found',
  apiError: 'api_error',
  dbError: 'db_error',
  slowRequest: 'slow_request',
  structuredDataError: 'structured_data_error',
} as const

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]

/** The full set of allowed event names (the only names that may be stored). */
export const ALLOWED_ANALYTICS_EVENTS: ReadonlySet<string> = new Set(
  Object.values(ANALYTICS_EVENTS),
)

/**
 * Forbidden payload KEY patterns (privacy/secrets). Matched case-insensitively
 * against payload keys; any match is stripped before storage. Targets real
 * PII/secret key names without nuking benign keys (position, sort, itemCount,
 * description, …). Defense-in-depth: our own callers never emit these, but the
 * stripper guarantees they can't land even if a future caller is careless.
 */
export const FORBIDDEN_PAYLOAD_KEY_PATTERN =
  /(pass(word)?|secret|token|api[-_]?key|cookie|session|phone|e-?mail|first[-_]?name|last[-_]?name|full[-_]?name|customer[-_]?name|\bname\b|address|postal|payment|card[-_]?number|\bcvv\b|\bssn\b|ip[-_]?addr|client[-_]?ip|remote[-_]?ip)/i

/**
 * Normalizes an event name (trim + lowercase) and validates it against the
 * allowlist. Returns the normalized name, or null if not an allowed event.
 */
export function normalizeEventName(name: string | undefined | null): string | null {
  if (!name || typeof name !== 'string') return null
  const normalized = name.trim().toLowerCase()
  return ALLOWED_ANALYTICS_EVENTS.has(normalized) ? normalized : null
}

/**
 * Sanitizes a payload for storage:
 *   - must be a plain object (arrays/primitives → undefined);
 *   - drops any key matching FORBIDDEN_PAYLOAD_KEY_PATTERN;
 *   - keeps only JSON-safe primitives (string/number/boolean/null) — nested
 *     objects/arrays are dropped to prevent deep PII smuggling in this
 *     foundation;
 *   - caps key count (30) and string length (500).
 * Returns a sanitized object, or undefined when there is nothing safe to store.
 */
export function sanitizePayload(payload: unknown): Record<string, string | number | boolean | null> | undefined {
  if (payload == null || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined
  }
  const out: Record<string, string | number | boolean | null> = {}
  let count = 0
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (count >= 30) break
    if (FORBIDDEN_PAYLOAD_KEY_PATTERN.test(key)) continue
    if (value === null) {
      out[key] = null
      count++
    } else if (typeof value === 'string') {
      out[key] = value.slice(0, 500)
      count++
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
      count++
    }
    // nested objects/arrays are intentionally dropped in this foundation
  }
  return Object.keys(out).length > 0 ? out : undefined
}
