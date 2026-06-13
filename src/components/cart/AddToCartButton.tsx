'use client'

import { useCart } from './CartProvider'

/**
 * AURELIA — AddToCartButton (client) — Этап 9A
 * Used on the product page for available products: adds the product to the
 * cart and opens the drawer. Keeps ProductInfo a server component. No checkout.
 */

export default function AddToCartButton({ slug }: { slug: string }) {
  const { addItem, openCart } = useCart()

  return (
    <button
      className="au-btn au-btn--primary"
      type="button"
      onClick={() => {
        addItem(slug)
        openCart()
      }}
    >
      Купить
    </button>
  )
}
