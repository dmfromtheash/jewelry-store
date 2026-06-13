'use client'

import { useEffect } from 'react'
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
  const { isOpen, closeCart, lines, count, subtotal, increment, decrement, removeItem } = useCart()

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
      <aside className="au-cart" role="dialog" aria-modal="true" aria-label="Корзина">
        <header className="au-cart-head">
          <h2 className="au-cart-title">
            Корзина{count > 0 && <span className="au-cart-count">{count}</span>}
          </h2>
          <button className="au-cart-close" type="button" aria-label="Закрыть" onClick={closeCart}>
            <CloseIcon />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="au-cart-empty">
            <span className="au-cart-empty-ico">
              <GemIcon />
            </span>
            <p className="au-cart-empty-title">В корзине пока пусто</p>
            <p className="au-cart-empty-sub">Добавьте украшения из каталога — они появятся здесь.</p>
          </div>
        ) : (
          <>
            <ul className="au-cart-list">
              {lines.map((line) => (
                <li className="au-cart-item" key={line.slug}>
                  <span className="au-cart-thumb" aria-hidden="true">
                    <GemIcon />
                  </span>
                  <div className="au-cart-item-main">
                    <p className="au-cart-item-name">{line.product.name}</p>
                    <p className="au-cart-item-cat">{line.product.category}</p>
                    <div className="au-cart-qty">
                      <button
                        type="button"
                        className="au-cart-qty-btn"
                        aria-label="Уменьшить количество"
                        onClick={() => decrement(line.slug)}
                      >
                        −
                      </button>
                      <span className="au-cart-qty-val">{line.qty}</span>
                      <button
                        type="button"
                        className="au-cart-qty-btn"
                        aria-label="Увеличить количество"
                        onClick={() => increment(line.slug)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="au-cart-item-side">
                    <span className="au-cart-item-price">
                      {typeof line.product.price === 'number' ? formatPrice(line.lineTotal) : '— ₽'}
                    </span>
                    <button
                      type="button"
                      className="au-cart-remove"
                      aria-label="Удалить из корзины"
                      onClick={() => removeItem(line.slug)}
                    >
                      Удалить
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="au-cart-foot">
              <div className="au-cart-total">
                <span>Итого</span>
                <span className="au-cart-total-val">{formatPrice(subtotal)}</span>
              </div>
              <button className="au-btn au-btn--primary au-btn--block" type="button" disabled>
                Оформление скоро
              </button>
              <p className="au-cart-note">Оформление заказа появится в следующих обновлениях.</p>
            </footer>
          </>
        )}
      </aside>
    </div>
  )
}
