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
  isOrderStatus,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from '../../../src/lib/admin/orders'
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
  const orders = await getAdminOrders({ status, query: q })
  const activeStatus = status && isOrderStatus(status) ? status : ''

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <h1 className="au-adm-title">Заказы</h1>
        <span className="au-adm-sub">Локальная админка (dev). Оплата не подключена.</span>
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
