'use client'

import { useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ProductCard from '../product/ProductCard'
import DiscoveryControls from './DiscoveryControls'
import {
  filterByStatus,
  parseSort,
  parseStatus,
  productCountLabel,
  searchProducts,
  sortProducts,
  type SortKey,
  type StatusFilter,
} from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'

/**
 * AURELIA — SearchPageClient (client) — Этап 12A
 *
 * Frontend-only search results. Reads q / sort / status from the URL (so they
 * survive a reload), runs the in-memory catalog search, and renders the grid
 * with empty / no-results states. No backend or API.
 */

export default function SearchPageClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { products } = useCatalog()

  const q = (searchParams.get('q') ?? '').trim()
  const sort = parseSort(searchParams.get('sort'))
  const status = parseStatus(searchParams.get('status'))

  const setParams = useCallback(
    (next: { sort?: SortKey; status?: StatusFilter }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next.sort !== undefined) {
        if (next.sort === 'recommended') params.delete('sort')
        else params.set('sort', next.sort)
      }
      if (next.status !== undefined) {
        if (next.status === 'all') params.delete('status')
        else params.set('status', next.status)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const results = useMemo(() => {
    if (!q) return []
    return sortProducts(filterByStatus(searchProducts(q, products), status), sort)
  }, [q, status, sort, products])

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
        onSortChange={(s) => setParams({ sort: s })}
        status={status}
        onStatusChange={(s) => setParams({ status: s })}
        countLabel={productCountLabel(results.length)}
      />

      {results.length === 0 ? (
        <div className="au-search-state">
          <p className="au-search-state-title">Нічого не знайдено</p>
          <p className="au-search-state-sub">
            За запитом «{q}» з обраним фільтром товарів немає. Спробуйте змінити запит
            або скинути фільтр.
          </p>
          <div className="au-search-state-actions">
            <button
              className="au-btn au-btn--ghost"
              type="button"
              onClick={() => setParams({ status: 'all', sort: 'recommended' })}
            >
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
