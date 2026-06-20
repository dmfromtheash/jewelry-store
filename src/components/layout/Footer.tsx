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

import Link from 'next/link'
import { getPublicSiteSettings } from '../../lib/site-settings/server'

// Links with a real route navigate via next/link; the rest stay on "#"
// (their pages do not exist yet — no fake routes).
const FOOTER_COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: 'Покупцям',
    links: [
      { label: 'Доставка та оплата', href: '/delivery' },
      { label: 'Повернення та обмін', href: '/returns' },
      { label: 'Допомога', href: '/help' },
    ],
  },
  {
    heading: 'Компанія',
    links: [
      { label: 'Про бренд', href: '/about' },
      { label: 'Магазини', href: '/stores' },
      { label: 'Контакти', href: '/contacts' },
    ],
  },
  {
    heading: 'Каталог',
    links: [
      { label: 'Біжутерія', href: '/category/bijouterie' },
      { label: 'Сережки', href: '#' },
      { label: 'Каблучки', href: '#' },
      { label: 'Подарунки', href: '/category/gifts' },
      { label: 'Бренди', href: '#' },
    ],
  },
]

export default async function Footer() {
  // Public site settings (Этап 46D): brand name / tagline / blurb / copyright are
  // read from the DB with a static-default fallback, so the footer looks identical
  // until the owner edits them in /admin/settings. Layout/classes are unchanged.
  const settings = await getPublicSiteSettings()

  return (
    <footer className="au-footer">
      {/* ---- Subscribe block ---- */}
      <div className="au-footer-sub">
        <div className="au-container au-footer-sub-in">
          <div>
            <p className="h">Будьте першими</p>
            <p className="p">
              Нові колекції, закриті розпродажі та ідеї подарунків — раз на тиждень
            </p>
          </div>
          <div className="au-sub-form">
            <input type="email" placeholder="Ваш e-mail" aria-label="E-mail для розсилки" />
            <button className="au-btn au-btn--primary" type="button">
              Підписатися
            </button>
          </div>
        </div>
      </div>

      {/* ---- Brand + link columns ---- */}
      <div className="au-container au-footer-cols">
        <div className="au-footer-brand">
          <div className="name">{settings.brandDisplayName}</div>
          <div className="tag">{settings.brandTagline}</div>
          <p className="p">{settings.footerBlurb}</p>
        </div>

        {FOOTER_COLUMNS.map((column) => (
          <div className="au-footer-col" key={column.heading}>
            <p className="h">{column.heading}</p>
            <ul>
              {column.links.map((link) =>
                link.href === '#' ? (
                  <li key={link.label}>
                    <a href="#">{link.label}</a>
                  </li>
                ) : (
                  <li key={link.label}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ),
              )}
            </ul>
          </div>
        ))}
      </div>

      {/* ---- Bottom bar ---- */}
      <div className="au-footer-bottom">
        <div className="au-container au-footer-bottom-in">
          <span>{settings.footerCopyright}</span>
          <div className="au-pay" aria-label="Способи оплати">
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
