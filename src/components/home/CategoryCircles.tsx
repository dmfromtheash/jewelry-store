import type { ReactNode } from 'react'
import Link from 'next/link'

/**
 * AURELIA — CategoryCircles (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-cats)
 *
 * Row of category shortcuts. Categories with a real route link to their
 * page (via next/link); the rest stay on "#" until their pages exist.
 * Each circle keeps its distinctive prototype icon.
 */

interface Category {
  label: string
  href: string
  icon: ReactNode
}

const CATEGORIES: Category[] = [
  {
    label: 'Бижутерия',
    href: '/category/bijouterie',
    icon: (
      <>
        <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
        <path d="M3 9h18" />
      </>
    ),
  },
  {
    label: 'Серьги',
    href: '#',
    icon: (
      <>
        <circle cx="12" cy="14" r="6" />
        <path d="M9.5 5.5L12 8l2.5-2.5L12 3l-2.5 2.5z" />
      </>
    ),
  },
  {
    label: 'Кольца',
    href: '#',
    icon: (
      <>
        <circle cx="12" cy="14" r="7" />
        <path d="M9 5l3-3 3 3-3 3-3-3z" />
      </>
    ),
  },
  {
    label: 'Браслеты',
    href: '#',
    icon: (
      <>
        <ellipse cx="12" cy="12" rx="8.5" ry="6.5" />
        <ellipse cx="12" cy="12" rx="4.5" ry="3" />
      </>
    ),
  },
  {
    label: 'Цепочки',
    href: '#',
    icon: (
      <>
        <circle cx="8" cy="8" r="3.5" />
        <circle cx="13" cy="13" r="3.5" />
        <circle cx="18" cy="18" r="3.5" />
      </>
    ),
  },
  {
    label: 'Кулоны',
    href: '#',
    icon: (
      <>
        <path d="M12 8V3" />
        <path d="M8 11l4-3 4 3-1.5 8h-5L8 11z" />
      </>
    ),
  },
  {
    label: 'Наборы',
    href: '#',
    icon: (
      <>
        <rect x="3.5" y="7" width="17" height="13" rx="2" />
        <path d="M3.5 11h17M12 7v13M8.5 7C8.5 4.5 10 3 12 3s3.5 1.5 3.5 4" />
      </>
    ),
  },
  {
    label: 'Аксессуары',
    href: '#',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 6.5v5.5l3.5 2" />
      </>
    ),
  },
  {
    label: 'Подарки',
    href: '/category/gifts',
    icon: (
      <>
        <rect x="4" y="9" width="16" height="11" rx="1.5" />
        <path d="M4 13h16M12 9v11M12 9c-4 0-5-2-5-3.5C7 4 8 3 9.5 3c2 0 2.5 3 2.5 6zm0 0c4 0 5-2 5-3.5C17 4 16 3 14.5 3c-2 0-2.5 3-2.5 6z" />
      </>
    ),
  },
  {
    label: 'Бренды',
    href: '#',
    icon: <path d="M12 3l2.2 5.4L20 9l-4.4 3.8L17 19l-5-3.2L7 19l1.4-6.2L4 9l5.8-.6L12 3z" />,
  },
]

export default function CategoryCircles() {
  return (
    <div className="au-cats">
      {CATEGORIES.map((category) => {
        const inner = (
          <>
            <span className="disc">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
                {category.icon}
              </svg>
            </span>
            <span className="lbl">{category.label}</span>
          </>
        )
        return category.href === '#' ? (
          <a key={category.label} className="au-cat-circle" href="#">
            {inner}
          </a>
        ) : (
          <Link key={category.label} className="au-cat-circle" href={category.href}>
            {inner}
          </Link>
        )
      })}
    </div>
  )
}
