/**
 * AURELIA — Admin SEO & marketing readiness (Этап 72A)
 *
 * Local/dev-only SEO/marketing command center (guarded by ensureLocalAdmin + requireAdminSession).
 * Read-only: it surfaces the state of the SEO FOUNDATION — sitemap/robots, canonical/domain policy,
 * Open Graph / structured-data coverage, product SEO coverage, and honest marketing-readiness notes
 * + public-launch blockers. It does NOT duplicate per-product CONTENT readiness (Этап 71A) — that
 * lives at /admin/readiness and is linked, not repeated.
 *
 * Honest by construction: it never claims a public deploy, never fabricates imagery, and never adds
 * analytics/pixels. No secrets/tokens/PII rendered. Not in public nav; noindex (admin default).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getSeoReadinessOverview } from '../../../src/lib/admin/seo-readiness-data'
import type { SeoSignal, SeoStatus } from '../../../src/lib/seo/seo-readiness'

export const metadata: Metadata = {
  title: 'Админ · SEO и маркетинг — AURELIA',
  robots: { index: false, follow: false },
}

// Reuse the existing admin badge palette (no new CSS).
const STATUS_BADGE: Record<SeoStatus, string> = {
  ok: 'au-adm-badge--ok',
  warn: 'au-adm-badge--warn',
  gap: 'au-adm-badge--action',
}
const STATUS_LABEL: Record<SeoStatus, string> = { ok: 'OK', warn: 'Внимание', gap: 'Пробел' }

function SignalBadge({ status }: { status: SeoStatus }) {
  return <span className={`au-adm-badge ${STATUS_BADGE[status]}`}>{STATUS_LABEL[status]}</span>
}

function SignalRow({ signal }: { signal: SeoSignal }) {
  return (
    <tr>
      <td>{signal.label}</td>
      <td>
        <SignalBadge status={signal.status} />
      </td>
      <td>{signal.detail}</td>
    </tr>
  )
}

export default async function AdminSeoPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const o = await getSeoReadinessOverview()
  const sd = o.structuredData

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">SEO и маркетинг — готовность</h1>
          <span className="au-adm-sub">
            Состояние SEO-фундамента: карта сайта, robots, canonical/домен, Open Graph и структурные
            данные, охват SEO по товарам, маркетинг-готовность. Раздел только читает данные и ничего
            не отправляет. Внешняя аналитика, пиксели, реклама, CRM и авто-генерация SEO-текста НЕ
            подключены (это отдельные этапы). Контент карточек (фото/описание) — см.{' '}
            <Link className="au-adm-link" href="/admin/readiness">
              Готовность товаров
            </Link>
            .
          </span>
        </div>
      </div>

      {/* ---- Domain / canonical ---- */}
      <h2 className="au-adm-section-title">Домен и canonical</h2>
      <div className="au-adm-card">
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Сигнал</th>
                <th>Статус</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              <SignalRow signal={o.siteUrlSignal} />
              <tr>
                <td>Canonical-политика</td>
                <td>
                  <SignalBadge status="ok" />
                </td>
                <td>
                  Canonical — это чистый путь без query-параметров; страницы поиска noindex,
                  корзина/оформление/аккаунт/админка не индексируются.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="au-adm-note">
          Базовый URL: <code>{o.siteUrl.url}</code>{' '}
          {o.siteUrl.localDemo ? '(локальный/демо — публичный деплой решает владелец)' : '(публичный домен настроен)'}.
        </p>
      </div>

      {/* ---- Sitemap & robots ---- */}
      <h2 className="au-adm-section-title">Карта сайта и robots</h2>
      <div className="au-adm-kpis">
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Маршрутов в sitemap</span>
          <span className="au-adm-kpi-value">{o.sitemap.totalRoutes}</span>
          <span className="au-adm-kpi-hint">
            {o.sitemap.staticRoutes} статических + {o.sitemap.productRoutes} товаров
          </span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">robots: запрещено</span>
          <span className="au-adm-kpi-value">{o.robots.disallow.length}</span>
          <span className="au-adm-kpi-hint">{o.robots.disallow.join(' · ')}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Sitemap в robots</span>
          <span className="au-adm-kpi-value">{o.robots.sitemapReferenced ? 'Да' : 'Нет'}</span>
          <span className="au-adm-kpi-hint">ссылка на /sitemap.xml</span>
        </div>
      </div>
      <p className="au-adm-cta au-adm-quicklinks">
        <Link className="au-btn au-btn--ghost" href="/sitemap.xml">
          /sitemap.xml ↗
        </Link>
        <Link className="au-btn au-btn--ghost" href="/robots.txt">
          /robots.txt ↗
        </Link>
      </p>

      {/* ---- Product SEO coverage ---- */}
      <h2 className="au-adm-section-title">Охват SEO по товарам</h2>
      <div className="au-adm-kpis">
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Всего товаров</span>
          <span className="au-adm-kpi-value">{o.coverage.total}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Индексируемых</span>
          <span className="au-adm-kpi-value">{o.coverage.indexable}</span>
          <span className="au-adm-kpi-hint">опубликован + доступен</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">С описанием</span>
          <span className="au-adm-kpi-value">{o.coverage.withDescription}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Без описания</span>
          <span className="au-adm-kpi-value">{o.coverage.missingDescription}</span>
          <span className="au-adm-kpi-hint">meta-fallback подставляется</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">С OG-изображением</span>
          <span className="au-adm-kpi-value">{o.coverage.withOgImage}</span>
          <span className="au-adm-kpi-hint">реальное фото</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Без реального OG-фото</span>
          <span className="au-adm-kpi-value">{o.coverage.ogImageGap}</span>
          <span className="au-adm-kpi-hint">индексируемые с плейсхолдером</span>
        </div>
      </div>

      {/* ---- Structured data ---- */}
      <h2 className="au-adm-section-title">Структурные данные (JSON-LD)</h2>
      <div className="au-adm-card">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          <li>
            Organization <span className="au-adm-badge au-adm-badge--ok">{sd.organization ? 'есть' : 'нет'}</span>{' '}
            <span className="au-adm-sub">— общие честные поля, без выдуманных адреса/телефона/оплаты</span>
          </li>
          <li>
            WebSite + SearchAction <span className="au-adm-badge au-adm-badge--ok">{sd.website ? 'есть' : 'нет'}</span>{' '}
            <span className="au-adm-sub">— поиск по сайту /search?q=</span>
          </li>
          <li>
            BreadcrumbList <span className="au-adm-badge au-adm-badge--ok">{sd.breadcrumb ? 'есть' : 'нет'}</span>{' '}
            <span className="au-adm-sub">— на карточках товаров и категориях</span>
          </li>
          <li>
            Product <span className="au-adm-badge au-adm-badge--ok">{sd.product ? 'есть' : 'нет'}</span>{' '}
            <span className="au-adm-sub">— цена UAH, рейтинг только при наличии одобренных отзывов, честная доступность</span>
          </li>
        </ul>
      </div>

      {/* ---- Public-launch blockers (SEO/marketing) ---- */}
      <h2 className="au-adm-section-title">Блокеры публичного запуска (SEO/маркетинг)</h2>
      <div className="au-adm-card">
        {o.blockers.length === 0 ? (
          <p className="au-adm-note">Блокеров не найдено.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Блокер</th>
                  <th>Статус</th>
                  <th>Детали</th>
                </tr>
              </thead>
              <tbody>
                {o.blockers.map((b) => (
                  <SignalRow key={b.key} signal={b} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Marketing readiness ---- */}
      <h2 className="au-adm-section-title">Маркетинг-готовность</h2>
      <div className="au-adm-card">
        <ul style={{ margin: 0, paddingLeft: 16 }}>
          {o.marketing.map((m) => (
            <li key={m.label} style={{ marginBottom: 6 }}>
              <b>{m.label}.</b> <span className="au-adm-sub">{m.note}</span>
            </li>
          ))}
        </ul>
        <p className="au-adm-cta">
          <Link className="au-adm-link" href="/admin/readiness">
            Готовность товаров (контент карточек) →
          </Link>
          {' · '}
          <Link className="au-adm-link" href="/admin/catalog">
            Каталог →
          </Link>
        </p>
      </div>
    </div>
  )
}
