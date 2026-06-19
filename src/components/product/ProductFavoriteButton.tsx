'use client'

import { useFavorites } from '../favorites/FavoritesProvider'

/**
 * AURELIA — ProductFavoriteButton (client) — Этап 11A
 * Favorite toggle for the product page buy row. Works for any product
 * (available or coming-soon). Shows an active (filled) state when favorited.
 */

export default function ProductFavoriteButton({ slug }: { slug: string }) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const favorited = isFavorite(slug)

  return (
    <button
      className={`au-act-ico au-fav-toggle${favorited ? ' is-active' : ''}`}
      type="button"
      aria-pressed={favorited}
      aria-label={favorited ? 'Прибрати з обраного' : 'До обраного'}
      onClick={() => toggleFavorite(slug)}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill={favorited ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.5"
        aria-hidden="true"
      >
        <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
      </svg>
    </button>
  )
}
