/**
 * AURELIA — Footer (server component)
 * Source: docs/design/aurelia-prototype/01 Components.html + 02 Home Page.html
 * Transferred 1:1: subscribe block, brand, link columns, bottom bar.
 *
 * The subscribe "form" is a non-functional placeholder (no real send).
 * It is a <div> (not <form>) with a type="button" button on purpose — this
 * keeps the component server-side (no "use client") and avoids any accidental
 * page reload on Enter. A real handler is wired up in a later stage.
 */

const FOOTER_COLUMNS = [
  {
    heading: 'Покупателям',
    links: ['Доставка и оплата', 'Возврат и обмен', 'Бонусная программа'],
  },
  {
    heading: 'Компания',
    links: ['О бренде', 'Магазины', 'Контакты'],
  },
  {
    heading: 'Каталог',
    links: ['Бижутерия', 'Серьги', 'Кольца', 'Подарки', 'Бренды'],
  },
]

export default function Footer() {
  return (
    <footer className="au-footer">
      {/* ---- Subscribe block ---- */}
      <div className="au-footer-sub">
        <div className="au-container au-footer-sub-in">
          <div>
            <p className="h">Будьте первыми</p>
            <p className="p">
              Новые коллекции, закрытые распродажи и идеи подарков — раз в неделю
            </p>
          </div>
          <div className="au-sub-form">
            <input type="email" placeholder="Ваш e-mail" aria-label="E-mail для рассылки" />
            <button className="au-btn au-btn--primary" type="button">
              Подписаться
            </button>
          </div>
        </div>
      </div>

      {/* ---- Brand + link columns ---- */}
      <div className="au-container au-footer-cols">
        <div className="au-footer-brand">
          <div className="name">AURELIA</div>
          <div className="tag">Bijouterie without limits</div>
          <p className="p">
            Современная бижутерия и аксессуары. Дизайн-прототип интернет-магазина.
          </p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div className="au-footer-col" key={column.heading}>
            <p className="h">{column.heading}</p>
            <ul>
              {column.links.map((link) => (
                <li key={link}>
                  <a href="#">{link}</a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* ---- Bottom bar ---- */}
      <div className="au-footer-bottom">
        <div className="au-container au-footer-bottom-in">
          <span>© 2026 AURELIA. Дизайн-прототип.</span>
          <div className="au-pay" aria-label="Способы оплаты">
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>
    </footer>
  )
}
