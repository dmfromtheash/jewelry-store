/**
 * AURELIA — Favorites page (Этап 11A; server persistence Этап 62A)
 *
 * The interactive part (reads the favorites store, renders the grid / empty state)
 * lives in FavoritesPageClient. Guests are localStorage-only; a logged-in customer's
 * favourites are additionally persisted server-side via FavoritesProvider.
 */

import type { Metadata } from 'next'
import FavoritesPageClient from '../../src/components/favorites/FavoritesPageClient'

// Personalised page — not indexable (Этап 72A; also disallowed in robots.txt).
export const metadata: Metadata = {
  title: 'Обране — AURELIA',
  description: 'Збережені прикраси AURELIA.',
  robots: { index: false, follow: true },
}

export default function FavoritesPage() {
  return <FavoritesPageClient />
}
