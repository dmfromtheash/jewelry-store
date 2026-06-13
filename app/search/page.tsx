/**
 * AURELIA — Search page (Этап 12A)
 *
 * Frontend-only search results. Reads q / sort / status from the URL inside
 * SearchPageClient (wrapped in Suspense because it uses useSearchParams).
 * No backend, API or DB.
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'
import SearchPageClient from '../../src/components/search/SearchPageClient'

export const metadata: Metadata = {
  title: 'Поиск — AURELIA',
  description: 'Поиск украшений в каталоге AURELIA.',
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="au-container au-search-page" />}>
      <SearchPageClient />
    </Suspense>
  )
}
