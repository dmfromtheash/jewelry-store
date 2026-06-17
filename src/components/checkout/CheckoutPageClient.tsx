'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '../cart/CartProvider'
import { formatPrice } from '../../lib/catalog'
import { createOrderDraft } from '../../lib/orders/actions'
import { validateOrderDraftFields, hasErrors } from '../../lib/orders/validate'
import type { OrderDraftInput, OrderFieldErrors } from '../../lib/orders/types'
import {
  DELIVERY_METHODS,
  DELIVERY_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  deliveryMethodLabel,
  paymentMethodLabel,
} from '../../lib/orders/methods'
import { sendAnalyticsEvent } from '../../lib/analytics/client'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'

/**
 * AURELIA — CheckoutPageClient (client) — Этапы 10A → 16A
 *
 * Reads the cart via useCart() and submits a guest order DRAFT to the server
 * action (createOrderDraft). The server recomputes every price from the DB, so
 * the client only sends slugs + quantities + contact fields.
 *
 * Этап 27C — order confirmation: on success the cart is cleared and an inline
 * confirmation state is shown FROM CLIENT STATE (the action's orderCode + the
 * values the customer just submitted). We intentionally do NOT navigate to a
 * by-code public order page, so no order data is fetched by a guessable code and
 * no PII is exposed. Payment is manual (no provider) — the copy says so honestly.
 */

