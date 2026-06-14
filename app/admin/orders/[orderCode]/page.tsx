/**
 * AURELIA — Admin order detail (Этап 17A)
 *
 * Local/dev-only order detail (guarded). Shows contact + delivery + items +
 * totals and a status-change form wired to a server action. No delete, no
 * payment. PII is shown only here, behind the local admin guard.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureLocalAdmin } from '../../../../src/lib/admin/guard'
import {
  getAdminOrderByCode,
  ORDER_STATUSES,
  ORDER_STATUS_LABELS,
} from '../../../../src/lib/admin/orders'
import { updateOrderStatusAction } from '../../../../src/lib/admin/actions'
import { formatPrice } from '../../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Админ · Заказ — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderCode: string }>
}) {
  await ensureLocalAdmin()

  const { orderCode } = await params
  const order = await getAdminOrderByCode(decodeURIComponent(orderCode))
  if (!order) notFound()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <Link className="au-adm-link" href="/admin/orders">
            ← Все заказы
          </Link>
          <h1 className="au-adm-title">Заказ {order.orderCode}</h1>
        </div>
        <span className={`au-adm-badge au-adm-badge--${order.status}`}>
          {ORDER_STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="au-adm-grid">
        {/* Left: order contents */}
        <div className="au-adm-card">
          <h2 className="au-adm-card-title">Состав заказа</h2>
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Товар</th>
                <th>Артикул</th>
                <th>Цена</th>
                <th>Кол-во</th>
                <th>Сумма</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, i) => (
                <tr key={`${item.productSlug}-${i}`}>
                  <td>{item.productName}</td>
                  <td>{item.productSku ?? '—'}</td>
                  <td>{formatPrice(item.unitPrice / 100)}</td>
                  <td>{item.quantity}</td>
                  <td>{formatPrice(item.lineTotal / 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="au-adm-totals">
            <div>
              <span>Подытог</span>
              <span>{formatPrice(order.subtotalAmount / 100)}</span>
            </div>
            <div className="au-adm-totals-grand">
              <span>Итого</span>
              <span>{formatPrice(order.totalAmount / 100)}</span>
            </div>
          </div>

          <p className="au-adm-note">
            Оплата пока не подключена — заказ хранится как черновик/демо. Списаний нет.
          </p>
        </div>

        {/* Right: customer, delivery, status */}
        <aside className="au-adm-aside">
          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Клиент</h2>
            <dl className="au-adm-dl">
              <dt>Имя</dt>
              <dd>{order.customerName}</dd>
              <dt>Телефон</dt>
              <dd>{order.customerPhone}</dd>
              <dt>E-mail</dt>
              <dd>{order.customerEmail ?? '—'}</dd>
            </dl>
          </div>

          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Доставка</h2>
            <dl className="au-adm-dl">
              <dt>Город</dt>
              <dd>{order.deliveryCity}</dd>
              <dt>Способ</dt>
              <dd>{order.deliveryMethod}</dd>
              <dt>Оплата</dt>
              <dd>{order.paymentMethod}</dd>
              <dt>Создан</dt>
              <dd>{dateFmt.format(order.createdAt)}</dd>
            </dl>
          </div>

          <div className="au-adm-card">
            <h2 className="au-adm-card-title">Статус заказа</h2>
            <form action={updateOrderStatusAction} className="au-adm-statusform">
              <input type="hidden" name="orderCode" value={order.orderCode} />
              <select className="au-adm-select" name="status" defaultValue={order.status}>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {ORDER_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
              <button className="au-btn au-btn--primary au-btn--block" type="submit">
                Сохранить статус
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  )
}
