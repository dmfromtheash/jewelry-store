/**
 * AURELIA — Catalog search / sort / filter (Этап 12A)
 *
 * Pure frontend-only helpers over the static mock catalog. No backend, API or
 * DB — just in-memory string matching and array ordering. Product data is read
 * from src/data/products.ts and never duplicated.
 */

import { products } from '../../data/products'
import { hasUnsafeMarkup } from '../customer/validate'
import type { Product } from './types'

export type SortKey =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'new'
  | 'available-first'
  | 'rating-desc'
  | 'reviews-desc'
export type StatusFilter = 'all' | 'available' | 'coming-soon'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Рекомендовані' },
  { value: 'new', label: 'Спочатку новинки' },
  { value: 'price-asc', label: 'Спочатку дешевші' },
  { value: 'price-desc', label: 'Спочатку дорожчі' },
  { value: 'available-first', label: 'Спочатку в наявності' },
  { value: 'rating-desc', label: 'За рейтингом' },
  { value: 'reviews-desc', label: 'За кількістю відгуків' },
]

/** Max accepted price (UAH) for a query param — anything larger is treated as "no bound"
 *  (a defensive clamp against absurd/overflow values). */
export const PRICE_PARAM_MAX = 100_000_000
/** Max accepted length of a raw search query before it is ignored. */
export const SEARCH_QUERY_MAX = 100

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'available', label: 'В наявності' },
  { value: 'coming-soon', label: 'Незабаром' },
]

/** lowercase + trim; toLowerCase handles Cyrillic correctly. */
export function normalizeQuery(input: string): string {
  return input.toLowerCase().trim()
}

/**
 * Normalises a raw search query (Этап 64A): trims, caps length, and rejects unsafe markup.
 * Returns '' (→ "no results") for an empty/over-long/markup query, so the search box can
 * never throw on strange input or be used to smuggle HTML. Weird Unicode is fine — the
 * tokenizer below is Unicode-aware and simply ignores non-letter/digit runs.
 */
export function normalizeSearchQuery(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return ''
  const q = raw.trim()
  if (!q || q.length > SEARCH_QUERY_MAX) return ''
  if (hasUnsafeMarkup(q)) return ''
  return q
}

/**
 * Parses a single price query param to a non-negative integer UAH, or `undefined` when it is
 * absent / blank / not a finite non-negative number / above PRICE_PARAM_MAX. Never throws.
 */
export function parsePrice(raw: string | null | undefined): number | undefined {
  if (raw == null) return undefined
  const s = String(raw).trim()
  if (!s || !/^\d+$/.test(s)) return undefined
  const n = Number(s)
  if (!Number.isFinite(n) || n < 0 || n > PRICE_PARAM_MAX) return undefined
  return n
}

/**
 * Parses min/max price params into a safe range (Этап 64A). Invalid values are dropped; when
 * BOTH are valid but min > max the pair is SWAPPED (deterministic, user-friendly) rather than
 * yielding an empty result. Returns {} when neither bound is valid.
 */
export function parsePriceRange(
  rawMin: string | null | undefined,
  rawMax: string | null | undefined,
): PriceRange {
  let min = parsePrice(rawMin)
  let max = parsePrice(rawMax)
  if (min !== undefined && max !== undefined && min > max) {
    const t = min
    min = max
    max = t
  }
  const range: PriceRange = {}
  if (min !== undefined) range.min = min
  if (max !== undefined) range.max = max
  return range
}

/** Validate a raw query-string sort value, falling back to the default. */
export function parseSort(raw: string | null | undefined): SortKey {
  return SORT_OPTIONS.some((o) => o.value === raw) ? (raw as SortKey) : 'recommended'
}

/** Validate a raw query-string status value, falling back to "all". */
export function parseStatus(raw: string | null | undefined): StatusFilter {
  return STATUS_OPTIONS.some((o) => o.value === raw) ? (raw as StatusFilter) : 'all'
}

/**
 * Split text into lowercased word tokens (letters/digits only), Unicode-aware
 * so Cyrillic words tokenize correctly. Punctuation, spaces, «» etc. are
 * separators, so "Серьги · эмаль" → ["серьги", "эмаль"].
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

function searchableTokens(product: Product): string[] {
  return tokenize(
    [
      product.name,
      product.category,
      product.description ?? '',
      product.sku ?? '',
      product.tag ?? '',
      // Material / coating values (Этап 64A) so a search like "позолота" finds it.
      ...(product.coatings ?? []),
      ...(product.specs?.flatMap((s) => [s.label, s.value]) ?? []),
    ].join(' '),
  )
}

/**
 * Word-prefix search across name / category / description / sku / tag / specs.
 * Every query token must be a prefix of at least one word in the product's
 * searchable text (AND). Matching on word prefixes — not arbitrary substrings —
 * keeps results relevant: e.g. "ю" does NOT match "эмалью", while "коль" still
 * matches "кольцо". Empty / whitespace-only query → no results (never the whole
 * catalog).
 */
export function searchProducts(query: string, source: Product[] = products): Product[] {
  const queryTokens = tokenize(query)
  if (queryTokens.length === 0) return []
  return source.filter((product) => {
    const tokens = searchableTokens(product)
    return queryTokens.every((qt) => tokens.some((token) => token.startsWith(qt)))
  })
}

