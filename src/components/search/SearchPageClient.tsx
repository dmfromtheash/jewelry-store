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
    return sortProducts(filterByStatus(searchProducts(q), status), sort)
  }, [q, status, sort])

  // Empty query — nothing searched yet.
  if (!q) {
    return (
      <div className="au-container au-search-page">
        <h1 className="au-search-title">Поиск</h1>
        <div className="au-search-state">
          <p className="au-search-state-title">Введите запрос в поиске</p>
          <p className="au-search-state-sub">
            Например: «кольцо», «серьги», «набор» — или загляните в каталог.
          </p>
          <div className="au-search-state-actions">
            <Link className="au-btn au-btn--primary" href="/category/bijouterie">
              В каталог
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="au-container au-search-page">
      <h1 className="au-search-title">
        Результаты по запросу <span className="au-search-q">«{q}»</span>
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
          <p className="au-search-state-title">Ничего не найдено</p>
          <p className="au-search-state-sub">
            По запросу «{q}» с выбранным фильтром товаров нет. Попробуйте изменить запрос
            или сбросить фильтр.
          </p>
          <div className="au-search-state-actions">
            <button
              className="au-btn au-btn--ghost"
              type="button"
              onClick={() => setParams({ status: 'all', sort: 'recommended' })}
            >
              Сбросить фильтры
            </button>
            <Link className="au-btn au-btn--ghost" href="/category/bijouterie">
              В каталог
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
            />
          ))}
        </div>
      )}
    </div>
  )
}
