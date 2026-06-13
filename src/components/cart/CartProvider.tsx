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
import { getProductBySlug, type Product } from '../../lib/catalog'
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
    if (!getProductBySlug(slug) || qty < 1) return
    setEntries((prev) => {
      const found = prev.find((e) => e.slug === slug)
      if (found) return prev.map((e) => (e.slug === slug ? { ...e, qty: e.qty + qty } : e))
      return [...prev, { slug, qty }]
    })
  }, [])

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
  const openCart = useCallback(() => setIsOpen(true), [])
  const closeCart = useCallback(() => setIsOpen(false), [])

  // Resolve catalog data + totals. Entries whose slug is no longer in the
  // catalog are dropped from the rendered lines (and totals) gracefully.
  const lines = useMemo<CartLine[]>(() => {
    return entries.flatMap((entry) => {
      const product = getProductBySlug(entry.slug)
      if (!product) return []
      const lineTotal = typeof product.price === 'number' ? product.price * entry.qty : 0
      return [{ ...entry, product, lineTotal }]
    })
  }, [entries])

  const count = useMemo(() => entries.reduce((sum, e) => sum + e.qty, 0), [entries])
  const subtotal = useMemo(() => lines.reduce((sum, l) => sum + l.lineTotal, 0), [lines])

  const value: CartContextValue = {
    entries,
    lines,
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
