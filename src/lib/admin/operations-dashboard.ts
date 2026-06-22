/**
 * AURELIA — Admin operations dashboard: pure logic + types (Этап 65A)
 *
 * Pure, dependency-free helpers + types for the /admin/dashboard operations view. NO Prisma,
 * NO `server-only`, NO React — so the same classification + attention-queue logic is shared by
 * the server data layer (operations-dashboard-data.ts) AND the verify script (under tsx).
 *
 * Everything here is derived from already-safe aggregate inputs (counts/flags) — it never sees
 * a secret, token, cookie, email body, or raw customer PII.
 */

/** Severity of an attention-queue item: needs doing → noteworthy → informational. */
export type AttentionSeverity = 'action' | 'warn' | 'info'

export interface AttentionItem {
  /** Stable key (for React + tests). */
  key: string
  label: string
  /** A count or 0 (the queue only surfaces items with a positive count). */
  count: number
  severity: AttentionSeverity
  /** Admin link to act on it. */
  href: string
}

/** A minimal promo shape for classification (subset of PromoCode). */
export interface PromoLite {
  isActive: boolean
  archivedAt: Date | string | null
  endsAt: Date | string | null
  usageLimit: number | null
  usedCount: number
}

export interface PromoClassification {
  archived: boolean
  expired: boolean
  exhausted: boolean
  /** Genuinely usable now: active flag set, not archived, not expired, not exhausted. */
  active: boolean
  /** Active AND within PROMO_EXPIRING_SOON_DAYS of its end date. */
  expiringSoon: boolean
}

export const PROMO_EXPIRING_SOON_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

function toMs(d: Date | string | null): number | null {
  if (d == null) return null
  const t = d instanceof Date ? d.getTime() : Date.parse(d)
  return Number.isFinite(t) ? t : null
}

/** Classifies a promo's operational state at time `now` (pure). */
export function classifyPromo(p: PromoLite, now: Date = new Date()): PromoClassification {
  const archived = p.archivedAt != null
  const ends = toMs(p.endsAt)
  const nowMs = now.getTime()
  const expired = ends != null && nowMs >= ends
  const exhausted = p.usageLimit != null && p.usedCount >= p.usageLimit
  const active = !archived && p.isActive && !expired && !exhausted
  const expiringSoon = active && ends != null && ends - nowMs <= PROMO_EXPIRING_SOON_DAYS * DAY_MS
  return { archived, expired, exhausted, active, expiringSoon }
}

/** The aggregate inputs the attention queue needs — all safe counts/flags. */
export interface AttentionInput {
  orders: { submitted: number; processing: number }
  reviews: { pending: number }
  email: { queued: number; failed: number }
  promos: { exhausted: number; expiringSoon: number }
  catalog: { withoutPrice: number; withoutImage: number; zeroStockPurchasable: number }
  customers: { unverified: number }
}

/**
 * Builds the "Needs attention" queue from the dashboard aggregates (pure). Only conditions
 * that are actually true (count > 0) are emitted, ordered by severity (action → warn → info)
 * then by the declared order. Deterministic, so the verify script can assert it exactly.
 */
export function buildAttentionQueue(input: AttentionInput): AttentionItem[] {
  const items: AttentionItem[] = []
  const add = (cond: boolean, item: AttentionItem) => {
    if (cond && item.count > 0) items.push(item)
  }

  add(input.orders.submitted > 0, { key: 'orders-submitted', label: 'Нові заказы ждут обработки', count: input.orders.submitted, severity: 'action', href: '/admin/orders?status=submitted' })
  add(input.reviews.pending > 0, { key: 'reviews-pending', label: 'Отзывы на модерации', count: input.reviews.pending, severity: 'action', href: '/admin/reviews' })
  add(input.orders.processing > 0, { key: 'orders-processing', label: 'Заказы в обработке', count: input.orders.processing, severity: 'warn', href: '/admin/orders?status=processing' })
  add(input.email.queued > 0, { key: 'email-queued', label: 'Письма в очереди (не отправляются — нет провайдера)', count: input.email.queued, severity: 'warn', href: '/admin/email-outbox' })
  add(input.email.failed > 0, { key: 'email-failed', label: 'Письма с ошибкой валидации', count: input.email.failed, severity: 'warn', href: '/admin/email-outbox' })
  add(input.catalog.withoutPrice > 0, { key: 'catalog-noprice', label: 'Опубликованные товары без цены', count: input.catalog.withoutPrice, severity: 'warn', href: '/admin/catalog' })
  add(input.catalog.zeroStockPurchasable > 0, { key: 'catalog-zerostock', label: 'Доступные товары с нулевым остатком', count: input.catalog.zeroStockPurchasable, severity: 'warn', href: '/admin/catalog' })
  add(input.promos.exhausted > 0, { key: 'promo-exhausted', label: 'Промокоды исчерпали лимит', count: input.promos.exhausted, severity: 'info', href: '/admin/promotions' })
  add(input.promos.expiringSoon > 0, { key: 'promo-expiring', label: 'Промокоды скоро истекают', count: input.promos.expiringSoon, severity: 'info', href: '/admin/promotions' })
  add(input.catalog.withoutImage > 0, { key: 'catalog-noimage', label: 'Товары без изображения (демо-плейсхолдер)', count: input.catalog.withoutImage, severity: 'info', href: '/admin/catalog' })
  add(input.customers.unverified > 0, { key: 'customers-unverified', label: 'Аккаунты без подтверждённого e-mail', count: input.customers.unverified, severity: 'info', href: '/admin/customers?verified=unverified' })

  const rank: Record<AttentionSeverity, number> = { action: 0, warn: 1, info: 2 }
  return items.sort((a, b) => rank[a.severity] - rank[b.severity])
}

export interface ReadinessItem {
  label: string
  note: string
}

/**
 * Honest, owner-gated operational warnings shown on the dashboard. These are INFO/WARN context
 * (not errors). `emailProviderConfigured` is the one live flag; everything else is a documented
 * not-yet-built boundary, so the dashboard never implies an integration exists.
 */
export function buildReadinessWarnings(emailProviderConfigured: boolean): ReadinessItem[] {
  return [
    {
      label: 'Отправка e-mail',
      note: emailProviderConfigured
        ? 'Провайдер настроен.'
        : 'Реальная отправка НЕ настроена — письма только фиксируются (нет провайдера/DNS).',
    },
    { label: 'Онлайн-оплата', note: 'API платёжного провайдера НЕ подключено — оплата подтверждается вручную.' },
    { label: 'Доставка / перевозчик', note: 'API перевозчика, ТТН и трекинг НЕ подключены — доставка вручную.' },
    { label: 'Публичный деплой', note: 'Сайт НЕ развёрнут публично — локальное демо.' },
    { label: 'Админка', note: 'Админка только локальная (в проде маршруты отдают 404).' },
    { label: 'Изображения товаров', note: 'Часть карточек использует демо-плейсхолдеры, а не реальные фото.' },
    { label: 'Аналитика / BI', note: 'Внешняя BI/аналитика НЕ подключена — только локальные счётчики.' },
  ]
}
