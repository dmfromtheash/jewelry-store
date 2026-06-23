/**
 * AURELIA — Analytics insights: data layer (server-only) — Этап 73A
 *
 * Server-only Prisma reads that turn the raw `AnalyticsEvent` stream into the
 * safe aggregates rendered by /admin/analytics. Everything is REAL data from
 * PostgreSQL — COUNTS / groupBys / a small recent list only. It NEVER selects an
 * identity field: the recent-event projection explicitly omits anonymousSessionId
 * and userId, and the model carries no IP / raw user-agent / cookie / token /
 * customer PII to begin with (see prisma/schema.prisma + record.ts).
 *
 * "Top products/categories" are counted IN MEMORY from a capped scan of view
 * events, because client view events carry the public slug in the sanitized
 * `payload` (not a column). The cap is an honest MVP boundary surfaced to the
 * admin — this is local/demo analytics, not a BI warehouse.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { ANALYTICS_EVENTS } from './events'
import {
  buildAnalyticsHealth,
  buildFunnel,
  projectRecentEvent,
  rankEventCounts,
  rankNamed,
  toEventCountMap,
  totalEvents,
  type AnalyticsHealthNote,
  type EventCountRow,
  type FunnelStep,
  type RankedNamedRow,
  type RecentEventView,
} from './insights'

/** Cap for the in-memory top-N scan of view events (per window). */
export const VIEW_SCAN_CAP = 5000
const RECENT_LIMIT = 20
const TOP_LIMIT = 8
export const DEFAULT_PERIOD_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface AnalyticsInsights {
  periodDays: number
  since: Date
  totalAllTime: number
  totalWindow: number
  /** Per-event counts within the window, ranked. */
  eventCounts: EventCountRow[]
  funnel: FunnelStep[]
  topProducts: RankedNamedRow[]
  topCategories: RankedNamedRow[]
  search: { performed: number; noResults: number }
  promo: { applied: number; rejected: number }
  engagement: {
    reviewSubmitted: number
    wishlistAdded: number
    wishlistRemoved: number
    savedSearchCreated: number
    productInterestAdded: number
  }
  devices: { type: string; count: number }[]
  recent: RecentEventView[]
  health: AnalyticsHealthNote[]
  scanCapped: boolean
}

function slugFrom(payload: unknown, key: 'productSlug' | 'categorySlug'): string | null {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const v = (payload as Record<string, unknown>)[key]
    if (typeof v === 'string' && v.length > 0 && v.length <= 200) return v
  }
  return null
}

function countSlugs(rows: { payload: unknown }[], key: 'productSlug' | 'categorySlug'): Map<string, number> {
  const counts = new Map<string, number>()
  for (const r of rows) {
    const slug = slugFrom(r.payload, key)
    if (slug) counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }
  return counts
}

/**
 * Loads the analytics insights for the last `periodDays` days. Read-only; a small
 * fixed number of round-trips (counts/groupBys + two capped view scans + a recent
 * list). Returns safe aggregates only.
 */
