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

// Этап 84A: the public section name is fixed to exactly «Вопросы / Ответы», so the
// browser tab title is pinned at the route layer and intentionally does NOT use the
// CMS `metaTitle`. This keeps the title correct even when a local/legacy SitePage row
// still carries an older title (e.g. «Допомога — AURELIA») — no DB edit required. The
// description still comes from the CMS (with the static info-pages.ts fallback).
const HELP_TITLE = 'Вопросы / Ответы — AURELIA'

export async function generateMetadata(): Promise<Metadata> {
  const page = await getInfoPageForPublic(SLUG)
  return { title: HELP_TITLE, description: page?.metaDescription }
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
