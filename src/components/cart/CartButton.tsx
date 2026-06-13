'use client'

import { useCart } from './CartProvider'

/**
 * AURELIA — CartButton (client) — Этап 9A
 * The header cart icon. Opens the cart drawer and shows the real item count
 * as a badge (hidden when empty). Keeps the Header a server component.
 */

export default function CartButton() {
  const { openCart, count } = useCart()

  return (
    <button className="au-icon-btn" type="button" aria-label="Корзина" onClick={openCart}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M5 8h14l-1.2 11.2a1.8 1.8 0 0 1-1.8 1.6H8a1.8 1.8 0 0 1-1.8-1.6L5 8z" />
        <path d="M8.5 10V6.8a3.5 3.5 0 0 1 7 0V10" />
      </svg>
      {count > 0 && <span className="badge">{count}</span>}
    </button>
  )
}