export function filterByStatus(list: Product[], status: StatusFilter): Product[] {
  if (status === 'all') return list
  return list.filter((product) => product.status === status)
}

export interface PriceRange {
  min?: number
  max?: number
}

export function filterByPrice(list: Product[], range: PriceRange): Product[] {
  if (range.min === undefined && range.max === undefined) return list
  return list.filter((product) => {
    if (typeof product.price !== 'number') return false
    if (range.min !== undefined && product.price < range.min) return false
    if (range.max !== undefined && product.price > range.max) return false
    return true
  })
}

export function filterByTag(list: Product[], tag: string): Product[] {
  const t = normalizeQuery(tag)
  if (!t) return list
  return list.filter((product) => (product.tag ?? '').toLowerCase() === t)
}

// --- Material / coating facet (Этап 64A) -----------------------------------
// The honest "material" facet is the product's COATING values (real coating-variant
// data: Позолота / Родіювання / Сталь). Facet values are DERIVED from the products
// actually shown — never invented — so a value only appears when a product has it.

/** Distinct material/coating values across a product list, sorted (UA locale). */
export function deriveMaterials(list: Product[]): string[] {
  const set = new Set<string>()
  for (const p of list) for (const c of p.coatings ?? []) if (c) set.add(c)
  return [...set].sort((a, b) => a.localeCompare(b, 'uk'))
}

/**
 * Validates a raw `material` query param against the values that actually exist in `list`
 * (case-insensitive). Returns the canonical value, or `undefined` when absent/unknown — so a
 * bogus material simply falls back to "no material filter" rather than an empty page.
 */
export function parseMaterial(raw: string | null | undefined, list: Product[]): string | undefined {
  if (raw == null) return undefined
  const want = String(raw).trim().toLowerCase()
  if (!want) return undefined
  return deriveMaterials(list).find((m) => m.toLowerCase() === want)
}

/** Keeps products whose coatings include the given material (exact, case-insensitive).
 *  An empty/undefined material returns the list unchanged. */
export function filterByMaterial(list: Product[], material: string | null | undefined): Product[] {
  if (!material) return list
  const want = material.toLowerCase()
  return list.filter((p) => (p.coatings ?? []).some((c) => c.toLowerCase() === want))
}

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const arr = [...list]
  switch (sort) {
    case 'price-asc':
      return arr.sort(
        (a, b) =>
          (typeof a.price === 'number' ? a.price : Number.POSITIVE_INFINITY) -
          (typeof b.price === 'number' ? b.price : Number.POSITIVE_INFINITY),
      )
    case 'price-desc':
      return arr.sort(
        (a, b) =>
          (typeof b.price === 'number' ? b.price : Number.NEGATIVE_INFINITY) -
          (typeof a.price === 'number' ? a.price : Number.NEGATIVE_INFINITY),
      )
    case 'new':
      // Honest "newest first" (Этап 62A): order by real createdAt when present.
      // Products without a timestamp (legacy fixtures) keep the prior tag-based
      // heuristic so the sort still degrades gracefully and is never empty.
      if (arr.some((p) => typeof p.createdAt === 'string')) {
        return arr.sort((a, b) => {
          const ta = a.createdAt ? Date.parse(a.createdAt) : 0
          const tb = b.createdAt ? Date.parse(b.createdAt) : 0
          return tb - ta
        })
      }
      return arr.sort((a, b) => (a.tag === 'New' ? 0 : 1) - (b.tag === 'New' ? 0 : 1))
    case 'available-first':
      return arr.sort(
        (a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1),
      )
    case 'rating-desc':
      // Honest rating sort (Этап 64A): APPROVED-review average desc, then approved count,
      // then newest, then name. Products with no approved reviews (rating 0) sort LAST —
      // never given a fake rating. Deterministic ties via createdAt → name.
      return arr.sort(
        (a, b) =>
          ratingOf(b) - ratingOf(a) ||
          reviewsOf(b) - reviewsOf(a) ||
          createdMs(b) - createdMs(a) ||
          a.name.localeCompare(b.name, 'uk'),
      )
    case 'reviews-desc':
      // By APPROVED review count desc, then average, then newest, then name.
      return arr.sort(
        (a, b) =>
          reviewsOf(b) - reviewsOf(a) ||
          ratingOf(b) - ratingOf(a) ||
          createdMs(b) - createdMs(a) ||
          a.name.localeCompare(b.name, 'uk'),
      )
    default:
      return arr
  }
}

/** Approved-review average (0 when none — honest, sorts last). */
function ratingOf(p: Product): number {
  return typeof p.approvedRating === 'number' ? p.approvedRating : 0
}
/** Approved-review count (0 when none). */
function reviewsOf(p: Product): number {
  return typeof p.approvedReviewCount === 'number' ? p.approvedReviewCount : 0
}
/** createdAt epoch ms (0 when absent) — deterministic tie-break. */
function createdMs(p: Product): number {
  return p.createdAt ? Date.parse(p.createdAt) || 0 : 0
}
