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

/**
 * AURELIA — Favorites state (client) — Этап 11A
 *
 * Frontend-only wishlist. Stores ONLY product slugs in localStorage; all
 * display data is resolved from the mock catalog (src/lib/catalog) by the
 * consumers — never duplicated here. No backend / API / DB.
 */

const STORAGE_KEY = 'aurelia-favorites'

interface FavoritesContextValue {
  slugs: string[]
  count: number
  isFavorite: (slug: string) => boolean
  toggleFavorite: (slug: string) => void
  addFavorite: (slug: string) => void
  removeFavorite: (slug: string) => void
  clearFavorites: () => void
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null)

export function useFavorites(): FavoritesContextValue {
  const ctx = useContext(FavoritesContext)
  if (!ctx) throw new Error('useFavorites must be used within <FavoritesProvider>')
  return ctx
}

function readStorage(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((s): s is string => typeof s === 'string')
  } catch {
    return []
  }
}

export default function FavoritesProvider({ children }: { children: ReactNode }) {
  const [slugs, setSlugs] = useState<string[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setSlugs(readStorage())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs))
    } catch {
      /* ignore quota / privacy-mode errors */
    }
  }, [slugs, hydrated])

  const isFavorite = useCallback((slug: string) => slugs.includes(slug), [slugs])

  const addFavorite = useCallback((slug: string) => {
    setSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
  }, [])

  const removeFavorite = useCallback((slug: string) => {
    setSlugs((prev) => prev.filter((s) => s !== slug))
  }, [])

  const toggleFavorite = useCallback((slug: string) => {
    setSlugs((prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]))
  }, [])

  const clearFavorites = useCallback(() => setSlugs([]), [])

  const count = slugs.length

  const value = useMemo<FavoritesContextValue>(
    () => ({ slugs, count, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites }),
    [slugs, count, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
