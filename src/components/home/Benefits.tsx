import type { ReactNode } from 'react'

/**
 * AURELIA — Benefits strip (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-benefits)
 * Four service highlights: доставка, обмен/возврат, упаковка, поддержка.
 */

interface Benefit {
  icon: ReactNode
  heading: string
  text: string
}

const BENEFITS: Benefit[] = [
  {
    heading: 'Доставка по всей стране',
    text: 'Бесплатно от 3 000 ₴, отправка в день заказа',
    icon: (
      <>
        <path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" />
        <circle cx="7" cy="17.5" r="1.8" />
        <circle cx="17" cy="17.5" r="1.8" />
      </>
    ),
  },
  {
    heading: 'Обмен и возврат 30 дней',
    text: 'Без лишних вопросов, в любом магазине сети',
    icon: (
      <>
        <path d="M4 9a8 8 0 0 1 15.3-2M20 15a8 8 0 0 1-15.3 2" />
        <path d="M19.5 3v4h-4M4.5 21v-4h4" />
      </>
    ),
  },
  {
    heading: 'Подарочная упаковка',
    text: 'Фирменная коробка и открытка к каждому заказу',
    icon: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1.5" />
        <path d="M4 13h16M12 9v11M12 9c-4 0-5-2-5-3.5C7 4 8 3 9.5 3c2 0 2.5 3 2.5 6zm0 0c4 0 5-2 5-3.5C17 4 16 3 14.5 3c-2 0-2.5 3-2.5 6z" />
      </>
    ),
  },
  {
    heading: 'Поддержка каждый день',
    text: 'Поможем с выбором, размером и оформлением заказа',
    icon: (
      <>
        <path d="M5 12a7 7 0 0 1 14 0" />
        <rect x="3.5" y="12" width="3.5" height="6" rx="1.5" />
        <rect x="17" y="12" width="3.5" height="6" rx="1.5" />
        <path d="M19 18a4 4 0 0 1-4 3.2h-2" />
      </>
    ),
  },
]

export default function Benefits() {
  return (
    <section className="au-container au-benefits">
      {BENEFITS.map((benefit) => (
        <div className="au-benefit" key={benefit.heading}>
          <span className="ico">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              {benefit.icon}
            </svg>
          </span>
          <div>
            <p className="h">{benefit.heading}</p>
            <p className="p">{benefit.text}</p>
          </div>
        </div>
      ))}
    </section>
  )
}
