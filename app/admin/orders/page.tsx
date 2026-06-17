/**
 * AURELIA — Admin orders list (Этап 17A)
 *
 * Local/dev-only order list (guarded by ensureLocalAdmin). Filter by status +
 * search by orderCode / customer name / phone. Reads from PostgreSQL. NOT linked
 * from public navigation; noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import {
  getAdminOrders,
  getNeedsAttentionOrderCount,
  isOrderStatus,
  NEEDS_ATTENTION_STATUS,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from '../../../src/lib/admin/orders'
import { deliveryMethodLabel } from '../../../src/lib/orders/methods'
import { formatPrice } from '../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Админ · Заказы — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { status, q } = await searchParams
  const [orders, needsAttention] = await Promise.all([
    getAdminOrders({ status, query: q }),
    getNeedsAttentionOrderCount(),
  ])
  const activeStatus = status && isOrderStatus(status) ? status : ''
  const viewingInbox = activeStatus === NEEDS_ATTENTION_STATUS

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <h1 className="au-adm-title">Заказы</h1>
        <span className="au-adm-sub">Локальная админка (dev). Оплата подтверждается вручную.</span>
      </div>

      {/* Этап 27D — new-orders inbox: a clear "needs attention" entry point. */}
      <div className="au-adm-card">
        {needsAttention > 0 ? (
          <p className="au-adm-note">
            <strong>Новые заказы, требующие обработки: {needsAttention}.</strong>{' '}
            {viewingInbox ? (
              <Link className="au-adm-link" href="/admin/orders">
                Показать все заказы →
              </Link>
            ) : (
              <Link className="au-adm-link" href={`/admin/orders?status=${NEEDS_ATTENTION_STATUS}`}>
                Показать только новые →
              </Link>
            )}
          </p>
        ) : (
          <p className="au-adm-note">Новых заказов, требующих обработки, нет.</p>
        )}
      </div>

      <form className="au-adm-toolbar" method="get" action="/admin/orders">
        <input
          className="au-adm-input"
          type="search"
          name="q"
          placeholder="Поиск: номер, имя, телефон"
          defaultValue={q ?? ''}
        />
        <select className="au-adm-select" name="status" defaultValue={activeStatus}>
          <option value="">Все статусы</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button className="au-btn au-btn--primary" type="submit">
          Применить
        </button>
        {(q || activeStatus) && (
          <Link className="au-btn au-btn--ghost" href="/admin/orders">
            Сбросить
          </Link>
        )}
      </form>

      {orders.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Заказов нет</p>
          <p className="au-adm-empty-sub">
            {q || activeStatus
              ? 'Ничего не найдено по выбранным условиям.'
              : 'Оформите заказ в витрине, чтобы он появился здесь.'}
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Номер</th>
                <th>Статус</th>
                <th>Клиент</th>
                <th>Город</th>
                <th>Доставка</th>
                <th>Позиций</th>
                <th>Сумма</th>
                <th>Создан</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderCode}>
                  <td>
                    <Link className="au-adm-link" href={`/admin/orders/${o.orderCode}`}>
                      {o.orderCode}
                    </Link>
                  </td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${o.status}`}>
                      {ORDER_STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td>{o.customerName}</td>
                  <td>{o.deliveryCity}</td>
                  <td>{deliveryMethodLabel(o.deliveryMethod)}</td>
                  <td>{o._count.items}</td>
                  <td>{formatPrice(o.totalAmount / 100)}</td>
                  <td>{dateFmt.format(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
