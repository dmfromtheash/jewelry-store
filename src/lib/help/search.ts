/**
 * AURELIA — Help Center search/filter (Этап 79A)
 *
 * Pure, dependency-free filtering over the curated static Help content. LOCAL word-prefix
 * matching only — NO external search engine, NO AI/semantic search. The article volume is
 * tiny, so an in-memory scan keeps the Help page statically renderable. Markup-safe: the
 * query is normalised to plain word characters before matching.
 */

import type { HelpArticle, HelpCategory } from './types'
import { HELP_ARTICLES, HELP_CATEGORIES } from './content'

/** Strips markup-ish characters, lowercases, and splits into word tokens. */
export function normalizeQuery(raw: string): string[] {
  return (raw ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .slice(0, 8)
}

function articleHaystack(a: HelpArticle): string {
  return `${a.title} ${a.body} ${a.keywords ?? ''}`.toLowerCase()
}

export interface HelpFilter {
  /** Category slug filter (null/invalid = all categories). */
  category?: string | null
  /** Free-text query (empty = no text filter). */
  query?: string | null
}

export interface HelpSearchResult {
  /** All categories (for the filter chips), sorted. */
  categories: HelpCategory[]
  /** The active category slug if one matched, else null. */
  activeCategory: string | null
  /** The normalised query string echoed back for the UI (trimmed). */
  query: string
  /** Matching articles, sorted by category sortOrder then article sortOrder. */
  articles: HelpArticle[]
}

const sortedCategories = () => [...HELP_CATEGORIES].sort((a, b) => a.sortOrder - b.sortOrder)

/**
 * Filters the curated articles by an optional category + an optional word-prefix query.
 * Every query token must prefix-match SOME word in the article haystack (AND semantics),
 * so "розмір каб" matches an article mentioning "розмір" and "каблучка".
 */
export function searchHelp(filter: HelpFilter = {}): HelpSearchResult {
  const categories = sortedCategories()
  const categoryOrder = new Map(categories.map((c) => [c.slug, c.sortOrder]))

  const activeCategory =
    filter.category && categoryOrder.has(filter.category) ? filter.category : null

  const tokens = normalizeQuery(filter.query ?? '')
  const rawQuery = (filter.query ?? '').trim()

  let articles = HELP_ARTICLES.filter((a) => {
    if (activeCategory && a.categorySlug !== activeCategory) return false
    if (tokens.length === 0) return true
    const hay = articleHaystack(a)
    const words = hay.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
    // Every token must prefix-match at least one word (AND across tokens).
    return tokens.every((tok) => words.some((w) => w.startsWith(tok)))
  })

  articles = articles.sort((a, b) => {
    const ca = categoryOrder.get(a.categorySlug) ?? 0
    const cb = categoryOrder.get(b.categorySlug) ?? 0
    if (ca !== cb) return ca - cb
    return a.sortOrder - b.sortOrder
  })

  return { categories, activeCategory, query: rawQuery, articles }
}
