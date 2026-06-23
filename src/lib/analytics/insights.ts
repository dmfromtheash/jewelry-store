/**
 * AURELIA — Analytics insights: pure logic + types (Этап 73A)
 *
 * Pure, dependency-free shaping of already-fetched analytics aggregates into the
 * admin insights view. NO Prisma, NO `server-only`, NO React — so the exact same
 * funnel/top-N/health logic is shared by the server data layer (insights-data.ts)
 * AND the verify script (under tsx), and can be reasoned about in isolation.
 *
 * Everything here operates on safe, pre-aggregated inputs (event-name → count
 * maps, {id,count} rows, and an already-projected recent-event list). It never
 * sees a secret, cookie, token, IP, raw user-agent, or customer PII — those are
 * not stored on AnalyticsEvent in the first place (see prisma/schema.prisma).
 */

import { ANALYTICS_EVENTS } from './events'

/** Human (RU) labels for the events surfaced in the admin dashboard. */
export const EVENT_LABELS: Record<string, string> = {
  [ANALYTICS_EVENTS.pageView]: 'Просмотры страниц',
  [ANALYTICS_EVENTS.productView]: 'Просмотры товаров',
  [ANALYTICS_EVENTS.categoryView]: 'Просмотры категорий',
  [ANALYTICS_EVENTS.collectionView]: 'Просмотры коллекций',
  [ANALYTICS_EVENTS.addToCart]: 'Добавления в корзину',
  [ANALYTICS_EVENTS.removeFromCart]: 'Удаления из корзины',
  [ANALYTICS_EVENTS.cartView]: 'Просмотры корзины',
  [ANALYTICS_EVENTS.beginCheckout]: 'Начато оформление',
  [ANALYTICS_EVENTS.checkoutSubmitAttempt]: 'Попытки отправки заказа',
  [ANALYTICS_EVENTS.draftOrderCreated]: 'Создано заказов (черновик)',
  [ANALYTICS_EVENTS.checkoutError]: 'Ошибки оформления',
  [ANALYTICS_EVENTS.searchPerformed]: 'Поиски',
  [ANALYTICS_EVENTS.searchNoResults]: 'Поиски без результатов',
  [ANALYTICS_EVENTS.reviewSubmitted]: 'Отправлено отзывов',
  [ANALYTICS_EVENTS.promoApplied]: 'Применение промокодов',
  [ANALYTICS_EVENTS.wishlistAdded]: 'Добавлено в избранное',
  [ANALYTICS_EVENTS.wishlistRemoved]: 'Удалено из избранного',
  [ANALYTICS_EVENTS.savedSearchCreated]: 'Сохранённые поиски',
  [ANALYTICS_EVENTS.productInterestAdded]: 'Ожидания поступления',
}

export function eventLabel(name: string): string {
  return EVENT_LABELS[name] ?? name
}

/** A name→count map (already aggregated by the data layer or the verify script). */
export type EventCountMap = Record<string, number>

/** Builds a name→count map from raw groupBy rows. */
export function toEventCountMap(rows: { eventName: string; count: number }[]): EventCountMap {
  const map: EventCountMap = {}
  for (const r of rows) map[r.eventName] = (map[r.eventName] ?? 0) + r.count
  return map
}

export function countOf(map: EventCountMap, name: string): number {
  return map[name] ?? 0
}

export function totalEvents(map: EventCountMap): number {
  let n = 0
  for (const k in map) n += map[k]
  return n
}

/** One ranked event row for the "counts by event" table. */
export interface EventCountRow {
  name: string
  label: string
  count: number
}

