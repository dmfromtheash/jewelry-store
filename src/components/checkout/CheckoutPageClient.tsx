'use client'

import Link from 'next/link'
import { useCart } from '../cart/CartProvider'
import { formatPrice } from '../../lib/catalog'

/**
 * AURELIA — CheckoutPageClient (client) — Этап 10A
 *
 * Frontend-only checkout. Reads the cart via useCart() (data resolved from the
 * mock catalog — never duplicated here). Shows an order summary plus contact /
 * delivery / payment blocks as a static demo: nothing is submitted anywhere, no
 * backend/API/payment, and the cart is NOT cleared.
 */

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default function CheckoutPageClient() {
  const { lines, count, subtotal } = useCart()

  if (lines.length === 0) {
    return (
      <div className="au-container au-checkout">
        <div className="au-co-empty">
          <span className="au-co-empty-ico">
            <GemIcon />
          </span>
          <h1 className="au-co-empty-title">Корзина пуста</h1>
          <p className="au-co-empty-sub">
            Добавьте украшения в корзину, чтобы оформить заказ.
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

  return (
    <div className="au-container au-checkout">
      <h1 className="au-co-title">Оформление заказа</h1>

      <div className="au-checkout-grid">
        {/* ---- Left: forms ---- */}
        <form className="au-co-form" onSubmit={(e) => e.preventDefault()}>
          {/* Contacts */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Контакты</h2>
            <div className="au-field">
              <label htmlFor="co-name">Имя</label>
              <input id="co-name" type="text" placeholder="Как к вам обращаться" autoComplete="name" />
            </div>
            <div className="au-co-row">
              <div className="au-field">
                <label htmlFor="co-phone">Телефон</label>
                <input id="co-phone" type="tel" placeholder="+7 ___ ___-__-__" autoComplete="tel" />
              </div>
              <div className="au-field">
                <label htmlFor="co-email">E-mail</label>
                <input id="co-email" type="email" placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>
          </section>

          {/* Delivery */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Доставка</h2>
            <div className="au-field">
              <label htmlFor="co-city">Город</label>
              <input id="co-city" type="text" placeholder="Город доставки" autoComplete="address-level2" />
            </div>
            <div className="au-field">
              <label htmlFor="co-delivery">Способ доставки</label>
              <select id="co-delivery" className="au-co-select" defaultValue="pickup">
                <option value="pickup">Самовывоз — скоро</option>
                <option value="courier">Курьер — скоро</option>
                <option value="post">Почта — скоро</option>
              </select>
            </div>
          </section>

          {/* Payment */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Оплата</h2>
            <div className="au-co-payment-note">
              Оплата будет подключена позже. Сейчас оформление работает в демо-режиме —
              заказ никуда не отправляется.
            </div>
          </section>
        </form>

        {/* ---- Right: order summary ---- */}
        <aside className="au-co-summary">
          <h2 className="au-co-section-title">
            Ваш заказ{count > 0 && <span className="au-co-summary-count">{count}</span>}
          </h2>

          <ul className="au-co-list">
            {lines.map((line) => (
              <li className="au-co-line" key={line.slug}>
                <span className="au-co-line-thumb" aria-hidden="true">
                  <GemIcon />
                </span>
                <div className="au-co-line-main">
                  <p className="au-co-line-name">{line.product.name}</p>
                  <p className="au-co-line-meta">
                    {line.product.category} · {line.qty} шт.
                  </p>
                </div>
                <span className="au-co-line-price">
                  {typeof line.product.price === 'number' ? formatPrice(line.lineTotal) : '— ₽'}
                </span>
              </li>
            ))}
          </ul>

          <div className="au-co-total">
            <span>Итого</span>
            <span className="au-co-total-val">{formatPrice(subtotal)}</span>
          </div>

          <button className="au-btn au-btn--primary au-btn--block au-co-submit" type="button" disabled>
            Оформить заказ (демо)
          </button>
          <p className="au-co-note">
            Демо-режим: данные не отправляются, корзина не очищается.
          </p>
          <p className="au-co-info-link">
            <Link href="/delivery">Подробнее о доставке и оплате</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
