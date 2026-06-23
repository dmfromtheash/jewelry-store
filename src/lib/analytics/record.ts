/**
 * AURELIA — Analytics event recorder (server-only) — Этап 23A
 *
 * The ONLY write path for analytics events. Validates the event name against
 * the taxonomy allowlist, sanitizes the payload (strips forbidden/PII keys),
 * and writes one `AnalyticsEvent` row. Writes are best-effort and
 * side-effect-safe: a failure is caught and logged WITHOUT the payload, so
 * analytics can never break the storefront/order flow that triggered it.
 *
 * Contract & privacy rules: docs/backend/ANALYTICS_EVENT_TAXONOMY.md.
 */

import 'server-only'

import { randomBytes } from 'crypto'
import { cookies, headers } from 'next/headers'
import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ANALYTICS_EVENTS, normalizeEventName, sanitizePayload } from './events'

/**
 * Anonymous session cookie. Opaque 128-bit random id — never encodes any user
 * data. A SESSION cookie (no maxAge/expires) so it naturally rotates per
 * browser session and does NOT become a long-lived cross-site super-cookie.
 * `httpOnly` is fine: the cookie is still sent automatically on every same-origin
 * request (including a future fetch/sendBeacon), and the SERVER derives the id
 * from the request — client JS never needs to read it.
 */
const ANON_COOKIE = 'au_anon'
const ANON_ID_RE = /^[a-f0-9]{32}$/

/** Reads the anonymous session id from the cookie, creating + setting it if absent.
 * Cookie writes only work in a Server Action / Route Handler; in read-only
 * contexts the set is skipped (the id is still returned for this event). */
export async function getOrCreateAnonymousSessionId(): Promise<string> {
  const jar = await cookies()
  const existing = jar.get(ANON_COOKIE)?.value
  if (existing && ANON_ID_RE.test(existing)) return existing

  const id = randomBytes(16).toString('hex')
  try {
    jar.set(ANON_COOKIE, id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    })
  } catch {
    // Not in a mutable-cookie context (e.g. during render) — ignore.
  }
  return id
}

/** Best-effort coarse request signals. Never stores raw UA or full referrer. */
async function getRequestSignals(): Promise<{ deviceType: string | null; referrerDomain: string | null }> {
  try {
    const h = await headers()
    const ua = (h.get('user-agent') ?? '').toLowerCase()
    const deviceType = /ipad|tablet/.test(ua)
      ? 'tablet'
      : /mobi|android|iphone|ipod/.test(ua)
        ? 'mobile'
        : ua
          ? 'desktop'
          : null

    let referrerDomain: string | null = null
    const referer = h.get('referer')
    if (referer) {
      try {
        const refHost = new URL(referer).hostname
        const selfHost = (h.get('host') ?? '').split(':')[0]
        // Only an EXTERNAL referrer counts as a marketing source.
        referrerDomain = refHost && refHost !== selfHost ? refHost : null
      } catch {
        referrerDomain = null
      }
    }
    return { deviceType, referrerDomain }
  } catch {
    return { deviceType: null, referrerDomain: null }
  }
}

export interface RecordEventInput {
  eventName: string
  anonymousSessionId?: string | null
  userId?: string | null
  productId?: string | null
  categoryId?: string | null
  orderId?: string | null
  orderCode?: string | null
  pagePath?: string | null
  referrerDomain?: string | null
  utmSource?: string | null
  utmMedium?: string | null
  utmCampaign?: string | null
  utmContent?: string | null
  utmTerm?: string | null
  deviceType?: string | null
  payload?: unknown
  privacyFlags?: unknown
}

/**
 * Records one analytics event. Rejects unknown event names (no write) and
 * sanitizes payload/privacyFlags. Never throws into the caller, never logs the
 * payload.
 */
export async function recordEvent(input: RecordEventInput): Promise<void> {
  try {
    const eventName = normalizeEventName(input.eventName)
    if (!eventName) {
      // Unknown/disallowed name — drop it (do not store). No payload in the log.
      console.warn(`[analytics] rejected unknown event "${String(input.eventName)}"`)
      return
    }

    const data: Prisma.AnalyticsEventCreateInput = {
      eventName,
      anonymousSessionId: input.anonymousSessionId ?? null,
      userId: input.userId ?? null,
      productId: input.productId ?? null,
      categoryId: input.categoryId ?? null,
      orderId: input.orderId ?? null,
      orderCode: input.orderCode ?? null,
      pagePath: input.pagePath ?? null,
      referrerDomain: input.referrerDomain ?? null,
      utmSource: input.utmSource ?? null,
      utmMedium: input.utmMedium ?? null,
      utmCampaign: input.utmCampaign ?? null,
      utmContent: input.utmContent ?? null,
      utmTerm: input.utmTerm ?? null,
      deviceType: input.deviceType ?? null,
      payload: sanitizePayload(input.payload),
      privacyFlags: sanitizePayload(input.privacyFlags),
    }

    await prisma.analyticsEvent.create({ data })
  } catch (err) {
    // Best-effort: never break the caller; never log the payload.
    console.error(
      `[analytics] failed to record "${String(input.eventName)}": ${
        err instanceof Error ? err.message : 'unknown error'
      }`,
    )
  }
}

