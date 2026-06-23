/**
 * AURELIA — Admin analytics insights (Этап 73A)
 *
 * Real DB-backed view of the first-party, no-PII analytics event stream
 * (AnalyticsEvent). Shows event counts by period, the storefront purchase funnel,
 * top viewed products/categories, search + promo + engagement signals, a coarse
 * device split, and a safe recent-event feed — plus honest limitations.
 *
 * Privacy: only safe aggregates + an identity-free recent projection are rendered
 * (the data layer never selects anonymousSessionId/userId; the model holds no IP,
 * raw user-agent, cookie, token, or customer PII). No charts, no third-party
 * libraries, NO external analytics/BI. Reuses the existing admin CSS only.
 *
 * Local/dev-only (ensureLocalAdmin) + session-gated (requireAdminSession); the
 * /admin layout sets noindex/nofollow.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import {
  getAnalyticsInsights,
  DEFAULT_PERIOD_DAYS,
  VIEW_SCAN_CAP,
} from '../../../src/lib/analytics/insights-data'

export const metadata: Metadata = {
  title: 'Админ · Аналитика — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

const PERIOD_OPTIONS = [
  { days: 7, label: '7 дней' },
  { days: 30, label: '30 дней' },
  { days: 90, label: '90 дней' },
  { days: 365, label: 'Год' },
]

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="au-adm-kpi">
      <span className="au-adm-kpi-label">{label}</span>
      <span className="au-adm-kpi-value">{value}</span>
      {hint ? <span className="au-adm-kpi-hint">{hint}</span> : null}
    </div>
  )
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const sp = await searchParams
  const requested = Number(sp.period)
  const periodDays =
    PERIOD_OPTIONS.some((o) => o.days === requested) ? requested : DEFAULT_PERIOD_DAYS

  const a = await getAnalyticsInsights(periodDays)

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Аналитика</h1>
          <span className="au-adm-sub">
            Первичная обезличенная аналитика (без PII, IP, cookies-трекеров и отпечатков).
            Только собственные события — внешняя аналитика/BI не подключена.
          </span>
        </div>
      </div>

      {/* ---- Period selector ---- */}
      <p className="au-adm-cta">
        Период:{' '}
        {PERIOD_OPTIONS.map((o) => (
          <span key={o.days}>
            {o.days === periodDays ? (
              <strong>{o.label}</strong>
            ) : (
              <Link className="au-adm-link" href={`/admin/analytics?period=${o.days}`}>{o.label}</Link>
            )}
            {o.days !== PERIOD_OPTIONS[PERIOD_OPTIONS.length - 1].days ? ' · ' : ''}
          </span>
        ))}
      </p>

      {/* ---- Totals ---- */}
      <div className="au-adm-kpis">
        <KpiCard label="Событий за период" value={String(a.totalWindow)} hint={`за ${a.periodDays} дн.`} />
        <KpiCard label="Событий всего" value={String(a.totalAllTime)} hint="за всё время" />
        <KpiCard label="Просмотры товаров" value={String(a.funnel[0]?.count ?? 0)} />
        <KpiCard label="Создано заказов" value={String(a.funnel[3]?.count ?? 0)} hint="черновик" />
      </div>

      {/* ---- Funnel ---- */}
      <h2 className="au-adm-section-title">Воронка</h2>
      <div className="au-adm-card">
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Шаг</th>
                <th>Событий</th>
                <th>Конверсия от просмотра</th>
              </tr>
            </thead>
            <tbody>
              {a.funnel.map((s) => (
                <tr key={s.key}>
                  <td>{s.label}</td>
                  <td>{s.count}</td>
                  <td>{s.rate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="au-adm-note">
          Воронка — по обезличенным событиям витрины. Это поведенческий сигнал, а не финансовая
          истина (источник правды по заказам — раздел «Заказы»).
        </p>
      </div>

      {/* ---- Top products / categories ---- */}
      <h2 className="au-adm-section-title">Топ товаров и категорий</h2>
      <div className="au-adm-card">
        <h3 className="au-adm-card-title">Просматриваемые товары</h3>
        {a.topProducts.length === 0 ? (
          <p className="au-adm-note">Просмотров товаров за период нет.</p>
        ) : (
          <ul className="au-adm-feed">
            {a.topProducts.map((p) => (
              <li key={p.id} className="au-adm-feed-row">
                <span className="au-adm-feed-main">{p.name}</span>
                <span className="au-adm-feed-aside"><span className="au-adm-feed-actor">{p.count} просм.</span></span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="au-adm-card-title">Просматриваемые категории</h3>
        {a.topCategories.length === 0 ? (
          <p className="au-adm-note">Просмотров категорий за период нет.</p>
        ) : (
          <ul className="au-adm-feed">
            {a.topCategories.map((c) => (
              <li key={c.id} className="au-adm-feed-row">
                <span className="au-adm-feed-main">{c.name}</span>
                <span className="au-adm-feed-aside"><span className="au-adm-feed-actor">{c.count} просм.</span></span>
              </li>
            ))}
          </ul>
        )}
        {a.scanCapped && (
          <p className="au-adm-note">
            Топ считается по последним {VIEW_SCAN_CAP} событиям просмотра за период (граница локального демо).
          </p>
        )}
      </div>

      {/* ---- Search / promo / engagement ---- */}
      <h2 className="au-adm-section-title">Поиск, промокоды и вовлечённость</h2>
      <div className="au-adm-kpis">
        <KpiCard label="Поиски" value={String(a.search.performed)} />
        <KpiCard label="Поиски без результатов" value={String(a.search.noResults)} />
        <KpiCard label="Промокоды применены" value={String(a.promo.applied)} />
        <KpiCard label="Промокоды отклонены" value={String(a.promo.rejected)} />
        <KpiCard label="Отзывы отправлены" value={String(a.engagement.reviewSubmitted)} />
        <KpiCard label="В избранное" value={String(a.engagement.wishlistAdded)} />
        <KpiCard label="Из избранного" value={String(a.engagement.wishlistRemoved)} />
        <KpiCard label="Сохранённые поиски" value={String(a.engagement.savedSearchCreated)} />
        <KpiCard label="Ожидания поступления" value={String(a.engagement.productInterestAdded)} hint="письма не шлются" />
      </div>

      {/* ---- Devices ---- */}
      <h2 className="au-adm-section-title">Устройства</h2>
      <div className="au-adm-card">
        {a.devices.length === 0 ? (
          <p className="au-adm-note">Нет данных за период.</p>
        ) : (
          <ul className="au-adm-feed">
            {a.devices.map((d) => (
              <li key={d.type} className="au-adm-feed-row">
                <span className="au-adm-feed-main">{d.type}</span>
                <span className="au-adm-feed-aside"><span className="au-adm-feed-actor">{d.count}</span></span>
              </li>
            ))}
          </ul>
        )}
        <p className="au-adm-note">Грубая категория (mobile / tablet / desktop) — без сырого user-agent.</p>
      </div>

      {/* ---- All event counts ---- */}
      <h2 className="au-adm-section-title">События за период</h2>
      <div className="au-adm-card">
        {a.eventCounts.length === 0 ? (
          <p className="au-adm-note">За период событий нет.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Событие</th>
                  <th>Кол-во</th>
                </tr>
              </thead>
              <tbody>
                {a.eventCounts.map((e) => (
                  <tr key={e.name}>
                    <td>{e.label}<span className="au-adm-feed-meta"> · {e.name}</span></td>
                    <td>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Recent events ---- */}
      <h2 className="au-adm-section-title">Последние события</h2>
      <div className="au-adm-card">
        {a.recent.length === 0 ? (
          <p className="au-adm-note">Событий пока нет.</p>
        ) : (
          <ul className="au-adm-feed">
            {a.recent.map((e) => (
              <li key={e.id} className="au-adm-feed-row">
                <span className="au-adm-feed-main">
                  {e.label}
                  <span className="au-adm-feed-meta">
                    {e.pagePath ? ` · ${e.pagePath}` : ''}{e.detail ? ` · ${e.detail}` : ''}
                  </span>
                </span>
                <span className="au-adm-feed-aside">
                  {e.deviceType ? <span className="au-adm-feed-actor">{e.deviceType}</span> : null}
                  <span className="au-adm-feed-time">{dateFmt.format(e.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="au-adm-note">
          Показаны только безопасные поля события (без идентификаторов сессии/пользователя, IP,
          user-agent, cookies, токенов).
        </p>
      </div>

      {/* ---- Limitations / privacy ---- */}
      <h2 className="au-adm-section-title">Ограничения и приватность</h2>
      <div className="au-adm-card">
        <ul className="au-adm-feed">
          {a.health.map((h) => (
            <li key={h.label} className="au-adm-feed-row">
              <span className="au-adm-feed-main">{h.label}</span>
              <span className="au-adm-feed-aside"><span className="au-adm-feed-actor">{h.note}</span></span>
            </li>
          ))}
        </ul>
        <p className="au-adm-note">
          Контракт событий и правила приватности — в
          {' '}<code>docs/backend/ANALYTICS_EVENT_TAXONOMY.md</code>. Продакшн-аналитика требует
          отдельного юридического/приватного ревью (решение владельца).
        </p>
      </div>
    </div>
  )
}
