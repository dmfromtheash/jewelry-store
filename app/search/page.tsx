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

// Search results carry arbitrary `?q=&sort=&status=` combinations. To avoid indexing an infinite
// set of near-duplicate URLs (Этап 72A) the page is `noindex, follow` and canonicalises to the
// bare /search entry point. Robots still allows crawling so links are followed.
export const metadata: Metadata = {
  title: 'Пошук — AURELIA',
  description: 'Пошук прикрас у каталозі AURELIA.',
  alternates: { canonical: '/search' },
  robots: { index: false, follow: true },
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="au-container au-search-page" />}>
      <SearchPageClient />
    </Suspense>
  )
}
