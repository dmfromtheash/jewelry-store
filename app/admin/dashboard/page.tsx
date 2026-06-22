/**
 * AURELIA — Admin operations dashboard (Этап 24A KPI v1 → Этап 65A operations center)
 *
 * The store owner's command center. Shows REAL counts/aggregates from PostgreSQL across
 * orders, reviews, promotions, the email outbox, catalog health and customer accounts, plus a
 * single "Needs attention" queue and honest owner-gated readiness warnings. No fake metrics,
 * no charts, no third-party libraries, NO external BI/analytics. Nothing executable runs from
 * the web admin — command names appear only as documentation text.
 *
 * Local/dev-only (ensureLocalAdmin) + session-gated (requireAdminSession); the /admin layout
 * also sets noindex/nofollow. Only safe aggregates + links are rendered — never a secret,
 * token, cookie, email body, raw payload, or customer PII (accounts are counts only).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getOperationsDashboard } from '../../../src/lib/admin/operations-dashboard-data'
import type { AttentionSeverity } from '../../../src/lib/admin/operations-dashboard'
import { ORDER_STATUS_LABELS } from '../../../src/lib/admin/orders'
import { formatPrice } from '../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Админ · Дашборд — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
const money = (minor: number) => formatPrice(minor / 100)

const SEVERITY_BADGE: Record<AttentionSeverity, string> = {
  action: 'au-adm-badge--action',
  warn: 'au-adm-badge--warn',
  info: 'au-adm-badge--info',
}
const SEVERITY_LABEL: Record<AttentionSeverity, string> = {
  action: 'Действие',
  warn: 'Внимание',
  info: 'Инфо',
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="au-adm-kpi">
      <span className="au-adm-kpi-label">{label}</span>
      <span className="au-adm-kpi-value">{value}</span>
      {hint ? <span className="au-adm-kpi-hint">{hint}</span> : null}
    </div>
  )
}

export default async function AdminDashboardPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { orders, reviews, promos, email, catalog, customers, engagement, attention, readiness } =
    await getOperationsDashboard()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Дашборд операций</h1>
          <span className="au-adm-sub">
            Обзор по реальным данным магазина. Локальная админка (dev) — реальная отправка
            писем, онлайн-оплата и API доставки не подключены.
          </span>
        </div>
      </div>

      {/* ---- Needs attention ---- */}
      <h2 className="au-adm-section-title">Требует внимания</h2>
      <div className="au-adm-card">
        {attention.length === 0 ? (
          <p className="au-adm-note">Всё под контролем — срочных задач нет.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Приоритет</th>
                  <th>Что</th>
                  <th>Кол-во</th>
                  <th>Действие</th>
                </tr>
              </thead>
              <tbody>
                {attention.map((a) => (
                  <tr key={a.key}>
                    <td><span className={`au-adm-badge ${SEVERITY_BADGE[a.severity]}`}>{SEVERITY_LABEL[a.severity]}</span></td>
                    <td>{a.label}</td>
                    <td>{a.count}</td>
                    <td><Link className="au-adm-link" href={a.href}>Открыть →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Orders ---- */}
      <h2 className="au-adm-section-title">Заказы</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Всего" value={String(orders.total)} />
        <KpiCard label="Новые" value={String(orders.submitted)} hint="ждут обработки" />
        <KpiCard label="В обработке" value={String(orders.processing)} />
        <KpiCard label="Выполнено" value={String(orders.completed)} />
        <KpiCard label="Отменено" value={String(orders.cancelled)} />
      </div>
      <div className="au-adm-card">
        <h3 className="au-adm-card-title">Последние заказы</h3>
        {orders.recent.length === 0 ? (
          <p className="au-adm-note">Заказов пока нет.</p>
        ) : (
          <ul className="au-adm-feed">
            {orders.recent.map((o) => (
              <li key={o.orderCode} className="au-adm-feed-row">
                <span className="au-adm-feed-main">
                  <Link className="au-adm-link" href={`/admin/orders/${o.orderCode}`}>{o.orderCode}</Link>
                  <span className="au-adm-feed-meta"> · <span className={`au-adm-badge au-adm-badge--${o.status}`}>{ORDER_STATUS_LABELS[o.status]}</span></span>
                </span>
                <span className="au-adm-feed-aside">
                  <span className="au-adm-feed-actor">{money(o.totalAmount)}</span>
                  <span className="au-adm-feed-time">{dateFmt.format(o.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/orders">Все заказы →</Link></p>
      </div>

      {/* ---- Reviews ---- */}
      <h2 className="au-adm-section-title">Отзывы</h2>
      <div className="au-adm-kpis">
        <KpiCard label="На модерации" value={String(reviews.pending)} hint="ждут решения" />
        <KpiCard label="Одобрено" value={String(reviews.approved)} />
        <KpiCard label="Отклонено" value={String(reviews.rejected)} />
      </div>
      {reviews.recentPending.length > 0 && (
        <div className="au-adm-card">
          <h3 className="au-adm-card-title">Последние на модерации</h3>
          <ul className="au-adm-feed">
            {reviews.recentPending.map((r) => (
              <li key={r.id} className="au-adm-feed-row">
                <span className="au-adm-feed-main">{r.productName}<span className="au-adm-feed-meta"> · {'★'.repeat(r.rating)}</span></span>
                <span className="au-adm-feed-aside"><span className="au-adm-feed-time">{dateFmt.format(r.createdAt)}</span></span>
              </li>
            ))}
          </ul>
          <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/reviews">Модерация отзывов →</Link></p>
        </div>
      )}

      {/* ---- Promotions ---- */}
      <h2 className="au-adm-section-title">Промокоды</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Активные" value={String(promos.active)} />
        <KpiCard label="Выключены" value={String(promos.inactive)} />
        <KpiCard label="В архиве" value={String(promos.archived)} />
        <KpiCard label="Исчерпан лимит" value={String(promos.exhausted)} />
        <KpiCard label="Скоро истекут" value={String(promos.expiringSoon)} hint="≤ 7 дней" />
      </div>
      <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/promotions">Управление промокодами →</Link></p>

      {/* ---- Email outbox ---- */}
      <h2 className="au-adm-section-title">Почта (outbox)</h2>
      <div className="au-adm-kpis">
        <KpiCard label="В очереди" value={String(email.queued)} />
        <KpiCard label="Не отправлено (нет провайдера)" value={String(email.skippedNoProvider)} />
        <KpiCard label="Ошибка валидации" value={String(email.failedValidation)} />
        <KpiCard label="Всего записей" value={String(email.total)} />
      </div>
      <div className="au-adm-card">
        <p className="au-adm-note">
          Реальная отправка e-mail НЕ настроена (нет провайдера) — письма только фиксируются.
        </p>
        {email.recentProblems.length > 0 && (
          <ul className="au-adm-feed">
            {email.recentProblems.map((e) => (
              <li key={e.id} className="au-adm-feed-row">
                <span className="au-adm-feed-main">{e.template}<span className="au-adm-feed-meta"> · {e.relatedType ?? '—'}: {e.relatedId ?? '—'}</span></span>
                <span className="au-adm-feed-aside"><span className={`au-adm-badge au-adm-badge--${e.status}`}>{e.status}</span><span className="au-adm-feed-time">{dateFmt.format(e.createdAt)}</span></span>
              </li>
            ))}
          </ul>
        )}
        <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/email-outbox">Письма →</Link></p>
      </div>

      {/* ---- Catalog health ---- */}
      <h2 className="au-adm-section-title">Состояние каталога</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Товаров" value={String(catalog.products)} />
        <KpiCard label="Опубликовано" value={String(catalog.published)} />
        <KpiCard label="Скрыто" value={String(catalog.hidden)} />
        <KpiCard label="Доступно" value={String(catalog.available)} />
        <KpiCard label="Скоро" value={String(catalog.comingSoon)} />
        <KpiCard label="Без цены" value={String(catalog.withoutPrice)} hint="опубликованные" />
        <KpiCard label="Без изображения" value={String(catalog.withoutImage)} hint="плейсхолдер" />
        <KpiCard label="Нулевой остаток" value={String(catalog.zeroStockPurchasable)} hint="доступные" />
      </div>
      <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/catalog">Каталог →</Link></p>

      {/* ---- Customers ---- */}
      <h2 className="au-adm-section-title">Покупатели</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Аккаунтов" value={String(customers.total)} />
        <KpiCard label="E-mail подтверждён" value={String(customers.verified)} />
        <KpiCard label="Не подтверждён" value={String(customers.unverified)} />
        <KpiCard label="Новых за 7 дней" value={String(customers.newLast7Days)} />
        <KpiCard label="В избранном (всего)" value={String(customers.wishlistItems)} />
        <KpiCard label="Сохранённые поиски" value={String(engagement.savedSearches)} />
        <KpiCard label="Ожидания поступления" value={String(engagement.activeInterests)} hint="письма не шлются" />
      </div>
      <p className="au-adm-note">
        На дашборде показываются только агрегаты. Детали по конкретному покупателю (заказы,
        отзывы, избранное, статус писем) — в разделе «Покупатели» (только просмотр, без
        редактирования и без секретов/токенов).
      </p>
      <p className="au-adm-cta"><Link className="au-adm-link" href="/admin/customers">Покупатели →</Link></p>

      {/* ---- Readiness / owner-gated ---- */}
      <h2 className="au-adm-section-title">Готовность (под решение владельца)</h2>
      <div className="au-adm-card">
        <ul className="au-adm-feed">
          {readiness.map((r) => (
            <li key={r.label} className="au-adm-feed-row">
              <span className="au-adm-feed-main">{r.label}</span>
              <span className="au-adm-feed-aside"><span className="au-adm-feed-actor">{r.note}</span></span>
            </li>
          ))}
        </ul>
        <p className="au-adm-note">
          Проверки готовности запускаются из терминала (не из админки):
          {' '}<code>npm run demo:preflight</code>, <code>npm run demo:rehearsal</code>,
          {' '}<code>npm run smoke:routes</code>, <code>npm run smoke:admin</code>.
          Подробнее — в <code>docs/sale/</code>.
        </p>
      </div>

      {/* ---- Quick links ---- */}
      <div className="au-adm-card">
        <h3 className="au-adm-card-title">Быстрые переходы</h3>
        <p className="au-adm-cta au-adm-quicklinks">
          <Link className="au-btn au-btn--primary" href="/admin/orders">Заказы</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/catalog">Каталог</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/reviews">Отзывы</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/customers">Покупатели</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/promotions">Промокоды</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/email-outbox">Письма</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/settings">Настройки</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/content">Контент</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/audit-log">Журнал аудита</Link>
          <Link className="au-btn au-btn--ghost" href="/admin/analytics">Аналитика</Link>
        </p>
      </div>
    </div>
  )
}