/**
 * Records a CLIENT-originated event (from the same-origin /api/analytics route).
 * Validates the event name against the taxonomy allowlist, derives the anonymous
 * session + coarse request signals server-side, and writes via recordEvent
 * (which sanitizes the payload). Returns whether the event name was accepted.
 * The client can only influence eventName / pagePath / payload — never the
 * anonymous session id, device, or referrer (those are server-derived).
 */
export async function recordClientEvent(
  eventName: string,
  payload?: unknown,
  pagePath?: string | null,
): Promise<boolean> {
  try {
    const name = normalizeEventName(eventName)
    if (!name) return false // unknown/disallowed event — reject

    const anonymousSessionId = await getOrCreateAnonymousSessionId()
    const { deviceType, referrerDomain } = await getRequestSignals()
    // Path only, no query string, length-capped.
    const safePath =
      typeof pagePath === 'string' ? pagePath.split('?')[0].slice(0, 200) : null

    await recordEvent({
      eventName: name,
      anonymousSessionId,
      deviceType,
      referrerDomain,
      pagePath: safePath,
      payload,
    })
    return true
  } catch {
    // Best-effort: never throw to the route.
    return false
  }
}

/** draft_order_created — order CODE + coarse totals only; NO customer PII. */
export async function recordDraftOrderCreated(opts: {
  orderCode: string
  itemCount: number
  totalMinor: number
}): Promise<void> {
  try {
    const anonymousSessionId = await getOrCreateAnonymousSessionId()
    const { deviceType, referrerDomain } = await getRequestSignals()
    await recordEvent({
      eventName: ANALYTICS_EVENTS.draftOrderCreated,
      anonymousSessionId,
      orderCode: opts.orderCode,
      pagePath: '/checkout',
      deviceType,
      referrerDomain,
      payload: { itemCount: opts.itemCount, totalMinor: opts.totalMinor },
    })
  } catch {
    // never break the order flow
  }
}

/**
 * Engagement events (Этап 73A) — server-side, anonymous COUNTS only.
 *
 * These run inside existing server actions (review/promo/wishlist/saved-search/
 * product-interest). They deliberately do NOT derive or store any identity:
 *   - NO userId/customerId (even when the action is performed by a logged-in
 *     customer) — analytics stays an aggregate signal, never a per-user profile;
 *   - NO cookies/headers are read here, so they are cheap and safe to call from a
 *     plain Server Action without a request scope;
 *   - they reuse the EXISTING AnalyticsEvent columns (productId / categoryId /
 *     payload), so no schema change was required.
 * Every helper is best-effort: a failure is swallowed and never breaks the action
 * that triggered it.
 */

/** review_submitted — productId + integer rating only. NO author/body/PII. */
export async function recordReviewSubmitted(opts: {
  productId: string
  rating: number
}): Promise<void> {
  await recordEvent({
    eventName: ANALYTICS_EVENTS.reviewSubmitted,
    productId: opts.productId,
    payload: { rating: opts.rating },
  })
}

/**
 * promo_applied — outcome of a promo preview/apply. Stores only the result enum
 * and (on success) the NORMALIZED promo code. Promo codes are not secret in this
 * build (they are typed into the public checkout box and shown on confirmations,
 * Этап 63A), so the code itself is a safe, useful aggregation key. On failure the
 * raw attempt is NOT stored — only `result: 'rejected'`.
 */
export async function recordPromoApplied(opts: {
  result: 'applied' | 'rejected'
  code?: string | null
}): Promise<void> {
  await recordEvent({
    eventName: ANALYTICS_EVENTS.promoApplied,
    payload: {
      result: opts.result,
      ...(opts.result === 'applied' && opts.code ? { code: opts.code } : {}),
    },
  })
}

/** wishlist_added / wishlist_removed — public productSlug only; anonymous count. */
export async function recordWishlistChanged(opts: {
  added: boolean
  productSlug: string
}): Promise<void> {
  await recordEvent({
    eventName: opts.added ? ANALYTICS_EVENTS.wishlistAdded : ANALYTICS_EVENTS.wishlistRemoved,
    payload: { productSlug: opts.productSlug },
  })
}

/** saved_search_created — bare engagement count; NO query text/fields stored. */
export async function recordSavedSearchCreated(): Promise<void> {
  await recordEvent({ eventName: ANALYTICS_EVENTS.savedSearchCreated })
}

/** product_interest_added — public productSlug only; anonymous count. */
export async function recordProductInterestAdded(opts: {
  productSlug: string
}): Promise<void> {
  await recordEvent({
    eventName: ANALYTICS_EVENTS.productInterestAdded,
    payload: { productSlug: opts.productSlug },
  })
}

/** checkout_error — stable error CATEGORY only; never field values or PII. */
export async function recordCheckoutError(opts: {
  errorType: string
  itemCount?: number
}): Promise<void> {
  try {
    const anonymousSessionId = await getOrCreateAnonymousSessionId()
    const { deviceType, referrerDomain } = await getRequestSignals()
    await recordEvent({
      eventName: ANALYTICS_EVENTS.checkoutError,
      anonymousSessionId,
      pagePath: '/checkout',
      deviceType,
      referrerDomain,
      payload: {
        errorType: opts.errorType,
        ...(opts.itemCount != null ? { itemCount: opts.itemCount } : {}),
      },
    })
  } catch {
    // never break the order flow
  }
}
