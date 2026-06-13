'use client'

import Link from 'next/link'
import { useFavorites } from './FavoritesProvider'

/**
 * AURELIA — FavoritesButton (client) — Этап 11A
 * Header wishlist icon: links to /favorites and shows the real favorites count
 * as a badge (hidden when empty). Keeps the Header a server component.
 */

export default function FavoritesButton() {
  const { count } = useFavorites()

  return (
    <Link className="au-icon-btn" href="/favorites" aria-label="Избранное">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
      </svg>
      {count > 0 && <span className="badge">{count}</span>}
    </Link>
  )
}
