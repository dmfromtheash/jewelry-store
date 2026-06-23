/**
 * AURELIA — Admin inventory & stock operations (Этап 70A)
 *
 * Local/dev-only stock command center (guarded by ensureLocalAdmin + requireAdminSession). Shows
 * stock health across products + variants, surfaces zero/low/negative levels that need attention,
 * lets the owner make a SAFE manual stock adjustment (validated server-side, recorded in the
 * movement ledger + audit log), and shows the recent movement history.
 *
 * It is NOT a warehouse-management / supplier / procurement / barcode / multi-location system — it
 * only describes + safely edits the existing per-product / per-variant `stockQuantity`. No secrets,
 * tokens, or PII are rendered. Not linked from public navigation; noindex (admin layout default).
 */

import { Fragment } from 'react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import {
  getInventoryOverview,
  getRecentStockMovements,
  type InventoryProductRow,
} from '../../../src/lib/inventory/inventory-data'
import { adjustStockAction } from '../../../src/lib/inventory/inventory-actions'
import type { StockState } from '../../../src/lib/inventory/stock-health'

export const metadata: Metadata = {
  title: 'Админ · Склад — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' })

const STATE_LABEL: Record<StockState, string> = {
  untracked: 'Не отслеж.',
  out: 'Нет в наличии',
  low: 'Мало',
  healthy: 'В норме',
  negative: 'Отрицательный',
}
// Reuse existing admin badge palette (no new CSS): action=red, warn=amber, ok=green, pending=grey.
const STATE_BADGE: Record<StockState, string> = {
  untracked: 'au-adm-badge--pending',
  out: 'au-adm-badge--action',
  low: 'au-adm-badge--warn',
  healthy: 'au-adm-badge--ok',
  negative: 'au-adm-badge--fail',
}

const OK_MESSAGES: Record<string, string> = {
  adjusted: 'Остаток обновлён, движение записано в журнал.',
}
const ERR_MESSAGES: Record<string, string> = {
  target: 'Не найден товар или вариант для корректировки.',
  mode: 'Выберите режим корректировки.',
  value: 'Введите корректное целое число.',
  untracked: 'Этот уровень не отслеживается — сначала задайте остаток режимом «Установить».',
  negative: 'Остаток не может стать отрицательным.',
  noop: 'Значение не изменилось.',
  note: 'Заметка слишком длинная или содержит запрещённые символы.',
  stale: 'Остаток только что изменился — обновите страницу и повторите.',
}

function fmtQty(q: number | null): string {
  return q == null ? '—' : String(q)
}

/** Compact inline adjustment form for one level (product or variant). Plain HTML, no client JS. */
function AdjustForm({
  level,
  targetId,
  current,
}: {
  level: 'product' | 'variant'
  targetId: string
  current: number | null
}) {
  return (
    <form action={adjustStockAction} className="au-adm-statusform">
      <input type="hidden" name="level" value={level} />
      <input type="hidden" name="targetId" value={targetId} />
      <select className="au-adm-select" name="mode" defaultValue="set" aria-label="Режим">
        <option value="set">Установить</option>
        <option value="delta">Изменить на (±)</option>
      </select>
      <input
        className="au-adm-input"
        type="text"
        name="value"
        inputMode="numeric"
        placeholder={current == null ? 'напр. 10' : 'напр. 10 или -2'}
        aria-label="Значение"
        style={{ width: '6rem' }}
      />
      <input
        className="au-adm-input"
        type="text"
        name="note"
        maxLength={200}
        placeholder="Заметка (необяз.)"
        aria-label="Заметка"
      />
      <button className="au-btn au-btn--primary" type="submit">
        Применить
      </button>
    </form>
  )
}

function ProductLevelRow({ p }: { p: InventoryProductRow }) {
  return (
    <tr>
      <td>
        <Link className="au-adm-link" href={`/admin/catalog/${p.id}/edit`}>
          {p.name}
        </Link>
        <span className="au-adm-sub"> · {p.sku ?? p.slug}</span>
        {!p.isPublished && <span className="au-adm-sub"> · скрыт</span>}
        {p.status !== 'available' && <span className="au-adm-sub"> · скоро</span>}
      </td>
      <td>товар</td>
      <td>{fmtQty(p.stockQuantity)}</td>
      <td>
        <span className={`au-adm-badge ${STATE_BADGE[p.state]}`}>{STATE_LABEL[p.state]}</span>
      </td>
      <td>
        <AdjustForm level="product" targetId={p.id} current={p.stockQuantity} />
      </td>
    </tr>
  )
}

function VariantLevelRows({ p }: { p: InventoryProductRow }) {
  return (
    <>
      {p.variants.map((v) => (
        <tr key={v.id}>
          <td>
            <span className="au-adm-sub">↳ {p.name} · </span>
            {v.value}
            {v.isDefault && <span className="au-adm-sub"> (по умолч.)</span>}
          </td>
          <td>вариант</td>
          <td>{fmtQty(v.stockQuantity)}</td>
          <td>
            <span className={`au-adm-badge ${STATE_BADGE[v.state]}`}>{STATE_LABEL[v.state]}</span>
          </td>
          <td>
            <AdjustForm level="variant" targetId={v.id} current={v.stockQuantity} />
          </td>
        </tr>
      ))}
    </>
  )
}