export async function getAnalyticsInsights(periodDays = DEFAULT_PERIOD_DAYS, now: Date = new Date()): Promise<AnalyticsInsights> {
  const days = Number.isFinite(periodDays) && periodDays > 0 ? Math.min(Math.floor(periodDays), 365) : DEFAULT_PERIOD_DAYS
  const since = new Date(now.getTime() - days * DAY_MS)

  const [
    allTimeGroups,
    windowGroups,
    deviceGroups,
    productViewRows,
    categoryViewRows,
    promoRows,
    recentRows,
  ] = await Promise.all([
    prisma.analyticsEvent.groupBy({ by: ['eventName'], _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['eventName'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.analyticsEvent.groupBy({ by: ['deviceType'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.analyticsEvent.findMany({
      where: { eventName: ANALYTICS_EVENTS.productView, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_CAP,
      select: { payload: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { eventName: ANALYTICS_EVENTS.categoryView, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_CAP,
      select: { payload: true },
    }),
    prisma.analyticsEvent.findMany({
      where: { eventName: ANALYTICS_EVENTS.promoApplied, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_CAP,
      select: { payload: true },
    }),
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      // SAFE subset only — NEVER anonymousSessionId / userId / referrerDomain.
      select: { id: true, eventName: true, createdAt: true, pagePath: true, deviceType: true, payload: true },
    }),
  ])

  const allTimeMap = toEventCountMap(allTimeGroups.map((g) => ({ eventName: g.eventName, count: g._count._all })))
  const windowMap = toEventCountMap(windowGroups.map((g) => ({ eventName: g.eventName, count: g._count._all })))

  // --- Top products / categories (in-memory from capped view scans) ---
  const productCounts = countSlugs(productViewRows, 'productSlug')
  const categoryCounts = countSlugs(categoryViewRows, 'categorySlug')

  const productSlugs = [...productCounts.keys()]
  const categorySlugs = [...categoryCounts.keys()]

  const [products, categories] = await Promise.all([
    productSlugs.length > 0
      ? prisma.product.findMany({ where: { slug: { in: productSlugs } }, select: { slug: true, name: true } })
      : Promise.resolve([] as { slug: string; name: string }[]),
    categorySlugs.length > 0
      ? prisma.category.findMany({ where: { slug: { in: categorySlugs } }, select: { slug: true, name: true } })
      : Promise.resolve([] as { slug: string; name: string }[]),
  ])

  const productNames: Record<string, string> = {}
  for (const p of products) productNames[p.slug] = p.name
  const categoryNames: Record<string, string> = {}
  for (const c of categories) categoryNames[c.slug] = c.name

  const topProducts = rankNamed(
    [...productCounts].map(([id, count]) => ({ id, count })),
    productNames,
    TOP_LIMIT,
  )
  const topCategories = rankNamed(
    [...categoryCounts].map(([id, count]) => ({ id, count })),
    categoryNames,
    TOP_LIMIT,
  )

  // --- Promo applied vs rejected (from sanitized payload.result) ---
  let promoApplied = 0
  let promoRejected = 0
  for (const r of promoRows) {
    const result = r.payload && typeof r.payload === 'object' && !Array.isArray(r.payload)
      ? (r.payload as Record<string, unknown>).result
      : undefined
    if (result === 'applied') promoApplied++
    else if (result === 'rejected') promoRejected++
  }

  const totalAllTime = totalEvents(allTimeMap)
  const totalWindow = totalEvents(windowMap)

  return {
    periodDays: days,
    since,
    totalAllTime,
    totalWindow,
    eventCounts: rankEventCounts(windowMap),
    funnel: buildFunnel(windowMap),
    topProducts,
    topCategories,
    search: {
      performed: windowMap[ANALYTICS_EVENTS.searchPerformed] ?? 0,
      noResults: windowMap[ANALYTICS_EVENTS.searchNoResults] ?? 0,
    },
    promo: { applied: promoApplied, rejected: promoRejected },
    engagement: {
      reviewSubmitted: windowMap[ANALYTICS_EVENTS.reviewSubmitted] ?? 0,
      wishlistAdded: windowMap[ANALYTICS_EVENTS.wishlistAdded] ?? 0,
      wishlistRemoved: windowMap[ANALYTICS_EVENTS.wishlistRemoved] ?? 0,
      savedSearchCreated: windowMap[ANALYTICS_EVENTS.savedSearchCreated] ?? 0,
      productInterestAdded: windowMap[ANALYTICS_EVENTS.productInterestAdded] ?? 0,
    },
    devices: deviceGroups
      .map((g) => ({ type: g.deviceType ?? 'неизвестно', count: g._count._all }))
      .sort((a, b) => b.count - a.count),
    recent: recentRows.map(projectRecentEvent),
    health: buildAnalyticsHealth(totalAllTime, totalWindow),
    scanCapped: productViewRows.length >= VIEW_SCAN_CAP || categoryViewRows.length >= VIEW_SCAN_CAP,
  }
}

/**
 * Compact analytics summary for the operations dashboard (Этап 65A). A small,
 * cheap subset: all-time + last-7-day totals, the top viewed product, and the
 * funnel — so the dashboard can show an at-a-glance signal + an honest "no data"
 * hint without re-querying everything.
 */
export interface AnalyticsDashboardSummary {
  totalAllTime: number
  last7Days: number
  topProduct: { name: string; count: number } | null
  funnel: FunnelStep[]
  hasEvents: boolean
}

export async function getAnalyticsDashboardSummary(now: Date = new Date()): Promise<AnalyticsDashboardSummary> {
  const since = new Date(now.getTime() - 7 * DAY_MS)
  const [allTimeCount, windowGroups, productViewRows] = await Promise.all([
    prisma.analyticsEvent.count(),
    prisma.analyticsEvent.groupBy({ by: ['eventName'], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.analyticsEvent.findMany({
      where: { eventName: ANALYTICS_EVENTS.productView, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: VIEW_SCAN_CAP,
      select: { payload: true },
    }),
  ])

  const windowMap = toEventCountMap(windowGroups.map((g) => ({ eventName: g.eventName, count: g._count._all })))
  const productCounts = countSlugs(productViewRows, 'productSlug')

  let topProduct: { name: string; count: number } | null = null
  if (productCounts.size > 0) {
    const [slug, count] = [...productCounts].sort((a, b) => b[1] - a[1])[0]
    const product = await prisma.product.findUnique({ where: { slug }, select: { name: true } })
    topProduct = { name: product?.name ?? slug, count }
  }

  return {
    totalAllTime: allTimeCount,
    last7Days: totalEvents(windowMap),
    topProduct,
    funnel: buildFunnel(windowMap),
    hasEvents: allTimeCount > 0,
  }
}
