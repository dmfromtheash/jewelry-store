/**
 * AURELIA — Admin product form parsing/validation (Этап 26I) — server-only
 *
 * Pure helpers for the admin product create/edit forms. Kept in a separate module
 * (not in catalog-actions.ts) because that file is `'use server'` and may only
 * export async server actions. No Prisma here — just FormData → a validated,
 * normalized shape the actions can persist.
 *
 * Money: the form takes a human-readable UAH amount; the DB stores integer MINOR
 * units (kopecks). Status rules mirror the storefront contract (see catalog/map.ts):
 * an `available` product must have a positive price; `coming_soon` may have none.
 */

import 'server-only'

/** Slug contract: lowercase latin letters/digits, hyphen-separated (matches storefront URLs). */
export const PRODUCT_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const PRODUCT_STATUSES = ['available', 'coming_soon'] as const
export type ProductFormStatus = (typeof PRODUCT_STATUSES)[number]

/** Validation error codes — surfaced to the form via the ?err= query param. */
export type ProductFormErrorCode =
  | 'name'
  | 'slug'
  | 'category'
  | 'status'
  | 'price'
  | 'stock'

/** Normalized, persistable product fields parsed from the form. */
export interface ParsedProductInput {
  name: string
  slug: string
  categoryId: string
  /** Card caption ("Серьги · позолота"); '' means "derive from the category name". */
  categoryLabel: string
  status: ProductFormStatus
  /** Integer MINOR units (kopecks); null for coming-soon without a price. */
  price: number | null
  /** Product-level stock (Этап 28B): null = not tracked, else a non-negative int. */
  stockQuantity: number | null
  sku: string | null
  brand: string | null
  description: string | null
  tag: string | null
  tagGold: boolean
}

export type ParseProductResult =
  | { ok: true; data: ParsedProductInput }
  | { ok: false; error: ProductFormErrorCode }

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

/** Optional text field → trimmed value or null. */
function optStr(formData: FormData, key: string): string | null {
  const v = str(formData, key)
  return v.length > 0 ? v : null
}

function isStatus(value: string): value is ProductFormStatus {
  return (PRODUCT_STATUSES as readonly string[]).includes(value)
}

/**
 * Parses a human-readable UAH amount → integer minor units.
 * Accepts grouping spaces and a comma/dot decimal separator. Returns:
 *   - { value: number } on success (>= 0 minor units),
 *   - 'empty' when nothing was entered,
 *   - 'invalid' when the input is not a valid non-negative amount.
 */
function parseRubToMinor(raw: string): { value: number } | 'empty' | 'invalid' {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  if (cleaned.length === 0) return 'empty'
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return 'invalid'
  const rub = Number(cleaned)
  if (!Number.isFinite(rub) || rub < 0) return 'invalid'
  return { value: Math.round(rub * 100) }
}

/**
 * Parses an optional stock quantity (Этап 28B). Empty → null (NOT tracked). A
 * value must be a non-negative integer (0 = out of stock). Returns:
 *   - { value: number | null } on success,
 *   - 'invalid' otherwise.
 */
function parseStock(raw: string): { value: number | null } | 'invalid' {
  const cleaned = raw.replace(/\s/g, '')
  if (cleaned.length === 0) return { value: null }
  if (!/^\d+$/.test(cleaned)) return 'invalid'
  const n = Number(cleaned)
  if (!Number.isInteger(n) || n < 0) return 'invalid'
  return { value: n }
}

/**
 * Parses + validates the product form. The slug format is checked here; slug
 * UNIQUENESS is enforced by the DB (a P2002 in the action), not here.
 */
export function parseProductForm(formData: FormData): ParseProductResult {
  const name = str(formData, 'name')
  if (!name) return { ok: false, error: 'name' }

  const slug = str(formData, 'slug').toLowerCase()
  if (!slug || !PRODUCT_SLUG_RE.test(slug)) return { ok: false, error: 'slug' }

  const categoryId = str(formData, 'categoryId')
  if (!categoryId) return { ok: false, error: 'category' }

  const status = str(formData, 'status')
  if (!isStatus(status)) return { ok: false, error: 'status' }

  const priceRaw = str(formData, 'price')
  const parsedPrice = parseRubToMinor(priceRaw)
  let price: number | null
  if (status === 'available') {
    // Available products must carry a positive price.
    if (parsedPrice === 'empty' || parsedPrice === 'invalid' || parsedPrice.value <= 0) {
      return { ok: false, error: 'price' }
    }
    price = parsedPrice.value
  } else {
    // coming_soon: price is optional; if provided it must still be valid.
    if (parsedPrice === 'invalid') return { ok: false, error: 'price' }
    price = parsedPrice === 'empty' ? null : parsedPrice.value
  }

  const parsedStock = parseStock(str(formData, 'stockQuantity'))
  if (parsedStock === 'invalid') return { ok: false, error: 'stock' }

  return {
    ok: true,
    data: {
      name,
      slug,
      categoryId,
      categoryLabel: str(formData, 'categoryLabel'),
      status,
      price,
      stockQuantity: parsedStock.value,
      sku: optStr(formData, 'sku'),
      brand: optStr(formData, 'brand'),
      description: optStr(formData, 'description'),
      tag: optStr(formData, 'tag'),
      tagGold: str(formData, 'tagGold') === 'on',
    },
  }
}