/** What the inline confirmation renders — all from the just-submitted order. */
interface OrderConfirmation {
  orderCode: string
  paymentMethod: string
  deliveryMethod: string
  deliveryDetails: string
}

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default function CheckoutPageClient() {
  const { lines, unavailable, hasUnavailable, count, subtotal, removeItem, clear } = useCart()
  const [confirmation, setConfirmation] = useState<OrderConfirmation | null>(null)

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    // Stored as plain strings (set from <select> values); the server re-validates
    // them against the allowlist in src/lib/orders/methods.ts.
    delivery: DELIVERY_METHODS[0] as string, // self_pickup
    deliveryDetails: '',
    payment: PAYMENT_METHODS[0] as string, // cash_on_delivery
  })
  const [errors, setErrors] = useState<OrderFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  // begin_checkout: fire once when the cart first has items (cart hydrates from
  // localStorage after mount). Counts/totals only — never any contact data.
  const beganCheckout = useRef(false)
  useEffect(() => {
    if (!beganCheckout.current && lines.length > 0) {
      beganCheckout.current = true
      sendAnalyticsEvent(ANALYTICS_EVENTS.beginCheckout, {
        itemCount: count,
        cartTotalMinor: Math.round(subtotal * 100),
      })
    }
  }, [lines.length, count, subtotal])

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSubmit =
    lines.length > 0 &&
    // Block while the cart still holds an item that no longer resolves in the
    // public catalog (e.g. admin-hidden, Этап 26M) — the server would reject it
    // anyway; this gives clearer UX and never ships a doomed order.
    !hasUnavailable &&
    form.name.trim().length > 0 &&
    form.phone.trim().length > 0 &&
    form.city.trim().length > 0 &&
    !pending

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    const payload: OrderDraftInput = {
      customerName: form.name,
      customerPhone: form.phone,
      customerEmail: form.email || undefined,
      deliveryCity: form.city,
      // Send the allowlisted delivery/payment KEYS; the server re-validates them
      // against src/lib/orders/methods.ts (a tampered value is rejected).
      deliveryMethod: form.delivery,
      deliveryDetails: form.deliveryDetails || undefined,
      paymentMethod: form.payment,
      // Only purchasable lines are sent; unavailable items are never included
      // (the server independently re-checks isPublished as the hard guarantee).
      items: lines.map((line) => ({ slug: line.slug, qty: line.qty })),
    }

    // Instant UX feedback using the SAME rules the server enforces.
    const clientErrors = validateOrderDraftFields(payload)
    if (hasErrors(clientErrors)) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)

    try {
      const result = await createOrderDraft(payload)
      if (result.ok) {
        // Snapshot the confirmation from the action result + what was just
        // submitted, THEN clear the cart so the same cart can't be re-submitted.
        setConfirmation({
          orderCode: result.orderCode,
          paymentMethod: payload.paymentMethod,
          deliveryMethod: payload.deliveryMethod,
          deliveryDetails: payload.deliveryDetails ?? '',
        })
        clear() // order is persisted server-side; safe to empty the local cart
        return // confirmation view takes over (keeps `pending` irrelevant)
      }
      setErrors(result.fieldErrors ?? {})
      setGeneralError(result.error)
      setPending(false)
    } catch {
      setGeneralError('Не удалось отправить заказ. Попробуйте ещё раз.')
      setPending(false)
    }
  }

  // Order confirmation takes precedence: after a successful order the cart is
  // empty, so without this it would fall through to the "Корзина пуста" state.
  if (confirmation) {
    const isManualOnline = confirmation.paymentMethod === 'manual_online'
    return (
      <div className="au-container au-checkout">
        <div className="au-co-empty">
          <span className="au-co-empty-ico">
            <GemIcon />
          </span>
          <h1 className="au-co-empty-title">Заказ принят</h1>
          <p className="au-co-empty-sub">
            Спасибо! Мы свяжемся с вами для подтверждения заказа.
          </p>

          <ul className="au-co-list" style={{ width: '100%', maxWidth: 480, textAlign: 'left' }}>
            <li className="au-co-line">
              <span className="au-co-line-meta">Номер заказа</span>
              <span className="au-co-line-name"><strong>{confirmation.orderCode}</strong></span>
            </li>
            <li className="au-co-line">
              <span className="au-co-line-meta">Оплата</span>
              <span className="au-co-line-name">{paymentMethodLabel(confirmation.paymentMethod)}</span>
            </li>
            <li className="au-co-line">
              <span className="au-co-line-meta">Доставка</span>
              <span className="au-co-line-name">{deliveryMethodLabel(confirmation.deliveryMethod)}</span>
            </li>
            {confirmation.deliveryDetails && (
              <li className="au-co-line">
                <span className="au-co-line-meta">Детали доставки</span>
                <span className="au-co-line-name">{confirmation.deliveryDetails}</span>
              </li>
            )}
          </ul>

          <p className="au-co-note" style={{ marginTop: 16 }}>
            {isManualOnline
              ? 'Автоматическая онлайн-оплата на сайте пока не подключена. Реквизиты для оплаты отправит менеджер после подтверждения заказа.'
              : 'Оплата при получении — с вас сейчас ничего не списано.'}
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

  if (lines.length === 0 && unavailable.length === 0) {
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
        <form id="au-checkout-form" className="au-co-form" onSubmit={handleSubmit} noValidate>
          {/* Contacts */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Контакты</h2>
            <div className="au-field">
              <label htmlFor="co-name">Имя</label>
              <input
                id="co-name"
                type="text"
                placeholder="Как к вам обращаться"
                autoComplete="name"
                value={form.name}
                onChange={set('name')}
                aria-invalid={!!errors.customerName}
              />
              {errors.customerName && <p className="au-field-error">{errors.customerName}</p>}
            </div>
            <div className="au-co-row">
              <div className="au-field">
                <label htmlFor="co-phone">Телефон</label>
                <input
                  id="co-phone"
                  type="tel"
                  placeholder="+7 ___ ___-__-__"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={set('phone')}
                  aria-invalid={!!errors.customerPhone}
                />
                {errors.customerPhone && <p className="au-field-error">{errors.customerPhone}</p>}
              </div>
              <div className="au-field">
                <label htmlFor="co-email">E-mail</label>
                <input
                  id="co-email"
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  aria-invalid={!!errors.customerEmail}
                />
                {errors.customerEmail && <p className="au-field-error">{errors.customerEmail}</p>}
              </div>
            </div>
          </section>

          {/* Delivery */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Доставка</h2>
            <div className="au-field">
              <label htmlFor="co-city">Город</label>
              <input
                id="co-city"
                type="text"
                placeholder="Город доставки"
                autoComplete="address-level2"
                value={form.city}
                onChange={set('city')}
                aria-invalid={!!errors.deliveryCity}
              />
              {errors.deliveryCity && <p className="au-field-error">{errors.deliveryCity}</p>}
            </div>
            <div className="au-field">
              <label htmlFor="co-delivery">Способ доставки</label>
              <select
                id="co-delivery"
                className="au-co-select"
                value={form.delivery}
                onChange={set('delivery')}
                aria-invalid={!!errors.deliveryMethod}
              >
                {DELIVERY_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {DELIVERY_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
              {errors.deliveryMethod && <p className="au-field-error">{errors.deliveryMethod}</p>}
            </div>
            <div className="au-field">
              <label htmlFor="co-delivery-details">Отделение / адрес / комментарий</label>
              <input
                id="co-delivery-details"
                type="text"
                placeholder="Напр.: Новая Почта, отделение №12"
                value={form.deliveryDetails}
                onChange={set('deliveryDetails')}
                aria-invalid={!!errors.deliveryDetails}
              />
              {errors.deliveryDetails && (
                <p className="au-field-error">{errors.deliveryDetails}</p>
              )}
            </div>
          </section>

          {/* Payment */}
          <section className="au-co-section">
            <h2 className="au-co-section-title">Оплата</h2>
            <div className="au-field">
              <label htmlFor="co-payment">Способ оплаты</label>
              <select
                id="co-payment"
                className="au-co-select"
                value={form.payment}
                onChange={set('payment')}
                aria-invalid={!!errors.paymentMethod}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABELS[m]}
                  </option>
                ))}
              </select>
              {errors.paymentMethod && <p className="au-field-error">{errors.paymentMethod}</p>}
            </div>
            <div className="au-co-payment-note">
              {form.payment === 'manual_online'
                ? 'Автоматическая онлайн-оплата на сайте не подключена. Реквизиты для перевода пришлём после оформления; оплата подтверждается вручную.'
                : 'Оплата при получении. Оплата через сайт не списывается — расчёт происходит при получении заказа.'}
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
                  {typeof line.product.price === 'number' ? formatPrice(line.lineTotal) : '— ₴'}
                </span>
              </li>
            ))}
            {unavailable.map((entry) => (
              <li className="au-co-line" key={entry.slug}>
                <span className="au-co-line-thumb" aria-hidden="true">
                  <GemIcon />
                </span>
                <div className="au-co-line-main">
                  <p className="au-co-line-name">Товар недоступен</p>
                  <p className="au-co-line-meta">
                    Снят с продажи ·{' '}
                    <button
                      type="button"
                      className="au-cart-remove"
                      onClick={() => removeItem(entry.slug)}
                    >
                      удалить
                    </button>
                  </p>
                </div>
                <span className="au-co-line-price">— ₴</span>
              </li>
            ))}
          </ul>

          {hasUnavailable && (
            <p className="au-field-error" role="alert">
              В корзине есть недоступные товары. Удалите их, чтобы оформить заказ.
            </p>
          )}

          <div className="au-co-total">
            <span>Итого</span>
            <span className="au-co-total-val">{formatPrice(subtotal)}</span>
          </div>

          {(generalError || errors.items) && (
            <p className="au-field-error" role="alert">
              {generalError ?? errors.items}
            </p>
          )}

          <button
            className="au-btn au-btn--primary au-btn--block au-co-submit"
            type="submit"
            form="au-checkout-form"
            disabled={!canSubmit}
          >
            {pending ? 'Создаём заказ…' : 'Оформить заказ'}
          </button>
          <p className="au-co-note">
            Демо-режим: заказ сохраняется, оплата подключается позже.
          </p>
          <p className="au-co-info-link">
            <Link href="/delivery">Подробнее о доставке и оплате</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
