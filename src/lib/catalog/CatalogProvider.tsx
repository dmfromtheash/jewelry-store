'use client'

/**
 * AURELIA — CatalogProvider (client) — Этап 15D
 *
 * Holds the DB-backed catalog snapshot on the client. The snapshot is fetched
 * on the server in the root layout (via src/lib/catalog/server) and passed in
 * as a plain serializable `Product[]`, so client components get real catalog
 * data WITHOUT importing Prisma / server-only.
 *
 * Consumers: HeaderSearch, CartProvider, FavoritesPageClient, RecentlyViewed.
 * `products` feeds the pure search/sort helpers; `getBySlug` resolves slugs
 * (cart / favorites / recently-viewed) — never duplicating data.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Product } from './types'

interface CatalogContextValue {
  products: Product[]
  getBySlug: (slug: string) => Product | undefined
}

const CatalogContext = createContext<CatalogContextValue | null>(null)

export function useCatalog(): CatalogContextValue {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used within <CatalogProvider>')
  return ctx
}

export default function CatalogProvider({
  products,
  children,
}: {
  products: Product[]
  children: ReactNode
}) {
  const value = useMemo<CatalogContextValue>(() => {
    const bySlug = new Map(products.map((p) => [p.slug, p]))
    return { products, getBySlug: (slug) => bySlug.get(slug) }
  }, [products])

  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>
}
