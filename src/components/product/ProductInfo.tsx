import type { ReactNode } from 'react'

/**
 * AURELIA — ProductInfo (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Right-hand product info: brand, title, rating/sku meta, placeholder price,
 * availability status, coating variants, buy row (disabled "Купить" + favorite),
 * "Сообщить о поступлении", and service perks.
 *
 * Everything is visual only — variant buttons and the favorite button have no
 * client state, "Купить" is disabled (no product on sale yet). No backend.
 */

const PERKS: { icon: ReactNode; text: string }[] = [
  {
    text: 'Доставка по всей стране — бесплатно от 3 000 ₽',
    icon: (
      <>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </>
    ),
  },
  {
    text: 'Обмен и возврат в течение 30 дней',
    icon: (
      <>
        <path d="M4 9a8 8 0 0 1 15.3-2M20 15a8 8 0 0 1-15.3 2" />
        <path d="M19.5 3v4h-4M4.5 21v-4h4" />
      </>
    ),
  },
  {
    text: 'Фирменная подарочная упаковка к каждому заказу',
    icon: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1.5" />
        <path d="M4 13h16M12 9v11M12 9c-4 0-5-2-5-3.5C7 4 8 3 9.5 3c2 0 2.5 3 2.5 6zm0 0c4 0 5-2 5-3.5C17 4 16 3 14.5 3c-2 0-2.5 3-2.5 6z" />
      </>
    ),
  },
]

const COATINGS = ['Позолота', 'Родирование', 'Сталь']

export default function ProductInfo() {
  return (
    <div>
      <p className="au-prod-brand">AURELIA</p>
      <h1 className="au-prod-title">Скоро будет добавлено украшение</h1>

      <div className="au-prod-meta">
        <span className="au-stars" aria-hidden="true">★★★★★</span>
        <span>0 отзывов</span>
        <span>·</span>
        <span>Артикул: AU-0000</span>
      </div>

      <div className="au-prod-price-row">
        <span className="au-prod-price dim">— ₽</span>
      </div>
      <div className="au-prod-status">
        <span className="dot" />
        Появится в продаже в ближайшее время
      </div>

      <div className="au-variants">
        <div className="lbl">Покрытие</div>
        <div className="au-variant-row">
          {COATINGS.map((coating, i) => (
            <button key={coating} className={`au-variant${i === 0 ? ' is-active' : ''}`} type="button">
              {coating}
            </button>
          ))}
        </div>
      </div>

      <div className="au-buy-row">
        <button className="au-btn au-btn--primary" type="button" disabled>
          Купить
        </button>
        <button className="au-act-ico" type="button" aria-label="В избранное">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
          </svg>
        </button>
      </div>
      <button className="au-btn au-btn--ghost au-btn--block au-prod-notify" type="button">
        Сообщить о поступлении
      </button>

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
