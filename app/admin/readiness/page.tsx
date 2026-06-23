/**
 * AURELIA — Admin product content readiness (Этап 71A)
 *
 * Local/dev-only content-readiness command center (guarded by ensureLocalAdmin + requireAdminSession).
 * Shows, per product, how "card-ready" it is against four honest levels (локальное демо → демо
 * покупателю → публичное демо → реальная продажа), the blocking issues, and a soft score — so the
 * owner can see what content (photos, описание, характеристики, …) is still missing before a real
 * sale, WITHOUT pretending real photos/content exist.
 *
 * READ-ONLY: it never changes a product, never gates checkout, never affects availability. The
 * photo truth is explicit — a placeholder is honest for a local/buyer demo but a GAP for a public
 * demo / real sale, and a real licensed/owned photo is an owner-provided future requirement. No
 * secrets/tokens/PII rendered. Not linked from public nav; noindex (admin layout default).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { formatPrice } from '../../../src/lib/catalog'
import {
  getReadinessOverview,
  matchesReadinessFilter,
  type ReadinessFilter,
  type ReadinessProductView,
} from '../../../src/lib/product-readiness/readiness-data'
import {
  ISSUE_SEVERITY_LABELS,
  READINESS_LEVEL_LABELS,
  type IssueSeverity,
  type ReadinessLevel,
} from '../../../src/lib/product-readiness/rules'

export const metadata: Metadata = {
  title: 'Админ · Готовность товаров — AURELIA',
  robots: { index: false, follow: false },
}

// Reuse the existing admin badge palette (no new CSS).
const SEVERITY_BADGE: Record<IssueSeverity, string> = {
  blocker: 'au-adm-badge--action',
  warning: 'au-adm-badge--warn',
  info: 'au-adm-badge--info',
}

const LEVEL_BADGE: Record<'none' | ReadinessLevel, string> = {
  none: 'au-adm-badge--fail',
  local_demo: 'au-adm-badge--pending',
  buyer_demo: 'au-adm-badge--warn',
  public_demo: 'au-adm-badge--info',
  real_sale: 'au-adm-badge--ok',
}

const FILTERS: { key: ReadinessFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'blockers', label: 'Блокеры' },
  { key: 'warnings', label: 'Предупреждения' },
  { key: 'photo-gap', label: 'Нет реального фото' },
  { key: 'no-description', label: 'Нет/заглушка описания' },
  { key: 'not-public-ready', label: 'Не готов к публичному демо' },
  { key: 'not-sale-ready', label: 'Не готов к продаже' },
]

function parseFilter(raw: string | undefined): ReadinessFilter {
  const known = FILTERS.map((f) => f.key)
  return (known as string[]).includes(raw ?? '') ? (raw as ReadinessFilter) : 'all'
}

function money(view: ReadinessProductView): string {
  if (view.price == null) return '—'
  return view.currency === 'UAH' ? formatPrice(view.price / 100) : `${(view.price / 100).toFixed(2)} ${view.currency}`
}

function LevelBadge({ view }: { view: ReadinessProductView }) {
  const level = view.readiness.reachedLevel
  const cls = LEVEL_BADGE[level ?? 'none']
  const label = level ? READINESS_LEVEL_LABELS[level] : 'Ниже демо'
  return <span className={`au-adm-badge ${cls}`}>{label}</span>
}

function ProductRow({ view }: { view: ReadinessProductView }) {
  const r = view.readiness
  return (
    <tr>
      <td>
        <Link className="au-adm-link" href={`/admin/catalog/${view.id}/edit`}>
          {view.name}
        </Link>
        <span className="au-adm-sub"> · {view.slug}</span>
        {!view.isPublished && <span className="au-adm-sub"> · скрыт</span>}
        {view.status !== 'available' && <span className="au-adm-sub"> · скоро</span>}
      </td>
      <td>{view.categoryLabel || <span className="au-adm-sub">—</span>}</td>
      <td>{money(view)}</td>
      <td>
        {r.hasPhotoGap ? (
          <span className="au-adm-badge au-adm-badge--warn">Плейсхолдер</span>
        ) : (
          <span className="au-adm-badge au-adm-badge--ok">Есть фото</span>
        )}
      </td>
      <td>
        {r.blockerCount > 0 && <span className="au-adm-badge au-adm-badge--action">{r.blockerCount} блок.</span>}{' '}
        {r.warningCount > 0 && <span className="au-adm-badge au-adm-badge--warn">{r.warningCount} предупр.</span>}{' '}
        {r.infoCount > 0 && <span className="au-adm-badge au-adm-badge--info">{r.infoCount} инфо</span>}
        {r.issues.length > 0 && (
          <details className="au-adm-sub" style={{ marginTop: 4 }}>
            <summary>Подробнее</summary>
            <ul style={{ margin: '6px 0 0', paddingLeft: 16 }}>
              {r.issues.map((i) => (
                <li key={i.code} style={{ marginBottom: 2 }}>
                  <span className={`au-adm-badge ${SEVERITY_BADGE[i.severity]}`}>{ISSUE_SEVERITY_LABELS[i.severity]}</span>{' '}
                  {i.label}
                </li>
              ))}
            </ul>
          </details>
        )}
      </td>
      <td>
        <LevelBadge view={view} />
      </td>
      <td>{r.score}</td>
      <td>
        <Link className="au-adm-link" href={`/admin/catalog/${view.id}/edit`}>
          Редактировать
        </Link>
        {view.isPublished && view.status === 'available' && (
          <>
            {' · '}
            <Link className="au-adm-link" href={`/product/${view.slug}`}>
              На витрине ↗
            </Link>
          </>
        )}
      </td>
    </tr>
  )
}

export default async function AdminReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { filter: rawFilter } = await searchParams
  const filter = parseFilter(rawFilter)

  const { summary, products } = await getReadinessOverview()
  const shown = products.filter((p) => matchesReadinessFilter(p, filter))

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Готовность карточек товаров</h1>
          <span className="au-adm-sub">
            Проверка контента карточек: фото, описание, характеристики, цена, остаток, SEO. Уровни
            готовности: <b>локальное демо</b> → <b>демо покупателю</b> → <b>публичное демо</b> →{' '}
            <b>реальная продажа</b>. Плейсхолдер-фото допустим для локального/демо-показа, но это
            пробел для публичного демо и реальной продажи. Реальные лицензированные/собственные фото
            и финальный контент предоставляет владелец — это НЕ генерация фото/текста и НЕ парсинг.
            Раздел только читает данные: товары не изменяются, оформление заказа не затрагивается.
          </span>
        </div>
      </div>

      {/* ---- Summary ---- */}
      <h2 className="au-adm-section-title">Сводка</h2>
      <div className="au-adm-kpis">
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Товаров</span>
          <span className="au-adm-kpi-value">{summary.total}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Готовы к продаже</span>
          <span className="au-adm-kpi-value">{summary.realSaleReady}</span>
          <span className="au-adm-kpi-hint">реальное фото + контент</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Готовы к публичному демо</span>
          <span className="au-adm-kpi-value">{summary.publicDemoReady}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">С блокерами</span>
          <span className="au-adm-kpi-value">{summary.withBlockers}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">С предупреждениями</span>
          <span className="au-adm-kpi-value">{summary.withWarnings}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Без реального фото</span>
          <span className="au-adm-kpi-value">{summary.withPhotoGap}</span>
          <span className="au-adm-kpi-hint">демо-плейсхолдер</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Ниже локального демо</span>
          <span className="au-adm-kpi-value">{summary.belowLocalDemo}</span>
          <span className="au-adm-kpi-hint">есть блокеры</span>
        </div>
      </div>

      {/* ---- Filters ---- */}
      <h2 className="au-adm-section-title">Фильтр</h2>
      <p className="au-adm-cta au-adm-quicklinks">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            className={`au-btn ${f.key === filter ? 'au-btn--primary' : 'au-btn--ghost'}`}
            href={f.key === 'all' ? '/admin/readiness' : `/admin/readiness?filter=${f.key}`}
          >
            {f.label}
          </Link>
        ))}
      </p>

      {/* ---- Products ---- */}
      <div className="au-adm-card">
        <p className="au-adm-note">
          Показано {shown.length} из {summary.total} товаров.
        </p>
        {shown.length === 0 ? (
          <p className="au-adm-note">Нет товаров под этот фильтр.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Категория</th>
                  <th>Цена</th>
                  <th>Фото</th>
                  <th>Контент</th>
                  <th>Уровень</th>
                  <th>Очки</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <ProductRow key={p.id} view={p} />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="au-adm-cta">
          <Link className="au-adm-link" href="/admin/catalog">
            Каталог (создание/редактирование, изображения, варианты) →
          </Link>
          {' · '}
          <Link className="au-adm-link" href="/admin/inventory">
            Склад · остатки →
          </Link>
        </p>
      </div>
    </div>
  )
}
