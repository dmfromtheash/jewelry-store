'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCart } from '../cart/CartProvider'
import { formatPrice } from '../../lib/catalog'
import { createOrderDraft } from '../../lib/orders/actions'
import { validateOrderDraftFields, hasErrors } from '../../lib/orders/validate'
import type { OrderDraftInput, OrderFieldErrors } from '../../lib/orders/types'

/**
 * AURELIA — CheckoutPageClient (client) — Этапы 10A → 16A
 *
 * Reads the cart via useCart() and submits a guest order DRAFT to the server
 * action (createOrderDraft). The server recomputes every price from the DB, so
 * the client only sends slugs + quantities + contact fields. On success the
 * cart is cleared and we navigate to /checkout/success?order=<code>. Payment is
 * still not connected — the order is a non-paid draft.
 */

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

const DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Самовывоз — скоро',
  courier: 'Курьер — скоро',
  post: 'Почта — скоро',
}

export default function CheckoutPageClient() {
  const router = useRouter()
  const { entries, lines, count, subtotal, clear } = useCart()

  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    delivery: 'pickup',
  })
  const [errors, setErrors] = useState<OrderFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const set = (key: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }))

  const canSubmit =
    lines.length > 0 &&
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
      deliveryMethod: DELIVERY_LABELS[form.delivery] ?? form.delivery,
      paymentMethod: 'not_connected',
      items: entries.map((entry) => ({ slug: entry.slug, qty: entry.qty })),
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
        clear() // order is persisted server-side; safe to empty the local cart
        router.push(`/checkout/success?order=${encodeURIComponent(result.orderCode)}`)
        return // keep the pending state while navigating away
      }
      setErrors(result.fieldErrors ?? {})
      setGeneralError(result.error)
      setPending(false)
    } catch {
      setGeneralError('Не удалось отправить заказ. Попробуйте ещё раз.')
      setPending(false)
    }
  }

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
              >
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
              Оплата будет подключена позже. Заказ создаётся как черновик —
              с вас сейчас ничего не списывается.
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
