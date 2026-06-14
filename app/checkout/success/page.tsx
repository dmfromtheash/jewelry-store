/**
 * AURELIA — Checkout success (Этап 16A)
 *
 * Shows the created draft order by its code (?order=AUR-XXXXXXXX). Honest demo
 * copy: the order is stored, but payment and processing are not connected yet.
 * Server component — reads the order summary from the DB (no customer PII).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { formatPrice } from '../../../src/lib/catalog'
import { getOrderSummaryByCode } from '../../../src/lib/orders/read'

export const metadata: Metadata = {
  title: 'Заказ создан — AURELIA',
  description: 'Черновик заказа AURELIA создан (демо-режим).',
}

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order: orderCode } = await searchParams
  const order = orderCode ? await getOrderSummaryByCode(orderCode) : null

  return (
    <div className="au-container au-checkout">
      <div className="au-co-empty">
        <span className="au-co-empty-ico">
          <GemIcon />
        </span>
        <h1 className="au-co-empty-title">Заказ создан</h1>

        {order ? (
          <>
            <p className="au-co-empty-sub">
              Номер заказа: <strong>{order.orderCode}</strong>
            </p>

            <ul className="au-co-list" style={{ textAlign: 'left', width: '100%', maxWidth: 480 }}>
              {order.items.map((item, i) => (
                <li className="au-co-line" key={`${item.productName}-${i}`}>
                  <div className="au-co-line-main">
                    <p className="au-co-line-name">{item.productName}</p>
                    <p className="au-co-line-meta">{item.quantity} шт.</p>
                  </div>
                  <span className="au-co-line-price">{formatPrice(item.lineTotal / 100)}</span>
                </li>
              ))}
            </ul>

            <div className="au-co-total" style={{ width: '100%', maxWidth: 480 }}>
              <span>Итого</span>
              <span className="au-co-total-val">{formatPrice(order.totalAmount / 100)}</span>
            </div>
          </>
        ) : (
          <p className="au-co-empty-sub">
            {orderCode
              ? `Заказ «${orderCode}» не найден.`
              : 'Заказ оформлен. Подробности отправим позже.'}
          </p>
        )}

        <p className="au-co-note" style={{ marginTop: 16 }}>
          Заказ создан в демо-режиме. Оплата и обработка заказов будут подключены позже —
          сейчас с вас ничего не списано.
        </p>

        <div className="au-co-empty-actions">
          <Link className="au-btn au-btn--primary" href="/category/bijouterie">
            В каталог
          </Link>
          <Link className="au-btn au-btn--ghost" href="/">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
