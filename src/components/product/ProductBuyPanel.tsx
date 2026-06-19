'use client'

import { useState } from 'react'
import { formatPrice } from '../../lib/catalog'
import type { Product } from '../../lib/catalog'
import { pickDefaultVariantRef, isVariantInStock } from '../../lib/cart/lines'
import AddToCartButton from '../cart/AddToCartButton'
import ProductFavoriteButton from './ProductFavoriteButton'

/**
 * AURELIA — ProductBuyPanel (client) — Этап 30D
 *
 * The reactive part of the product page: price + status + variant selector + buy
 * row. Extracted from ProductInfo (server) so the variant selection is REAL
 * without changing the visual design — it reuses the exact same .au-prod-price /
 * .au-prod-status / .au-variants / .au-variant / .au-buy-row markup.
 *
 *  - Product WITH variants: the selector is interactive (default pre-selected),
 *    the price reflects the selected variant's priceDelta, and Add-to-cart carries
 *    the chosen variantId (disabled when that variant is out of stock).
 *  - Product WITHOUT variants: the decorative coating row is kept exactly as
 *    before (non-interactive) and Add-to-cart works exactly as before (no
 *    variantId). The server stays authoritative on price/stock.
 */

const DEFAULT_COATINGS = ['Позолота', 'Родіювання', 'Сталь']

export default function ProductBuyPanel({ product }: { product: Product }) {
  const variants = product.variants ?? []
  const hasVariants = variants.length > 0
  const isAvailable = product.status === 'available'
  const hasPrice = typeof product.price === 'number'

  const [selectedId, setSelectedId] = useState<string | undefined>(
    () => pickDefaultVariantRef(variants)?.id,
  )
  const selectedVariant = hasVariants
    ? variants.find((v) => v.id === selectedId) ?? null
    : null

  // Price reflects the selected variant's delta (whole UAH, both sides).
  const displayPrice = hasPrice
    ? (product.price as number) + (selectedVariant?.priceDelta ?? 0)
    : null

  // Disable add only for a selected, stock-tracked, out-of-stock variant — a
  // product without variants keeps its exact pre-30D behaviour.
  const addDisabled = hasVariants ? !(selectedVariant && isVariantInStock(selectedVariant)) : false

  // Decorative coatings for products WITHOUT real variants (unchanged visuals).
  const decorativeCoatings = product.coatings ?? DEFAULT_COATINGS

  return (
    <>
      <div className="au-prod-price-row">
        {displayPrice != null ? (
          <span className="au-prod-price">{formatPrice(displayPrice)}</span>
        ) : (
          <span className="au-prod-price dim">— ₴</span>
        )}
      </div>
      <div className="au-prod-status">
        <span className="dot" />
        {isAvailable ? 'В наявності' : 'Зʼявиться в продажу найближчим часом'}
      </div>

      <div className="au-variants">
        <div className="lbl">Покриття</div>
        <div className="au-variant-row">
          {hasVariants
            ? variants.map((v) => (
                <button
                  key={v.id}
                  className={`au-variant${v.id === selectedId ? ' is-active' : ''}`}
                  type="button"
                  aria-pressed={v.id === selectedId}
                  onClick={() => setSelectedId(v.id)}
                >
                  {v.value}
                </button>
              ))
            : decorativeCoatings.map((coating, i) => (
                <button
                  key={coating}
                  className={`au-variant${i === 0 ? ' is-active' : ''}`}
                  type="button"
                >
                  {coating}
                </button>
              ))}
        </div>
      </div>

      <div className="au-buy-row">
        {isAvailable ? (
          <AddToCartButton
            slug={product.slug}
            variantId={selectedVariant?.id}
            disabled={addDisabled}
          />
        ) : (
          <button className="au-btn au-btn--primary" type="button" disabled>
            Додати
          </button>
        )}
        <ProductFavoriteButton slug={product.slug} />
      </div>

      {!isAvailable && (
        <button className="au-btn au-btn--ghost au-btn--block au-prod-notify" type="button">
          Сообщить о поступлении
        </button>
      )}
    </>
  )
}
