import Link from 'next/link'
import ProfileButton from '../auth/ProfileButton'
import CartButton from '../cart/CartButton'
import FavoritesButton from '../favorites/FavoritesButton'
import HeaderSearch from '../search/HeaderSearch'
import InfoHint from '../ui/InfoHint'
import StickyQuickActions from './StickyQuickActions'
import { getAdminSession } from '../../lib/admin/auth'
import { getCurrentCustomer } from '../../lib/customer/session'
import { getPublicSiteSettings } from '../../lib/site-settings/server'

/** Fallback shown when no public phone is configured — keeps the topbar identical
 *  to the locked design until the owner sets contact.phone in /admin/settings. */
const TOPBAR_PHONE_FALLBACK = '0 800 000 00 00'

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

// The "Вопросы / Ответы" entry (route stays /help) is the place for questions,
// answers and buyer support — surfaced with a clear public name + a small hint.
const TOPBAR_LINKS = [
  { label: 'Доставка та оплата', href: '/delivery' },
  { label: 'Повернення', href: '/returns' },
  { label: 'Магазини', href: '/stores' },
]

// Only categories with a real route link to a page; the rest stay on "#"
// until their pages exist (no fake routes).
const NAV_CATEGORIES: { label: string; href: string }[] = [
  { label: 'Біжутерія', href: '/category/bijouterie' },
  { label: 'Сережки', href: '#' },
  { label: 'Каблучки', href: '#' },
  { label: 'Браслети', href: '#' },
  { label: 'Ланцюжки', href: '#' },
  { label: 'Кулони', href: '#' },
  { label: 'Набори', href: '#' },
  { label: 'Аксесуари', href: '#' },
  { label: 'Подарунки', href: '/category/gifts' },
  { label: 'Бренди', href: '#' },
]

export default async function Header() {
  // Admin-session-aware entry: when a valid admin session exists we surface a
  // small "Админка" link so the owner can return to the panel from the
  // storefront. This is independent of the customer profile icon (ProfileButton),
  // which opens the customer auth modal and is unrelated to the admin session.
  // Null (and rendered nothing) for everyone without a valid admin session.
  const adminSession = await getAdminSession()

  // Customer-session-aware profile icon (Этап 47A): when a valid customer session
  // exists, the profile button links to /account; otherwise it opens the login
  // modal (unchanged). Only a safe display label (name or email) is passed to the
  // client — never the session token or other account data. Independent of the
  // admin session above.
  const customer = await getCurrentCustomer()
  const accountName = customer ? customer.name || customer.email : null

  // Public site settings (Этап 46D): brand name / tagline / public phone read from
  // the DB with static-default fallback. Empty phone keeps the current placeholder,
  // so the topbar/logo look identical until edited in /admin/settings.
  const settings = await getPublicSiteSettings()
  const topbarPhone = settings.contactPhone || TOPBAR_PHONE_FALLBACK

  return (
    <>
      {/* ---- Top service bar ---- */}
      <div className="au-topbar">
        <div className="au-container au-topbar-in">
          <nav className="au-topbar-links" aria-label="Сервіс">
            {TOPBAR_LINKS.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
            <span className="au-help-cta">
              <Link href="/help">Вопросы / Ответы</Link>
              <InfoHint
                text="Питання, відповіді та підказки покупцю."
                label="Про розділ «Вопросы / Ответы»"
                place="bottom"
              />
            </span>
          </nav>
          <div className="au-topbar-right">
            {adminSession && <Link href="/admin/dashboard">Админка</Link>}
            <span className="phone">{topbarPhone}</span>
            <a href="#">UA</a>
          </div>
        </div>
      </div>

      {/* ---- Main header: search / logo / icons ---- */}
      <header className="au-header">
        <div className="au-container au-header-in">
          <HeaderSearch />

          <Link className="au-logo" href="/">
            <span className="name">{settings.brandDisplayName}</span>
            <span className="tagline">{settings.brandTagline}</span>
          </Link>

          <div className="au-header-icons">
            <ProfileButton accountName={accountName} />
            <FavoritesButton />
            <CartButton />
          </div>
        </div>
      </header>

      {/* ---- Category nav (sticky) ---- */}
      <nav className="au-nav" aria-label="Категорії">
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
        {/* Этап 77A: quick actions surfaced only while this nav is pinned at the
            top (scrolled/sticky state). Overlaid on the right of the category
            nav — invisible & non-interactive at the top of the page, so the
            normal header design stays unchanged. */}
        <StickyQuickActions accountName={accountName} />
      </nav>
    </>
  )
}
