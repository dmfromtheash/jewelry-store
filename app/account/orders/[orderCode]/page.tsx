/**
 * AURELIA — Customer order detail (Этап 47B)
 *
 * Server component. Read-only view of ONE of the logged-in customer's OWN orders.
 * Security:
 *   - requires a valid customer session (logged out → redirect to /account, which
 *     shows the login prompt — no redirect loop with the modal auth);
 *   - the order is loaded HARD-SCOPED by (orderCode AND customerId), so another
 *     customer's order code (or a guest order's code) resolves to null → notFound();
 *   - shows only the customer's own snapshot (items, totals, delivery/payment,
 *     status, date) — no admin-only data, no status-change form (read-only).
 * Uses existing storefront classes only — no new design/CSS.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getCurrentCustomer } from '../../../../src/lib/customer/session'
import { getCustomerOrderByCode } from '../../../../src/lib/customer/repo'
import { customerOrderStatusLabel } from '../../../../src/lib/customer/order-display'
import { deliveryMethodLabel, paymentMethodLabel } from '../../../../src/lib/orders/methods'
import { formatPrice } from '../../../../src/lib/catalog'

export const metadata: Metadata = {
  title: 'Замовлення — AURELIA',
  description: 'Деталі замовлення AURELIA.',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AccountOrderDetailPage({
  params,
}: {
  params: Promise<{ orderCode: string }>
}) {
  const customer = await getCurrentCustomer()
  if (!customer) redirect('/account')

  const { orderCode } = await params
  const order = await getCustomerOrderByCode(customer.id, decodeURIComponent(orderCode))
  if (!order) notFound()

  return (
    <div className="au-container au-checkout">
      <p className="au-co-info-link">
        <Link href="/account">← До кабінету</Link>
      </p>
      <h1 className="au-co-title">Замовлення {order.orderCode}</h1>

      <div className="au-checkout-grid">
        {/* ---- Left: contents + total ---- */}
        <div>
          <section className="au-co-section">
            <h2 className="au-co-section-title">Склад замовлення</h2>
            <ul className="au-co-list">
              {order.items.map((item, i) => (
                <li className="au-co-line" key={`${item.productName}-${i}`}>
                  <div className="au-co-line-main">
                    <p className="au-co-line-name">
                      {item.productName}
                      {item.variantValue && ` · ${item.variantValue}`}
                    </p>
                    <p className="au-co-line-meta">
                      {formatPrice(item.unitPrice / 100)} × {item.quantity}
                      {item.productSku && ` · ${item.productSku}`}
                    </p>
                  </div>
                  <span className="au-co-line-price">{formatPrice(item.lineTotal / 100)}</span>
                </li>
              ))}
            </ul>

            {order.discountMinor > 0 && (
              <>
                <div className="au-co-total">
                  <span>Сума</span>
                  <span className="au-co-total-val">{formatPrice(order.subtotalAmount / 100)}</span>
                </div>
                <div className="au-co-total">
                  <span>Знижка{order.promoCode ? ` (${order.promoCode})` : ''}</span>
                  <span className="au-co-total-val">−{formatPrice(order.discountMinor / 100)}</span>
                </div>
              </>
            )}
            <div className="au-co-total">
              <span>Разом</span>
              <span className="au-co-total-val">{formatPrice(order.totalAmount / 100)}</span>
            </div>

            <p className="au-co-note">
              Оплата підтверджується вручну за обраним способом. Автоматична онлайн-оплата на
              сайті не підключена.
            </p>
          </section>
        </div>

        {/* ---- Right: status + delivery summary ---- */}
        <aside className="au-co-summary">
          <h2 className="au-co-section-title">Деталі</h2>
          <ul className="au-co-list">
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">Статус</span>
                <p className="au-co-line-name">{customerOrderStatusLabel(order.status)}</p>
              </div>
            </li>
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">Оформлено</span>
                <p className="au-co-line-name">{dateFmt.format(order.createdAt)}</p>
              </div>
            </li>
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">Місто</span>
                <p className="au-co-line-name">{order.deliveryCity}</p>
              </div>
            </li>
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">Доставка</span>
                <p className="au-co-line-name">{deliveryMethodLabel(order.deliveryMethod)}</p>
              </div>
            </li>
            {order.deliveryBranch && (
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Відділення / склад</span>
                  <p className="au-co-line-name">{order.deliveryBranch}</p>
                </div>
              </li>
            )}
            {order.deliveryDetails && (
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Адреса</span>
                  <p className="au-co-line-name">{order.deliveryDetails}</p>
                </div>
              </li>
            )}
            {order.deliveryComment && (
              <li className="au-co-line">
                <div className="au-co-line-main">
                  <span className="au-co-line-meta">Коментар</span>
                  <p className="au-co-line-name">{order.deliveryComment}</p>
                </div>
              </li>
            )}
            <li className="au-co-line">
              <div className="au-co-line-main">
                <span className="au-co-line-meta">Оплата</span>
                <p className="au-co-line-name">{paymentMethodLabel(order.paymentMethod)}</p>
              </div>
            </li>
          </ul>

          <p className="au-co-info-link">
            <Link href="/category/bijouterie">До каталогу</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
