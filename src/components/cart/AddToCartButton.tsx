'use client'

import { useCart } from './CartProvider'

/**
 * AURELIA — AddToCartButton (client) — Этап 9A; variantId 30D
 * Adds the product (with the optionally selected variant) to the cart and opens
 * the drawer. `variantId` is omitted for no-variant products and for the quick-add
 * on cards (the cart/server resolve the default variant). `disabled` is used when
 * a selected variant is out of stock — same look as the disabled "Купить".
 */

export default function AddToCartButton({
  slug,
  variantId,
  disabled = false,
}: {
  slug: string
  variantId?: string | null
  disabled?: boolean
}) {
  const { addItem, openCart } = useCart()

  return (
    <button
      className="au-btn au-btn--primary"
      type="button"
      disabled={disabled}
      onClick={() => {
        addItem(slug, variantId)
        openCart()
      }}
    >
      Додати
    </button>
  )
}
