import type { ReactNode } from 'react'
import type { Product } from '../../lib/catalog'
import ProductBuyPanel from './ProductBuyPanel'

/**
 * AURELIA — ProductInfo (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Right-hand product info: brand, title, rating/sku meta, then the reactive buy
 * panel (price, availability status, variant selector, buy row), and service
 * perks. The price/status/variant/buy block lives in <ProductBuyPanel> (client,
 * Этап 30D) so variant selection is real WITHOUT any visual change.
 *
 * With a `product` it renders the panel; without one it keeps the generic
 * coming-soon fallback (used by /product/coming-soon) as a static block.
 */

const PERKS: { icon: ReactNode; text: string }[] = [
  {
    text: 'Доставка по всій країні — безкоштовно від 3 000 ₴',
    icon: (
      <>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </>
    ),
  },
  {
    text: 'Обмін і повернення протягом 30 днів',
    icon: (
      <>
        <path d="M4 9a8 8 0 0 1 15.3-2M20 15a8 8 0 0 1-15.3 2" />
        <path d="M19.5 3v4h-4M4.5 21v-4h4" />
      </>
    ),
  },
  {
    text: 'Фірмове подарункове пакування до кожного замовлення',
    icon: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1.5" />
        <path d="M4 13h16M12 9v11M12 9c-4 0-5-2-5-3.5C7 4 8 3 9.5 3c2 0 2.5 3 2.5 6zm0 0c4 0 5-2 5-3.5C17 4 16 3 14.5 3c-2 0-2.5 3-2.5 6z" />
      </>
    ),
  },
]

const DEFAULT_COATINGS = ['Позолота', 'Родіювання', 'Сталь']

export default function ProductInfo({ product }: { product?: Product }) {
  const brand = product?.brand ?? 'AURELIA'
  const title = product?.name ?? 'Незабаром буде додано прикрасу'
  const sku = product?.sku ?? 'AU-0000'
  const reviewsCount = product?.reviewsCount ?? 0

  return (
    <div>
      <p className="au-prod-brand">{brand}</p>
      <h1 className="au-prod-title">{title}</h1>

      <div className="au-prod-meta">
        <span className="au-stars" aria-hidden="true">★★★★★</span>
        <span>{reviewsCount} відгуків</span>
        <span>·</span>
        <span>Артикул: {sku}</span>
      </div>

      {product ? (
        // Reactive price + status + variant selector + buy row (Этап 30D).
        <ProductBuyPanel product={product} />
      ) : (
        // Generic coming-soon fallback (no product) — unchanged static block.
        <>
          <div className="au-prod-price-row">
            <span className="au-prod-price dim">— ₴</span>
          </div>
          <div className="au-prod-status">
            <span className="dot" />
            Зʼявиться в продажу найближчим часом
          </div>

          <div className="au-variants">
            <div className="lbl">Покриття</div>
            <div className="au-variant-row">
              {DEFAULT_COATINGS.map((coating, i) => (
                <button key={coating} className={`au-variant${i === 0 ? ' is-active' : ''}`} type="button">
                  {coating}
                </button>
              ))}
            </div>
          </div>

          <div className="au-buy-row">
            <button className="au-btn au-btn--primary" type="button" disabled>
              Додати
            </button>
            <button className="au-act-ico" type="button" aria-label="До обраного">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
              </svg>
            </button>
          </div>
          <button className="au-btn au-btn--ghost au-btn--block au-prod-notify" type="button">
            Повідомити про надходження
          </button>
        </>
      )}

      <div className="au-prod-perks">
        {PERKS.map((perk) => (
          <div className="au-prod-perk" key={perk.text}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              {perk.icon}
            </svg>
            {perk.text}
          </div>
        ))}
      </div>
    </div>
  )
}
