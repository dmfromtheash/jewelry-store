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
import { type Product } from '../../lib/catalog'
import { isProductPurchasable } from '../../lib/catalog/availability'
import { useCatalog } from '../../lib/catalog/CatalogProvider'
import { sendAnalyticsEvent } from '../../lib/analytics/client'
import { ANALYTICS_EVENTS } from '../../lib/analytics/events'
import CartDrawer from './CartDrawer'

/**
 * AURELIA — Cart state (client) — Этап 9A
 *
 * Frontend-only shopping cart. The cart stores ONLY { slug, qty } pairs and
 * persists them in localStorage; all display data (name, price, category) is
 * resolved from the mock catalog (src/lib/catalog) — never duplicated here.
 * No backend, API, checkout or payment.
 */

const STORAGE_KEY = 'aurelia-cart'

export interface CartEntry {
  slug: string
  qty: number
}

/** A cart entry joined with its resolved catalog product, for rendering. */
export interface CartLine extends CartEntry {
  product: Product
  lineTotal: number
}

interface CartContextValue {
  entries: CartEntry[]
  lines: CartLine[]
  /** Entries that can't be ordered: either the slug no longer resolves in the
   *  public catalog snapshot (e.g. a product the admin hid, isPublished=false,
   *  Этап 26L/26M) OR it resolves but is not purchasable by status/price
   *  (e.g. `coming_soon`, Этап 28A). Surfaced so the UI can show them as
   *  unavailable + let the user remove them, instead of silently dropping (and
   *  still counting/submitting) them. */
  unavailable: CartEntry[]
  hasUnavailable: boolean
  count: number
  subtotal: number
  isOpen: boolean
  addItem: (slug: string, qty?: number) => void
  removeItem: (slug: string) => void
  increment: (slug: string) => void
  decrement: (slug: string) => void
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
      .map((e) => ({ slug: e.slug as string, qty: Math.floor(e.qty as number) }))
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

  const addItem = useCallback((slug: string, qty = 1) => {
    // Only add products that actually resolve AND are purchasable (published +
    // available status + price, Этап 28A). Defensive: the storefront already
    // hides "add to cart" for non-purchasable products.
    const product = getBySlug(slug)
    if (!product || !isProductPurchasable(product) || qty < 1) return
    setEntries((prev) => {
      const found = prev.find((e) => e.slug === slug)
      if (found) return prev.map((e) => (e.slug === slug ? { ...e, qty: e.qty + qty } : e))
      return [...prev, { slug, qty }]
    })
    // Analytics: slug + quantity only (no customer data). Best-effort.
    sendAnalyticsEvent(ANALYTICS_EVENTS.addToCart, { productSlug: slug, quantity: qty })
  }, [getBySlug])

  const removeItem = useCallback((slug: string) => {
    setEntries((prev) => prev.filter((e) => e.slug !== slug))
  }, [])

  const increment = useCallback((slug: string) => {
    setEntries((prev) => prev.map((e) => (e.slug === slug ? { ...e, qty: e.qty + 1 } : e)))
  }, [])

  const decrement = useCallback((slug: string) => {
    setEntries((prev) =>
      prev
        .map((e) => (e.slug === slug ? { ...e, qty: e.qty - 1 } : e))
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
      if (!product || !isProductPurchasable(product)) return []
      const lineTotal = typeof product.price === 'number' ? product.price * entry.qty : 0
      return [{ ...entry, product, lineTotal }]
    })
  }, [entries, getBySlug])

  const unavailable = useMemo<CartEntry[]>(
    () => {
      return entries.filter((entry) => {
        const product = getBySlug(entry.slug)
        return !product || !isProductPurchasable(product)
      })
    },
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
