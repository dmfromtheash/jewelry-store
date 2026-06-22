/**
 * AURELIA — Saved catalog search: validation + safe URL builder (Этап 69A)
 *
 * Pure, dependency-light helpers for the logged-in customer's saved searches. NO Prisma,
 * NO `server-only`, NO React — so the SAME validation is authoritative in the server action
 * AND exercised by the verify script (under tsx). Reuses the catalog parsers so a saved
 * search can only ever hold values the catalog itself accepts.
 *
 * Safety by construction:
 *   - we store VALIDATED FIELDS, never a raw URL: a stored search can't smuggle a
 *     `javascript:`/`data:`/external link or any HTML — `buildSavedSearchUrl` re-derives a
 *     relative in-app path from the clean fields at render time;
 *   - label + material are length-capped and markup-stripped (same predicate as the rest of
 *     the customer/site-settings writers);
 *   - categorySlug / sort / statusFilter are validated against fixed allowlists; prices are
 *     non-negative integers (swapped when min > max), exactly like the catalog discovery URL.
 */

import { hasUnsafeMarkup } from './validate'
import {
  parsePrice,
  parseSort,
  parseStatus,
  normalizeSearchQuery,
  type SortKey,
  type StatusFilter,
} from '../catalog/search'

export const SAVED_SEARCH_LABEL_MAX = 60
export const SAVED_SEARCH_MATERIAL_MAX = 40
/** Per-customer cap (enforced in the repo) so the list can't grow unbounded. */
export const SAVED_SEARCH_MAX_PER_CUSTOMER = 30

/** Catalog scopes a saved search may target (matches the /category routes). */
export const SAVED_SEARCH_CATEGORIES = ['bijouterie', 'gifts'] as const
export type SavedSearchCategory = (typeof SAVED_SEARCH_CATEGORIES)[number]

/** The clean, validated shape stored in the DB (all already safe). */
export interface NormalizedSavedSearch {
  label: string
  query: string | null
  categorySlug: SavedSearchCategory | null
  sort: SortKey | null
  statusFilter: StatusFilter | null
  minPrice: number | null
  maxPrice: number | null
  material: string | null
}

export type SavedSearchFieldErrors = Partial<Record<'label' | 'query' | 'material', string>>

export interface SavedSearchValidationResult {
  errors: SavedSearchFieldErrors
  /** Present only when `errors` is empty. */
  value?: NormalizedSavedSearch
}

/** Raw input from the client (a label plus the current catalog filter params). */
export interface SavedSearchInputRaw {
  label?: string
  query?: string | null
  categorySlug?: string | null
  sort?: string | null
  status?: string | null
  minPrice?: string | null
  maxPrice?: string | null
  material?: string | null
}

function checkMaterial(raw: string | null | undefined): { error?: string; value: string | null } {
  const m = (raw ?? '').trim()
  if (!m) return { value: null }
  if (m.length > SAVED_SEARCH_MATERIAL_MAX) return { error: 'Матеріал задовгий.', value: null }
  if (hasUnsafeMarkup(m)) return { error: 'Матеріал містить недопустимі символи.', value: null }
  return { value: m }
}

/** Default human label when the customer doesn't type one. */
export function defaultSavedSearchLabel(input: SavedSearchInputRaw): string {
  const q = normalizeSearchQuery(input.query ?? '')
  if (q) return `Пошук: ${q}`.slice(0, SAVED_SEARCH_LABEL_MAX)
  const cat = parseCategory(input.categorySlug)
  if (cat === 'bijouterie') return 'Каталог: Біжутерія'
  if (cat === 'gifts') return 'Каталог: Подарунки'
  return 'Збережений пошук'
}

/** Validates a raw category param against the allowlist (or null). */
export function parseCategory(raw: string | null | undefined): SavedSearchCategory | null {
  if (raw == null) return null
  const v = String(raw).trim().toLowerCase()
  return (SAVED_SEARCH_CATEGORIES as readonly string[]).includes(v) ? (v as SavedSearchCategory) : null
}

/**
 * Validates + normalises a saved-search payload. The label is required (falls back to a
 * sensible default when blank); every other field is normalised through the catalog parsers
 * so only catalog-valid values are ever stored. Prices are swapped when min > max.
 */
export function validateSavedSearchInput(input: SavedSearchInputRaw): SavedSearchValidationResult {
  const errors: SavedSearchFieldErrors = {}

  let label = (input.label ?? '').trim()
  if (!label) label = defaultSavedSearchLabel(input)
  if (label.length > SAVED_SEARCH_LABEL_MAX) errors.label = 'Назва задовга.'
  else if (hasUnsafeMarkup(label)) errors.label = 'Назва містить недопустимі символи.'

  // Query: reuse the catalog normaliser (caps length, rejects markup → '' when invalid).
  const query = normalizeSearchQuery(input.query ?? '') || null
  if ((input.query ?? '').trim() && !query) errors.query = 'Некоректний пошуковий запит.'

  const materialCheck = checkMaterial(input.material)
  if (materialCheck.error) errors.material = materialCheck.error

  const categorySlug = parseCategory(input.categorySlug)

  // Sort / status: parsers fall back to the default; store null when it's the default so
  // the rebuilt URL stays minimal.
  const sortParsed = parseSort(input.sort)
  const sort: SortKey | null = sortParsed === 'recommended' ? null : sortParsed
  const statusParsed = parseStatus(input.status)
  const statusFilter: StatusFilter | null = statusParsed === 'all' ? null : statusParsed

  // Prices: non-negative integers; swap when min > max (deterministic, matches the catalog).
  let minPrice = parsePrice(input.minPrice) ?? null
  let maxPrice = parsePrice(input.maxPrice) ?? null
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    const t = minPrice
    minPrice = maxPrice
    maxPrice = t
  }

  if (Object.keys(errors).length > 0) return { errors }
  return {
    errors,
    value: {
      label,
      query,
      categorySlug,
      sort,
      statusFilter,
      minPrice,
      maxPrice,
      material: materialCheck.value,
    },
  }
}

/**
 * Builds a SAFE relative in-app URL from the validated fields — never a stored raw URL.
 * Category searches point at /category/<slug>; everything else at /search?q=…. Only known
 * params are appended, so the result is always an internal path starting with "/".
 */
export function buildSavedSearchUrl(s: {
  query?: string | null
  categorySlug?: string | null
  sort?: string | null
  statusFilter?: string | null
  minPrice?: number | null
  maxPrice?: number | null
  material?: string | null
}): string {
  const category = parseCategory(s.categorySlug)
  const params = new URLSearchParams()

  // Text query only applies to the sitewide /search surface.
  if (!category && s.query) params.set('q', s.query)
  if (s.sort) params.set('sort', s.sort)
  if (s.statusFilter) params.set('status', s.statusFilter)
  if (typeof s.minPrice === 'number') params.set('minPrice', String(s.minPrice))
  if (typeof s.maxPrice === 'number') params.set('maxPrice', String(s.maxPrice))
  if (s.material) params.set('material', s.material)

  const base = category ? `/category/${category}` : '/search'
  const qs = params.toString()
  return qs ? `${base}?${qs}` : base
}
