'use client'

import { useEffect, useState } from 'react'
import { type Product } from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'
import ProductCard from './ProductCard'

/**
 * AURELIA — RecentlyViewed (client) — Этап 11A
 *
 * Frontend-only "recently viewed" strip. On mount it records the current
 * product slug into localStorage (most-recent first, capped) and renders the
 * previously-viewed products (excluding the current one) as cards. Slugs only —
 * product data is resolved from the catalog. No tracking/analytics.
 */

const STORAGE_KEY = 'aurelia-recently-viewed'
const MAX_STORED = 8
const MAX_SHOWN = 4

export default function RecentlyViewed({ currentSlug }: { currentSlug: string }) {
  const { getBySlug } = useCatalog()
  const [products, setProducts] = useState<Product[]>([])

  useEffect(() => {
    let stored: string[] = []
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      if (Array.isArray(parsed)) stored = parsed.filter((s): s is string => typeof s === 'string')
    } catch {
      stored = []
    }

    // Previously-viewed items (before recording the current visit).
    const previous = stored.filter((s) => s !== currentSlug)

    // Record the current product at the front, capped.
    const updated = [currentSlug, ...previous].slice(0, MAX_STORED)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    } catch {
      /* ignore storage errors */
    }

    setProducts(
      previous
        .map((slug) => getBySlug(slug))
        .filter((p): p is Product => Boolean(p))
        .slice(0, MAX_SHOWN),
    )
  }, [currentSlug, getBySlug])

  if (products.length === 0) return null

  return (
    <section className="au-section au-recent">
      <div className="au-section-head">
        <h2 className="au-section-title">Вы недавно смотрели</h2>
      </div>
      <div className="au-grid">
        {products.map((product) => (
          <ProductCard
            key={product.slug}
            name={product.name}
            category={product.category}
            slug={product.slug}
            status={product.status}
            price={product.price}
            tag={product.tag}
            tagGold={product.tagGold}
            imageUrl={product.imageUrl}
            imageAlt={product.name}
          />
        ))}
      </div>
    </section>
  )
}
