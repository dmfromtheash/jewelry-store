/**
 * AURELIA — Favorites page (Этап 11A)
 *
 * Frontend-only wishlist page. The interactive part (reads the favorites store,
 * renders the grid / empty state) lives in FavoritesPageClient. No backend.
 */

import type { Metadata } from 'next'
import FavoritesPageClient from '../../src/components/favorites/FavoritesPageClient'

export const metadata: Metadata = {
  title: 'Избранное — AURELIA',
  description: 'Сохранённые украшения AURELIA.',
}

export default function FavoritesPage() {
  return <FavoritesPageClient />
}
