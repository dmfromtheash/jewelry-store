'use client'

/**
 * AURELIA — Admin sidebar navigation (Этап 20A)
 *
 * Primary navigation for the authenticated admin shell. This is the only client
 * component in the admin shell — it exists solely to highlight the active
 * section via usePathname(). It renders static internal links to the planned
 * admin sections (the target information architecture from the roadmap); auth
 * is enforced server-side in the layout/pages, never here.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface AdminNavItem {
  href: string
  label: string
}

// Order mirrors the target admin IA in docs/backend/ADMIN_SUPERPANEL_ROADMAP.md.
const NAV_ITEMS: readonly AdminNavItem[] = [
  { href: '/admin/dashboard', label: 'Дашборд' },
  { href: '/admin/orders', label: 'Заказы' },
  { href: '/admin/catalog', label: 'Каталог' },
  { href: '/admin/inventory', label: 'Склад' },
  { href: '/admin/reviews', label: 'Отзывы' },
  { href: '/admin/customers', label: 'Покупатели' },
  { href: '/admin/promotions', label: 'Промокоды' },
  { href: '/admin/email-outbox', label: 'Письма' },
  { href: '/admin/analytics', label: 'Аналитика' },
  { href: '/admin/site-health', label: 'Состояние сайта' },
  { href: '/admin/security', label: 'Безопасность' },
  { href: '/admin/audit-log', label: 'Журнал аудита' },
  { href: '/admin/settings', label: 'Настройки' },
  { href: '/admin/content', label: 'Контент' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="au-adm-nav" aria-label="Навигация админки">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`au-adm-nav-link${active ? ' is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
