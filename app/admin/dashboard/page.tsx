/**
 * AURELIA — Admin dashboard / KPI v1 (Этап 24A)
 *
 * First useful overview screen for the admin shell. Shows REAL counts/aggregates
 * from PostgreSQL (orders, catalog, activity) plus two recent-activity lists
 * (audit + analytics). No fake metrics, no charts, no third-party libraries.
 *
 * Local/dev-only (ensureLocalAdmin) + session-gated (requireAdminSession); the
 * /admin layout also sets noindex/nofollow as the default for every admin route,
 * and this page re-asserts robots noindex explicitly.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getAdminDashboardData } from '../../../src/lib/admin/dashboard'
import { ORDER_STATUS_LABELS } from '../../../src/lib/admin/orders'
import { AUDIT_ACTION_LABELS } from '../../../src/lib/admin/audit'
import { formatPrice } from '../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Админ · Дашборд — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

/** Money helper: stored minor units (kopecks) → shared major-unit formatter. */
function money(minor: number): string {
  return formatPrice(minor / 100)
}

interface KpiCardProps {
  label: string
  value: string
  hint?: string
}

function KpiCard({ label, value, hint }: KpiCardProps) {
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

  const data = await getAdminDashboardData()
  const { orders, catalog, activity, recentAudit, recentAnalytics } = data

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Дашборд</h1>
          <span className="au-adm-sub">
            Обзор по реальным данным магазина. Локальная админка (dev).
          </span>
        </div>
      </div>

      {/* ---- Orders ---- */}
      <h2 className="au-adm-section-title">Заказы</h2>
      <div className="au-adm-kpis">
        <KpiCard
          label="Новые заказы"
          value={String(orders.needsAttention)}
          hint="требуют обработки"
        />
        <KpiCard label="Всего заказов" value={String(orders.total)} />
        <KpiCard label="Сумма заказов" value={money(orders.activeValueMinor)} hint="без отменённых" />
        <KpiCard label="Черновики" value={String(orders.draftCount)} hint="статус «черновик»" />
      </div>
      {orders.needsAttention > 0 ? (
        <p className="au-adm-cta">
          <Link className="au-adm-link" href="/admin/orders?status=submitted">
            Показать новые заказы ({orders.needsAttention}) →
          </Link>
        </p>
      ) : null}

      <div className="au-adm-card">
        <h3 className="au-adm-card-title">Заказы по статусам</h3>
        {orders.total === 0 ? (
          <p className="au-adm-note">
            Заказов пока нет. Оформите заказ в витрине, чтобы он появился здесь.
          </p>
        ) : (
          <ul className="au-adm-breakdown">
            {orders.byStatus.map((b) => (
              <li key={b.status}>
                <span className={`au-adm-badge au-adm-badge--${b.status}`}>
                  {ORDER_STATUS_LABELS[b.status]}
                </span>
                <span className="au-adm-breakdown-count">{b.count}</span>
                <span className="au-adm-breakdown-sum">{money(b.totalMinor)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ---- Catalog ---- */}
      <h2 className="au-adm-section-title">Каталог</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Товары" value={String(catalog.products)} />
        <KpiCard label="Категории" value={String(catalog.categories)} />
      </div>

      {/* ---- Activity ---- */}
      <h2 className="au-adm-section-title">Активность</h2>
      <div className="au-adm-kpis">
        <KpiCard label="События аналитики" value={String(activity.analyticsEvents)} />
        <KpiCard label="События аудита" value={String(activity.auditEvents)} />
      </div>

      {/* ---- Recent activity ---- */}
      <h2 className="au-adm-section-title">Недавняя активность</h2>
      <div className="au-adm-recent">
        {/* Audit */}
        <div className="au-adm-card">
          <h3 className="au-adm-card-title">Журнал аудита</h3>
          {recentAudit.length === 0 ? (
            <p className="au-adm-note">Событий аудита пока нет.</p>
          ) : (
            <ul className="au-adm-feed">
              {recentAudit.map((e) => (
                <li key={e.id} className="au-adm-feed-row">
                  <span className="au-adm-feed-main">
                    {AUDIT_ACTION_LABELS[e.action] ?? e.action}
                    {e.entityType ? (
                      <span className="au-adm-feed-meta">
                        {' · '}
                        {e.entityType}: {e.entityId ?? '—'}
                      </span>
                    ) : null}
                  </span>
                  <span className="au-adm-feed-aside">
                    <span className="au-adm-feed-actor">{e.actor}</span>
                    <span className="au-adm-feed-time">{dateFmt.format(e.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="au-adm-cta">
            <Link className="au-adm-link" href="/admin/audit-log">
              Весь журнал аудита →
            </Link>
          </p>
        </div>

        {/* Analytics */}
        <div className="au-adm-card">
          <h3 className="au-adm-card-title">События аналитики</h3>
          {recentAnalytics.length === 0 ? (
            <p className="au-adm-note">Событий аналитики пока нет.</p>
          ) : (
            <ul className="au-adm-feed">
              {recentAnalytics.map((e) => (
                <li key={e.id} className="au-adm-feed-row">
                  <span className="au-adm-feed-main">
                    {e.eventName}
                    {e.pagePath ? (
                      <span className="au-adm-feed-meta">
                        {' · '}
                        {e.pagePath}
                      </span>
                    ) : null}
                  </span>
                  <span className="au-adm-feed-aside">
                    {e.deviceType ? (
                      <span className="au-adm-feed-actor">{e.deviceType}</span>
                    ) : null}
                    <span className="au-adm-feed-time">{dateFmt.format(e.createdAt)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="au-adm-cta">
            <Link className="au-adm-link" href="/admin/analytics">
              Раздел аналитики →
            </Link>
          </p>
        </div>
      </div>

      {/* ---- Quick links ---- */}
      <div className="au-adm-card">
        <h3 className="au-adm-card-title">Быстрые переходы</h3>
        <p className="au-adm-cta au-adm-quicklinks">
          <Link className="au-btn au-btn--primary" href="/admin/orders">
            Заказы
          </Link>
          <Link className="au-btn au-btn--ghost" href="/admin/audit-log">
            Журнал аудита
          </Link>
          <Link className="au-btn au-btn--ghost" href="/admin/analytics">
            Аналитика
          </Link>
          <Link className="au-btn au-btn--ghost" href="/admin/catalog">
            Каталог
          </Link>
        </p>
      </div>
    </div>
  )
}