/** All events present in the map, sorted by count desc then name asc. */
export function rankEventCounts(map: EventCountMap): EventCountRow[] {
  return Object.keys(map)
    .map((name) => ({ name, label: eventLabel(name), count: map[name] }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

/** One purchase-funnel step. `rate` = this step / the FIRST step (0–100, integer). */
export interface FunnelStep {
  key: string
  label: string
  count: number
  /** Conversion from the top of the funnel (product_view), 0–100 rounded. */
  rate: number
}

/**
 * Builds the storefront purchase funnel from the event counts:
 *   product_view → add_to_cart → begin_checkout → draft_order_created.
 * Pure: just reads the count map. The rate is relative to the first step; if the
 * first step is 0 every rate is 0 (no division by zero, no fabricated %).
 */
export function buildFunnel(map: EventCountMap): FunnelStep[] {
  const steps: { key: string; label: string; count: number }[] = [
    { key: ANALYTICS_EVENTS.productView, label: 'Просмотр товара', count: countOf(map, ANALYTICS_EVENTS.productView) },
    { key: ANALYTICS_EVENTS.addToCart, label: 'В корзину', count: countOf(map, ANALYTICS_EVENTS.addToCart) },
    { key: ANALYTICS_EVENTS.beginCheckout, label: 'Оформление', count: countOf(map, ANALYTICS_EVENTS.beginCheckout) },
    { key: ANALYTICS_EVENTS.draftOrderCreated, label: 'Заказ создан', count: countOf(map, ANALYTICS_EVENTS.draftOrderCreated) },
  ]
  const top = steps[0].count
  return steps.map((s) => ({
    ...s,
    rate: top > 0 ? Math.round((s.count / top) * 100) : 0,
  }))
}

/** A ranked {id,count} aggregate decorated with a resolved display name. */
export interface RankedNamedRow {
  id: string
  name: string
  count: number
}

/**
 * Ranks {id,count} rows (e.g. top viewed products/categories) and resolves a
 * display name from a provided id→name map. Unknown ids fall back to the id so
 * a missing/deleted reference is still shown honestly (never invented). Returns
 * at most `limit` rows, sorted by count desc.
 */
export function rankNamed(
  rows: { id: string; count: number }[],
  names: Record<string, string>,
  limit: number,
): RankedNamedRow[] {
  return [...rows]
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => ({ id: r.id, name: names[r.id] ?? r.id, count: r.count }))
}

/** Safe projection of one recent event for admin display (no identity fields). */
export interface RecentEventView {
  id: string
  eventName: string
  label: string
  createdAt: Date
  pagePath: string | null
  deviceType: string | null
  /** A short, already-sanitized summary string of the payload (counts/slugs only). */
  detail: string | null
}

/** Fields that must NEVER appear in a recent-event projection (defense-in-depth). */
const FORBIDDEN_RECENT_KEYS = new Set([
  'anonymousSessionId',
  'userId',
  'ip',
  'ipAddress',
  'userAgent',
  'referrerDomain',
])

/**
 * Projects a raw event row to the safe admin view. Explicitly whitelists the
 * columns rendered and refuses to carry any identity/session field even if a
 * caller passed one in. The payload is summarized into a short string of safe
 * primitives (the payload was already sanitized at write time by record.ts).
 */
export function projectRecentEvent(row: {
  id: string
  eventName: string
  createdAt: Date
  pagePath?: string | null
  deviceType?: string | null
  payload?: unknown
}): RecentEventView {
  let detail: string | null = null
  if (row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload)) {
    const parts: string[] = []
    for (const [k, v] of Object.entries(row.payload as Record<string, unknown>)) {
      if (FORBIDDEN_RECENT_KEYS.has(k)) continue
      if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        parts.push(`${k}: ${String(v).slice(0, 60)}`)
      }
      if (parts.length >= 4) break
    }
    detail = parts.length > 0 ? parts.join(' · ') : null
  }
  return {
    id: row.id,
    eventName: row.eventName,
    label: eventLabel(row.eventName),
    createdAt: row.createdAt,
    pagePath: row.pagePath ?? null,
    deviceType: row.deviceType ?? null,
    detail,
  }
}

/** An honest limitation/health note shown on the admin analytics page. */
export interface AnalyticsHealthNote {
  label: string
  note: string
}

/**
 * Honest health/limitations for the analytics view. The ONLY data-dependent note
 * is the "no events yet" warning; the rest are permanent boundaries of this
 * first-party MVP, so the dashboard can never imply production-grade analytics.
 */
export function buildAnalyticsHealth(totalAllTime: number, totalWindow: number): AnalyticsHealthNote[] {
  const notes: AnalyticsHealthNote[] = []
  if (totalAllTime === 0) {
    notes.push({
      label: 'Нет данных',
      note: 'Событий пока нет. Счётчики появятся после действий в витрине (просмотры, корзина, оформление).',
    })
  } else if (totalWindow === 0) {
    notes.push({
      label: 'Нет данных за период',
      note: 'За выбранный период событий нет, но история есть. Расширьте период.',
    })
  }
  notes.push(
    { label: 'Первичная аналитика', note: 'Только собственные обезличенные события (без PII, IP, cookies-трекеров, отпечатков).' },
    { label: 'Без сторонних трекеров', note: 'Google Analytics / Meta Pixel / внешняя BI НЕ подключены — это локальное демо.' },
    { label: 'Без уникальных посетителей', note: 'Уникальные посетители / профили пользователей НЕ отслеживаются — это счётчики событий.' },
    { label: 'Хранение / приватность', note: 'Срок хранения и продакшн-аналитика — решение владельца после юридического/приватного ревью.' },
  )
  return notes
}
