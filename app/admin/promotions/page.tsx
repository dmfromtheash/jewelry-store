/**
 * AURELIA — Admin promotions (Этап 63A)
 *
 * Local/dev-only, session-gated promo-code management. Lists promo codes with their
 * type/value, validity, usage, and status; provides a create form and per-row edit
 * (disclosure) + activate/deactivate + archive (soft-delete, no hard delete). All writes go
 * through server-validated, audited actions. noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getAdminPromos } from '../../../src/lib/admin/promotions'
import {
  archivePromoAction,
  togglePromoActiveAction,
} from '../../../src/lib/admin/promotion-actions'
import PromoForm, { type PromoFormValues } from './_components/PromoForm'
import { formatPrice } from '../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Админ · Промокоды — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short' })

function valueLabel(p: { type: string; percentValue: number | null; amountMinor: number | null }): string {
  if (p.type === 'percent') return `${p.percentValue ?? 0}%`
  return formatPrice((p.amountMinor ?? 0) / 100)
}

function windowLabel(startsAt: Date | null, endsAt: Date | null): string {
  if (!startsAt && !endsAt) return 'всегда'
  const s = startsAt ? dateFmt.format(startsAt) : '…'
  const e = endsAt ? dateFmt.format(endsAt) : '…'
  return `${s} — ${e}`
}

export default async function AdminPromotionsPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const promos = await getAdminPromos()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Промокоды</h1>
          <span className="au-adm-sub">
            Ручные скидки на оформление заказа. Деньги — в гривне (₴), процент — 1–100.
            Удаление недоступно: промокод архивируется.
          </span>
        </div>
      </div>

      <div className="au-adm-grid">
        {/* Left: list */}
        <div className="au-adm-card">
          <h2 className="au-adm-card-title">Все промокоды</h2>
          {promos.length === 0 ? (
            <div className="au-adm-empty">
              <p className="au-adm-empty-title">Промокодов пока нет</p>
              <p className="au-adm-empty-sub">Создайте первый промокод в форме справа.</p>
            </div>
          ) : (
            <div className="au-adm-tablewrap">
              <table className="au-adm-table">
                <thead>
                  <tr>
                    <th>Код</th>
                    <th>Скидка</th>
                    <th>Действует</th>
                    <th>Исп. / лимит</th>
                    <th>Статус</th>
                    <th>Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => {
                    const archived = p.archivedAt != null
                    const formValues: PromoFormValues = {
                      id: p.id,
                      code: p.code,
                      internalName: p.internalName,
                      type: p.type,
                      percentValue: p.percentValue,
                      amountMinor: p.amountMinor,
                      minSubtotalMinor: p.minSubtotalMinor,
                      maxDiscountMinor: p.maxDiscountMinor,
                      usageLimit: p.usageLimit,
                      startsAt: p.startsAt ? p.startsAt.toISOString() : null,
                      endsAt: p.endsAt ? p.endsAt.toISOString() : null,
                      notes: p.notes,
                    }
                    return (
                      <tr key={p.id}>
                        <td>
                          <strong>{p.code}</strong>
                          <span className="au-adm-sub"> · {p.internalName}</span>
                          {p.minSubtotalMinor != null && (
                            <span className="au-adm-sub"> · от {formatPrice(p.minSubtotalMinor / 100)}</span>
                          )}
                        </td>
                        <td>{valueLabel(p)}</td>
                        <td>{windowLabel(p.startsAt, p.endsAt)}</td>
                        <td>
                          {p.usedCount}
                          {p.usageLimit != null ? ` / ${p.usageLimit}` : ' / ∞'}
                        </td>
                        <td>
                          <span className="au-adm-sub">
                            {archived ? 'Архив' : p.isActive ? 'Активен' : 'Выключен'}
                          </span>
                        </td>
                        <td>
                          {!archived && (
                            <div className="au-adm-actions" style={{ display: 'grid', gap: 6 }}>
                              <form action={togglePromoActiveAction}>
                                <input type="hidden" name="id" value={p.id} />
                                <input type="hidden" name="active" value={p.isActive ? '0' : '1'} />
                                <button className="au-btn au-btn--ghost" type="submit">
                                  {p.isActive ? 'Выключить' : 'Включить'}
                                </button>
                              </form>
                              <form action={archivePromoAction}>
                                <input type="hidden" name="id" value={p.id} />
                                <button className="au-btn au-btn--ghost" type="submit">
                                  Архивировать
                                </button>
                              </form>
                              <details>
                                <summary className="au-adm-link">Изменить</summary>
                                <PromoForm promo={formValues} />
                              </details>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: create */}
        <aside className="au-adm-aside">
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Новый промокод</h2>
            <PromoForm />
          </div>
        </aside>
      </div>
    </div>
  )
}
