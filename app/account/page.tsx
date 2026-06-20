/**
 * AURELIA — Customer account page (Этап 47A)
 *
 * Server component. Requires a valid customer session: when logged out it renders
 * an in-page login prompt (opens the existing modal) instead of redirecting, so
 * there is no redirect loop with the modal-based auth. When logged in it shows the
 * profile (name/email/phone), the customer's OWN order history (hard-scoped by
 * customerId in the data layer — a customer can never see another's orders) and a
 * logout action. Uses existing storefront classes only — no new design/CSS.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentCustomer } from '../../src/lib/customer/session'
import { getCustomerOrders } from '../../src/lib/customer/repo'
import { logoutCustomerAction } from '../../src/lib/customer/actions'
import { customerOrderStatusLabel } from '../../src/lib/customer/order-display'
import { deliveryMethodLabel, paymentMethodLabel } from '../../src/lib/orders/methods'
import { formatPrice } from '../../src/lib/catalog'
import OpenLoginButton from './_components/OpenLoginButton'

export const metadata: Metadata = {
  title: 'Особистий кабінет — AURELIA',
  description: 'Особистий кабінет AURELIA: профіль та історія замовлень.',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium', timeStyle: 'short' })

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default async function AccountPage() {
  const customer = await getCurrentCustomer()

  // Not logged in → in-page prompt that opens the existing login modal.
  if (!customer) {
    return (
      <div className="au-container au-checkout">
        <div className="au-co-empty">
          <span className="au-co-empty-ico">
            <GemIcon />
          </span>
          <h1 className="au-co-empty-title">Особистий кабінет</h1>
          <p className="au-co-empty-sub">Увійдіть, щоб переглянути профіль та історію замовлень.</p>
          <div className="au-co-empty-actions">
            <OpenLoginButton>Увійти</OpenLoginButton>
            <Link className="au-btn au-btn--ghost" href="/">
              На головну
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const orders = await getCustomerOrders(customer.id)

  return (
    <div className="au-container au-checkout">
      <h1 className="au-co-title">Особистий кабінет</h1>

      <div className="au-checkout-grid">
        {/* ---- Left: profile ---- */}
        <section className="au-co-section">
          <h2 className="au-co-section-title">Профіль</h2>
          <ul className="au-co-list">
            {customer.name && (
              <li className="au-co-line">
                <span className="au-co-line-meta">Імʼя</span>
                <span className="au-co-line-name">{customer.name}</span>
              </li>
            )}
            <li className="au-co-line">
              <span className="au-co-line-meta">E-mail</span>
              <span className="au-co-line-name">{customer.email}</span>
            </li>
            {customer.phone && (
              <li className="au-co-line">
                <span className="au-co-line-meta">Телефон</span>
                <span className="au-co-line-name">{customer.phone}</span>
              </li>
            )}
          </ul>

          <form action={logoutCustomerAction}>
            <button className="au-btn au-btn--ghost au-btn--block" type="submit">
              Вийти
            </button>
          </form>
        </section>

        {/* ---- Right: order history ---- */}
        <aside className="au-co-summary">
          <h2 className="au-co-section-title">
            Мої замовлення{orders.length > 0 && <span className="au-co-summary-count">{orders.length}</span>}
          </h2>

          {orders.length === 0 ? (
            <p className="au-co-empty-sub">
              У вас ще немає замовлень. Оформіть перше — і воно зʼявиться тут.
            </p>
          ) : (
            <ul className="au-co-list">
              {orders.map((order) => (
                <li className="au-co-line" key={order.orderCode}>
                  <div className="au-co-line-main">
                    <p className="au-co-line-name">
                      <strong>{order.orderCode}</strong> · {customerOrderStatusLabel(order.status)}
                    </p>
                    <p className="au-co-line-meta">
                      {dateFmt.format(order.createdAt)} · {order._count.items} поз. ·{' '}
                      {deliveryMethodLabel(order.deliveryMethod)} · {paymentMethodLabel(order.paymentMethod)}
                    </p>
                  </div>
                  <span className="au-co-line-price">{formatPrice(order.totalAmount / 100)}</span>
                </li>
              ))}
            </ul>
          )}

          <p className="au-co-info-link">
            <Link href="/category/bijouterie">До каталогу</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
