'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ProductCard from '../product/ProductCard'
import DiscoveryControls from './DiscoveryControls'
import {
  deriveMaterials,
  filterByMaterial,
  filterByPrice,
  filterByStatus,
  normalizeSearchQuery,
  parseMaterial,
  parsePriceRange,
  parseSort,
  parseStatus,
  productCountLabel,
  searchProducts,
  sortProducts,
} from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'

/**
 * AURELIA — SearchPageClient (client) — Этап 12A; price/material Этап 64A
 *
 * Frontend-only search over the server-provided catalog snapshot. Reads
 * q / sort / status / minPrice / maxPrice / material from the URL (shareable, reload-safe),
 * runs the local word-prefix search, applies the filters + sort, and renders the grid with
 * honest empty/no-results states. No backend, API or external search service.
 */

export default function SearchPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { products } = useCatalog()

  const q = normalizeSearchQuery(searchParams.get('q'))
  const sort = parseSort(searchParams.get('sort'))
  const status = parseStatus(searchParams.get('status'))
  const price = parsePriceRange(searchParams.get('minPrice'), searchParams.get('maxPrice'))

  // Base matches for the query (before filters) — drives the material facet + filtering.
  const matched = useMemo(() => (q ? searchProducts(q, products) : []), [q, products])
  const materials = useMemo(() => deriveMaterials(matched), [matched])
  const material = parseMaterial(searchParams.get('material'), matched) ?? null

  const setParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  // Reset clears the filters/sort but KEEPS the search query.
  const resetFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, q])

  const results = useMemo(
    () =>
      sortProducts(
        filterByMaterial(filterByPrice(filterByStatus(matched, status), price), material),
        sort,
      ),
    [matched, status, price, material, sort],
  )

  // Empty query — nothing searched yet.
  if (!q) {
    return (
      <div className="au-container au-search-page">
        <h1 className="au-search-title">Пошук</h1>
        <div className="au-search-state">
          <p className="au-search-state-title">Введіть запит у пошуку</p>
          <p className="au-search-state-sub">
            Наприклад: «каблучка», «сережки», «набір» — або загляньте до каталогу.
          </p>
          <div className="au-search-state-actions">
            <Link className="au-btn au-btn--primary" href="/category/bijouterie">
              До каталогу
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="au-container au-search-page">
      <h1 className="au-search-title">
        Результати за запитом <span className="au-search-q">«{q}»</span>
      </h1>

      <DiscoveryControls
        sort={sort}
        onSortChange={(s) => setParams({ sort: s === 'recommended' ? null : s })}
        status={status}
        onStatusChange={(s) => setParams({ status: s === 'all' ? null : s })}
        countLabel={productCountLabel(results.length)}
        priceMin={price.min !== undefined ? String(price.min) : ''}
        priceMax={price.max !== undefined ? String(price.max) : ''}
        onPriceApply={(min, max) => setParams({ minPrice: min || null, maxPrice: max || null })}
        materials={materials}
        material={material}
        onMaterialChange={(m) => setParams({ material: m })}
        onResetAll={resetFilters}
      />

      {results.length === 0 ? (
        <div className="au-search-state">
          <p className="au-search-state-title">Нічого не знайдено</p>
          <p className="au-search-state-sub">
            За запитом «{q}» з обраними фільтрами товарів немає. Спробуйте змінити запит,
            ціну, матеріал або скинути фільтри.
          </p>
          <div className="au-search-state-actions">
            <button className="au-btn au-btn--ghost" type="button" onClick={resetFilters}>
              Скинути фільтри
            </button>
            <Link className="au-btn au-btn--ghost" href="/category/bijouterie">
              До каталогу
            </Link>
          </div>
        </div>
      ) : (
        <div className="au-grid au-search-grid">
          {results.map((product) => (
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
      )}
    </div>
  )
}
