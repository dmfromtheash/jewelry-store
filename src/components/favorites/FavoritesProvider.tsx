'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  addFavoriteAction,
  clearServerFavoritesAction,
  loadServerFavoritesAction,
  removeFavoriteAction,
  syncFavoritesAction,
} from '../../lib/customer/wishlist-actions'

/**
 * AURELIA — Favorites state (client) — Этап 11A; server persistence Этап 62A
 *
 * Stores ONLY product slugs; all display data is resolved from the catalog by the
 * consumers. Guests stay localStorage-only (unchanged behaviour, no network). For a
 * LOGGED-IN customer the same favourites are ALSO persisted server-side so they survive
 * across devices/sessions:
 *   - on mount we ask the server whether there is a session (loadServerFavoritesAction);
 *   - if authenticated, we merge the server wishlist with the local one and push any
 *     local-only slugs once (syncFavoritesAction) so favourites saved while logged out are
 *     carried into the account;
 *   - every add/remove/clear is then mirrored to the server (best-effort: failures are
 *     swallowed so the UI never breaks and the local store stays the source of truth on
 *     screen).
 *
 * The server actions re-derive the customer from the verified session, so this client code
 * can never address another customer's wishlist. No backend reads happen for a guest.
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
  // True once the server confirms a logged-in customer — gates all server writes so a
  // guest never makes a network call.
  const authedRef = useRef(false)

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

  // One-time server reconciliation after hydration. Guests resolve to authenticated:false
  // and we do nothing further (localStorage-only, exactly as before).
  useEffect(() => {
    if (!hydrated) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await loadServerFavoritesAction()
        if (cancelled || !res.authenticated) return
        authedRef.current = true
        const local = readStorage()
        const serverSet = new Set(res.slugs)
        const localOnly = local.filter((s) => !serverSet.has(s))
        if (localOnly.length > 0) {
          // Push favourites saved while logged out, then adopt the merged server set.
          const merged = await syncFavoritesAction(local)
          if (!cancelled && merged.ok) {
            setSlugs(merged.slugs)
            return
          }
        }
        // Adopt the union of local + server so nothing on screen disappears.
        if (!cancelled) {
          setSlugs((prev) => Array.from(new Set([...res.slugs, ...prev])))
        }
      } catch {
        /* offline / not configured — stay on the local store */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [hydrated])

  const isFavorite = useCallback((slug: string) => slugs.includes(slug), [slugs])

  const addFavorite = useCallback((slug: string) => {
    setSlugs((prev) => (prev.includes(slug) ? prev : [...prev, slug]))
    if (authedRef.current) void addFavoriteAction(slug).catch(() => {})
  }, [])

  const removeFavorite = useCallback((slug: string) => {
    setSlugs((prev) => prev.filter((s) => s !== slug))
    if (authedRef.current) void removeFavoriteAction(slug).catch(() => {})
  }, [])

  const toggleFavorite = useCallback((slug: string) => {
    let willAdd = false
    setSlugs((prev) => {
      willAdd = !prev.includes(slug)
      return willAdd ? [...prev, slug] : prev.filter((s) => s !== slug)
    })
    if (authedRef.current) {
      const action = willAdd ? addFavoriteAction : removeFavoriteAction
      void action(slug).catch(() => {})
    }
  }, [])

  const clearFavorites = useCallback(() => {
    setSlugs([])
    if (authedRef.current) void clearServerFavoritesAction().catch(() => {})
  }, [])

  const count = slugs.length

  const value = useMemo<FavoritesContextValue>(
    () => ({ slugs, count, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites }),
    [slugs, count, isFavorite, toggleFavorite, addFavorite, removeFavorite, clearFavorites],
  )

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>
}
