'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useCart } from './CartProvider'
import { formatPrice } from '../../lib/catalog'

/**
 * AURELIA — CartDrawer (client) — Этап 9A
 * Right-side cart panel in the AURELIA style. Empty state, line items with a
 * quantity stepper + remove, subtotal and a disabled "checkout soon" button.
 * Frontend only — no checkout. Closes on overlay click / Escape; locks body
 * scroll while open (same pattern as the auth modals).
 */

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M3 3l10 10M13 3L3 13" />
  </svg>
)

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default function CartDrawer() {
  const { isOpen, closeCart, lines, unavailable, count, subtotal, increment, decrement, removeItem } =
    useCart()

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCart()
    }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, closeCart])

  if (!isOpen) return null

  return (
    <div
      className="au-cart-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeCart()
      }}
    >
      <aside className="au-cart" role="dialog" aria-modal="true" aria-label="Кошик">
        <header className="au-cart-head">
          <h2 className="au-cart-title">
            Кошик{count > 0 && <span className="au-cart-count">{count}</span>}
          </h2>
          <button className="au-cart-close" type="button" aria-label="Закрити" onClick={closeCart}>
            <CloseIcon />
          </button>
        </header>

        {lines.length === 0 && unavailable.length === 0 ? (
          <div className="au-cart-empty">
            <span className="au-cart-empty-ico">
              <GemIcon />
            </span>
            <p className="au-cart-empty-title">У кошику поки порожньо</p>
            <p className="au-cart-empty-sub">Додайте прикраси з каталогу — вони зʼявляться тут.</p>
          </div>
        ) : (
          <>
            {lines.length > 0 && (
            <ul className="au-cart-list">
              {lines.map((line) => (
                <li className="au-cart-item" key={`${line.slug}::${line.variantId ?? ''}`}>
                  <span className="au-cart-thumb" aria-hidden="true">
                    <GemIcon />
                  </span>
                  <div className="au-cart-item-main">
                    <p className="au-cart-item-name">{line.product.name}</p>
                    <p className="au-cart-item-cat">
                      {line.variantLabel
                        ? `${line.product.category} · ${line.variantLabel}`
                        : line.product.category}
                    </p>
                    <div className="au-cart-qty">
                      <button
                        type="button"
                        className="au-cart-qty-btn"
                        aria-label="Зменшити кількість"
                        onClick={() => decrement(line.slug, line.variantId)}
                      >
                        −
                      </button>
                      <span className="au-cart-qty-val">{line.qty}</span>
                      <button
                        type="button"
                        className="au-cart-qty-btn"
                        aria-label="Збільшити кількість"
                        onClick={() => increment(line.slug, line.variantId)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="au-cart-item-side">
                    <span className="au-cart-item-price">{formatPrice(line.lineTotal)}</span>
                    <button
                      type="button"
                      className="au-cart-remove"
                      aria-label="Видалити з кошика"
                      onClick={() => removeItem(line.slug, line.variantId)}
                    >
                      Видалити
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            )}

            {unavailable.length > 0 && (
              <ul className="au-cart-list">
                {unavailable.map((entry) => (
                  <li className="au-cart-item" key={`${entry.slug}::${entry.variantId ?? ''}`}>
                    <span className="au-cart-thumb" aria-hidden="true">
                      <GemIcon />
                    </span>
                    <div className="au-cart-item-main">
                      <p className="au-cart-item-name">Товар недоступний</p>
                      <p className="au-cart-item-cat">Знято з продажу — видаліть із кошика</p>
                    </div>
                    <div className="au-cart-item-side">
                      <span className="au-cart-item-price">— ₴</span>
                      <button
                        type="button"
                        className="au-cart-remove"
                        aria-label="Видалити з кошика"
                        onClick={() => removeItem(entry.slug, entry.variantId)}
                      >
                        Видалити
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <footer className="au-cart-foot">
              <div className="au-cart-total">
                <span>Разом</span>
                <span className="au-cart-total-val">{formatPrice(subtotal)}</span>
              </div>
              {lines.length > 0 ? (
                <Link
                  className="au-btn au-btn--primary au-btn--block"
                  href="/checkout"
                  onClick={closeCart}
                >
                  Оформити замовлення
                </Link>
              ) : (
                <p className="au-cart-note">
                  У кошику немає доступних товарів — додайте прикраси з каталогу.
                </p>
              )}
              {unavailable.length > 0 && lines.length > 0 && (
                <p className="au-cart-note">
                  Видаліть недоступні товари, щоб перейти до оформлення.
                </p>
              )}
              {lines.length > 0 && (
                <p className="au-cart-note">Демо-оформлення — оплата підключається пізніше.</p>
              )}
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
