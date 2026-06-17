'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type Product, type ProductVariantRef } from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'
import { cartLineKey, resolveCartLine } from '../../lib/cart/lines'
import { sendAnalyticsEvent } from '../../lib/analytics/client'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import CartDrawer from './CartDrawer'

/**
 * AURELIA — Cart state (client) — Этап 9A; variant identity 30D
 *
 * Frontend-only shopping cart. Each entry stores { slug, qty, variantId? }; line
 * identity is the composite (slug, variantId) so the same product in two variants
 * are two lines. Persisted in localStorage — old `{ slug, qty }` entries (no
 * variantId) still load and resolve via the default-variant fallback (30B/30D).
 * All display data (name, price, variant, category) is resolved from the catalog
 * snapshot — never duplicated here. Price/stock stay server-authoritative.
 */

const STORAGE_KEY = 'aurelia-cart'

export interface CartEntry {
  slug: string
  qty: number
  /** Selected variant (Этап 30D); absent → product sold as-is OR resolve default. */
  variantId?: string
}

/** A cart entry joined with its resolved catalog product + variant, for rendering. */
export interface CartLine extends CartEntry {
  product: Product
  /** Resolved variant (null for a no-variant product). */
  variant: ProductVariantRef | null
  /** Subtext label for the line (variant value), or null. */
  variantLabel: string | null
  /** Unit price in UAH incl. variant priceDelta. */
  unitPrice: number
  lineTotal: number
}

interface CartContextValue {
  entries: CartEntry[]
  lines: CartLine[]
  /** Entries that can't be ordered: the slug no longer resolves in the public
   *  catalog snapshot (admin-hidden, Этап 26L/26M), is not purchasable by
   *  status/price (`coming_soon`, 28A), or its selected variant was deleted /
   *  went out of stock (30D). Surfaced so the UI can show them as unavailable +
   *  let the user remove them, instead of silently dropping (and still
   *  counting/submitting) them. */
  unavailable: CartEntry[]
  hasUnavailable: boolean
  count: number
  subtotal: number
  isOpen: boolean
  addItem: (slug: string, variantId?: string | null, qty?: number) => void
  removeItem: (slug: string, variantId?: string | null) => void
  increment: (slug: string, variantId?: string | null) => void
  decrement: (slug: string, variantId?: string | null) => void
  clear: () => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within <CartProvider>')
  return ctx
}

function readStorage(): CartEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((e) => e && typeof e.slug === 'string' && typeof e.qty === 'number' && e.qty > 0)
      .map((e) => ({
        slug: e.slug as string,
        qty: Math.floor(e.qty as number),
        // Old entries have no variantId → undefined (resolves to default later).
        variantId: typeof e.variantId === 'string' && e.variantId ? (e.variantId as string) : undefined,
      }))
  } catch {
    return []
  }
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const { getBySlug } = useCatalog()
  const [entries, setEntries] = useState<CartEntry[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load persisted cart once on mount (client only).
  useEffect(() => {
    setEntries(readStorage())
    setHydrated(true)
  }, [])

  // Persist on change — but only after the initial load, so we never clobber
  // stored data with the empty initial state during hydration.
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [entries, hydrated])

  const addItem = useCallback((slug: string, variantId?: string | null, qty = 1) => {
    // Only add a line that actually resolves AND is orderable: published +
    // purchasable status/price (28A) AND, for a variant product, an existing,
    // in-stock variant (30D). Defensive — the UI already hides/disables the
    // button for non-purchasable products / out-of-stock variants.
    const product = getBySlug(slug)
    const resolved = resolveCartLine(product, variantId)
    if (!resolved.available || qty < 1) return
    const vid = variantId ?? undefined
    const key = cartLineKey(slug, vid)
    setEntries((prev) => {
      const found = prev.find((e) => cartLineKey(e.slug, e.variantId) === key)
      if (found) {
        return prev.map((e) => (cartLineKey(e.slug, e.variantId) === key ? { ...e, qty: e.qty + qty } : e))
      }
      return [...prev, { slug, qty, variantId: vid }]
    })
    // Analytics: slug + quantity only (no customer data). Best-effort.
    sendAnalyticsEvent(ANALYTICS_EVENTS.addToCart, { productSlug: slug, quantity: qty })
  }, [getBySlug])

  const removeItem = useCallback((slug: string, variantId?: string | null) => {
    const key = cartLineKey(slug, variantId ?? undefined)
    setEntries((prev) => prev.filter((e) => cartLineKey(e.slug, e.variantId) !== key))
  }, [])

  const increment = useCallback((slug: string, variantId?: string | null) => {
    const key = cartLineKey(slug, variantId ?? undefined)
    setEntries((prev) =>
      prev.map((e) => (cartLineKey(e.slug, e.variantId) === key ? { ...e, qty: e.qty + 1 } : e)),
    )
  }, [])

  const decrement = useCallback((slug: string, variantId?: string | null) => {
    const key = cartLineKey(slug, variantId ?? undefined)
    setEntries((prev) =>
      prev
        .map((e) => (cartLineKey(e.slug, e.variantId) === key ? { ...e, qty: e.qty - 1 } : e))
        .filter((e) => e.qty > 0),
    )
  }, [])

  const clear = useCallback(() => setEntries([]), [])
  const openCart = useCallback(() => {
    setIsOpen(true)
    sendAnalyticsEvent(ANALYTICS_EVENTS.cartView) // viewed cart; no payload/PII
  }, [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  // Resolve catalog data + totals. Entries that are no longer orderable — either
  // not in the public snapshot (e.g. a product the admin hid) OR resolved but not
  // purchasable by status/price (e.g. `coming_soon`, Этап 28A) — are split out
  // into `unavailable` instead of silently vanishing: they stay removable and
  // excluded from `lines`/totals (and are therefore never submitted to checkout).
  const lines = useMemo<CartLine[]>(() => {
    return entries.flatMap((entry) => {
      const product = getBySlug(entry.slug)
      const resolved = resolveCartLine(product, entry.variantId)
      if (!product || !resolved.available || resolved.unitPrice == null) return []
      return [
        {
          ...entry,
          product,
          variant: resolved.variant,
          variantLabel: resolved.label,
          unitPrice: resolved.unitPrice,
          lineTotal: resolved.unitPrice * entry.qty,
        },
      ]
    })
  }, [entries, getBySlug])

  const unavailable = useMemo<CartEntry[]>(
    () => entries.filter((entry) => !resolveCartLine(getBySlug(entry.slug), entry.variantId).available),
    [entries, getBySlug],
  )

  // Badge counts only purchasable items; the unavailable ones are shown
  // separately in the drawer so the count never silently disagrees with totals.
  const count = useMemo(() => lines.reduce((sum, l) => sum + l.qty, 0), [lines])
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines])

  const value: CartContextValue = {
    entries,
    lines,
    unavailable,
    hasUnavailable: unavailable.length > 0,
    count,
    subtotal,
    isOpen,
    addItem,
    removeItem,
    increment,
    decrement,
    clear,
    openCart,
    closeCart,
  }

  return (
    <CartContext.Provider value={value}>
      {children}
      <CartDrawer />
    </CartContext.Provider>
  )
}
