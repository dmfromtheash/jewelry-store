/**
 * AURELIA — Catalog search / sort / filter (Этап 12A)
 *
 * Pure frontend-only helpers over the static mock catalog. No backend, API or
 * DB — just in-memory string matching and array ordering. Product data is read
 * from src/data/products.ts and never duplicated.
 */

import { products } from '../../data/products'
import type { Product } from './types'

export type SortKey = 'recommended' | 'price-asc' | 'price-desc' | 'new' | 'available-first'
export type StatusFilter = 'all' | 'available' | 'coming-soon'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'recommended', label: 'Рекомендовані' },
  { value: 'new', label: 'Спочатку новинки' },
  { value: 'price-asc', label: 'Спочатку дешевші' },
  { value: 'price-desc', label: 'Спочатку дорожчі' },
  { value: 'available-first', label: 'Спочатку в наявності' },
]

export const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Усі' },
  { value: 'available', label: 'В наявності' },
  { value: 'coming-soon', label: 'Незабаром' },
]

/** lowercase + trim; toLowerCase handles Cyrillic correctly. */
export function normalizeQuery(input: string): string {
  return input.toLowerCase().trim()
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
      return arr.sort((a, b) => (a.tag === 'New' ? 0 : 1) - (b.tag === 'New' ? 0 : 1))
    case 'available-first':
      return arr.sort(
        (a, b) => (a.status === 'available' ? 0 : 1) - (b.status === 'available' ? 0 : 1),
      )
    default:
      return arr
  }
}
