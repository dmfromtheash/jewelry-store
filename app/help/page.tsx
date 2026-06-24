import '../../src/styles/content.css'
import type { Metadata } from 'next'
import HelpCenter from '../../src/components/help/HelpCenter'
import { searchHelp } from '../../src/lib/help/search'
import { getInfoPageForPublic } from '../../src/lib/site-pages/server'

// Этап 79A: the Help route is now a real Help Center — curated static categories/articles
// (src/lib/help/content.ts) with search (?q=) + category filter (?category=) + an
// "ask a question" form (DB-backed HelpQuestion). The page intro/SEO still come from the
// SitePage CMS (Этап 46E) with the static info-pages.ts fallback, so it can never hard-fail.
const SLUG = 'help'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getInfoPageForPublic(SLUG)
  return { title: page?.metaTitle, description: page?.metaDescription }
}

export default async function HelpPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>
}) {
  const [params, page] = await Promise.all([searchParams, getInfoPageForPublic(SLUG)])
  const result = searchHelp({ category: params.category ?? null, query: params.q ?? null })
  return <HelpCenter result={result} intro={page?.intro} />
}
