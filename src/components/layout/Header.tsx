import Link from 'next/link'
import ProfileButton from '../auth/ProfileButton'
import CartButton from '../cart/CartButton'
import FavoritesButton from '../favorites/FavoritesButton'

/**
 * AURELIA — Header (server component)
 * Source: docs/design/aurelia-prototype/01 Components.html + 02 Home Page.html
 * Transferred 1:1: top service bar, main header (search / logo / icons),
 * category nav. Pure markup + CSS — no client JS needed yet.
 *
 * Placeholder links point to "#" because their routes do not exist yet
 * (categories, service pages are built in later stages). Only the logo
 * links to the real home route "/".
 */

const TOPBAR_LINKS = [
  { label: 'Доставка и оплата', href: '#' },
  { label: 'Возврат', href: '#' },
  { label: 'Магазины', href: '#' },
  { label: 'Помощь', href: '#' },
]

// Only categories with a real route link to a page; the rest stay on "#"
// until their pages exist (no fake routes).
const NAV_CATEGORIES: { label: string; href: string }[] = [
  { label: 'Бижутерия', href: '/category/bijouterie' },
  { label: 'Серьги', href: '#' },
  { label: 'Кольца', href: '#' },
  { label: 'Браслеты', href: '#' },
  { label: 'Цепочки', href: '#' },
  { label: 'Кулоны', href: '#' },
  { label: 'Наборы', href: '#' },
  { label: 'Аксессуары', href: '#' },
  { label: 'Подарки', href: '/category/gifts' },
  { label: 'Бренды', href: '#' },
]

export default function Header() {
  return (
    <>
      {/* ---- Top service bar ---- */}
      <div className="au-topbar">
        <div className="au-container au-topbar-in">
          <nav className="au-topbar-links" aria-label="Сервис">
            {TOPBAR_LINKS.map((link) => (
              <a key={link.label} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
          <div className="au-topbar-right">
            <span className="phone">8 800 600-20-26</span>
            <a href="#">RU</a>
          </div>
        </div>
      </div>

      {/* ---- Main header: search / logo / icons ---- */}
      <header className="au-header">
        <div className="au-container au-header-in">
          <div className="au-search">
            <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="9" cy="9" r="6.5" />
              <path d="M14 14l4.5 4.5" />
            </svg>
            <input type="search" placeholder="Поиск украшений" aria-label="Поиск украшений" />
          </div>

          <Link className="au-logo" href="/">
            <span className="name">AURELIA</span>
            <span className="tagline">Bijouterie without limits</span>
          </Link>

          <div className="au-header-icons">
            <ProfileButton />
            <FavoritesButton />
            <CartButton />
          </div>
        </div>
      </header>

      {/* ---- Category nav ---- */}
      <nav className="au-nav" aria-label="Категории">
        <div className="au-container au-nav-in">
          {NAV_CATEGORIES.map((category) =>
            category.href === '#' ? (
              <a key={category.label} href="#">
                {category.label}
              </a>
            ) : (
              <Link key={category.label} href={category.href}>
                {category.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </>
  )
}