export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { ok, err } = await searchParams
  const [{ summary, products, problems }, movements] = await Promise.all([
    getInventoryOverview(),
    getRecentStockMovements(),
  ])

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Склад · остатки</h1>
          <span className="au-adm-sub">
            Состояние остатков, ручная корректировка и история движений. Порог «мало» —
            ≤ {summary.threshold} шт. (глобальный, без отдельных порогов по товарам). Это НЕ
            складская/закупочная система: нет поставщиков, штрихкодов и нескольких складов —
            только остаток товара/варианта на этой витрине.
          </span>
        </div>
      </div>

      {ok && OK_MESSAGES[ok] && (
        <div className="au-adm-card">
          <p className="au-adm-note">✓ {OK_MESSAGES[ok]}</p>
        </div>
      )}
      {err && (
        <div className="au-adm-card">
          <p className="au-adm-note">✗ {ERR_MESSAGES[err] ?? 'Не удалось выполнить корректировку.'}</p>
        </div>
      )}

      {/* ---- Health summary ---- */}
      <h2 className="au-adm-section-title">Состояние остатков</h2>
      <div className="au-adm-kpis">
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Товаров</span>
          <span className="au-adm-kpi-value">{summary.productsTotal}</span>
          <span className="au-adm-kpi-hint">отслеживается {summary.productsTracked}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Нет в наличии</span>
          <span className="au-adm-kpi-value">{summary.productsOut}</span>
          <span className="au-adm-kpi-hint">в продаже: {summary.zeroStockPurchasable}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Мало (≤ {summary.threshold})</span>
          <span className="au-adm-kpi-value">{summary.productsLow}</span>
          <span className="au-adm-kpi-hint">в продаже: {summary.lowStockPurchasable}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">В норме</span>
          <span className="au-adm-kpi-value">{summary.productsHealthy}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Не отслеж.</span>
          <span className="au-adm-kpi-value">{summary.productsUntracked}</span>
          <span className="au-adm-kpi-hint">остаток не задан</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Отрицательные</span>
          <span className="au-adm-kpi-value">{summary.productsNegative + summary.variantsNegative}</span>
          <span className="au-adm-kpi-hint">аномалия — исправьте</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Варианты</span>
          <span className="au-adm-kpi-value">{summary.variantsTotal}</span>
          <span className="au-adm-kpi-hint">отслеж. {summary.variantsTracked}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Варианты: нет/мало</span>
          <span className="au-adm-kpi-value">{summary.variantsOut + summary.variantsLow}</span>
        </div>
      </div>

      {/* ---- Needs attention ---- */}
      <h2 className="au-adm-section-title">Требует внимания</h2>
      <div className="au-adm-card">
        {problems.length === 0 ? (
          <p className="au-adm-note">Проблемных остатков нет — всё в норме или не отслеживается.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Товар / вариант</th>
                  <th>Уровень</th>
                  <th>Остаток</th>
                  <th>Состояние</th>
                  <th>Корректировка</th>
                </tr>
              </thead>
              <tbody>
                {problems.map((p) => (
                  <Fragment key={`att-${p.id}`}>
                    {p.state !== 'healthy' && p.state !== 'untracked' && <ProductLevelRow p={p} />}
                    <VariantLevelRows
                      p={{
                        ...p,
                        variants: p.variants.filter(
                          (v) => v.state === 'out' || v.state === 'low' || v.state === 'negative',
                        ),
                      }}
                    />
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Recent movements ---- */}
      <h2 className="au-adm-section-title">Последние движения</h2>
      <div className="au-adm-card">
        {movements.length === 0 ? (
          <p className="au-adm-note">Движений ещё не было.</p>
        ) : (
          <div className="au-adm-tablewrap">
            <table className="au-adm-table">
              <thead>
                <tr>
                  <th>Когда</th>
                  <th>Причина</th>
                  <th>Товар</th>
                  <th>Уровень</th>
                  <th>Δ</th>
                  <th>Было → стало</th>
                  <th>Заказ / автор</th>
                  <th>Заметка</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{dateFmt.format(m.createdAt)}</td>
                    <td>{m.reasonLabel}</td>
                    <td>
                      {m.productSlug ? (
                        <Link className="au-adm-link" href={`/admin/catalog`}>
                          {m.productName}
                        </Link>
                      ) : (
                        <span className="au-adm-sub">{m.productName ?? m.productId ?? '—'}</span>
                      )}
                    </td>
                    <td>{m.level === 'variant' ? 'вариант' : 'товар'}</td>
                    <td>{m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                    <td>
                      {fmtQty(m.quantityBefore)} → {fmtQty(m.quantityAfter)}
                    </td>
                    <td>{m.orderCode ?? m.actorLabel ?? '—'}</td>
                    <td>{m.note ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---- Full inventory ---- */}
      <h2 className="au-adm-section-title">Все остатки</h2>
      <div className="au-adm-card">
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Товар / вариант</th>
                <th>Уровень</th>
                <th>Остаток</th>
                <th>Состояние</th>
                <th>Корректировка</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <Fragment key={p.id}>
                  <ProductLevelRow p={p} />
                  <VariantLevelRows p={p} />
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="au-adm-cta">
          <Link className="au-adm-link" href="/admin/catalog">
            Каталог (цены, статус, варианты) →
          </Link>
        </p>
      </div>
    </div>
  )
}
