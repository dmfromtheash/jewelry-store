'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ProductCard from '../product/ProductCard'
import DiscoveryControls from '../search/DiscoveryControls'
import {
  filterByStatus,
  parseSort,
  parseStatus,
  productCountLabel,
  sortProducts,
  type Product,
  type SortKey,
  type StatusFilter,
} from '../../lib/catalog'

/**
 * AURELIA — CategoryBrowser (client) — Этап 12A
 *
 * Makes the category toolbar functional: status filter + sort over the
 * category's products, all frontend-only. `sort` and `status` live in the URL
 * (?sort=&status=) so they survive a reload. Renders the product grid and an
 * empty state. Receives plain catalog data — never duplicates it.
 */

export default function CategoryBrowser({ products }: { products: Product[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

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

  const visible = useMemo(
    () => sortProducts(filterByStatus(products, status), sort),
    [products, status, sort],
  )

  return (
    <div className="au-cat-browser">
      <DiscoveryControls
        sort={sort}
        onSortChange={(s) => setParams({ sort: s })}
        status={status}
        onStatusChange={(s) => setParams({ status: s })}
        countLabel={productCountLabel(visible.length)}
      />

      {visible.length === 0 ? (
        <div className="au-discovery-empty">
          <p className="au-discovery-empty-title">Нічого не знайдено</p>
          <p className="au-discovery-empty-sub">
            У цій категорії немає товарів з обраним фільтром.
          </p>
          <button
            className="au-btn au-btn--ghost"
            type="button"
            onClick={() => setParams({ status: 'all', sort: 'recommended' })}
          >
            Скинути фільтри
          </button>
        </div>
      ) : (
        <div className="au-cat-grid">
          {visible.map((product) => (
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
