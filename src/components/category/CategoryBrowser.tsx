'use client'

import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import ProductCard from '../product/ProductCard'
import DiscoveryControls from '../search/DiscoveryControls'
import SaveSearchControl from '../search/SaveSearchControl'
import {
  deriveMaterials,
  filterByMaterial,
  filterByPrice,
  filterByStatus,
  parseMaterial,
  parsePriceRange,
  parseSort,
  parseStatus,
  productCountLabel,
  sortProducts,
  type Product,
} from '../../lib/catalog'

/**
 * AURELIA — CategoryBrowser (client) — Этап 12A; price/material Этап 64A
 *
 * Makes the category toolbar functional: status + price range + material/coating facet +
 * sort over the category's products, all frontend-only over the server-provided snapshot.
 * Every control lives in the URL (?status=&minPrice=&maxPrice=&material=&sort=) so the view
 * is shareable and survives a reload. Renders the product grid + an honest empty state.
 */

export default function CategoryBrowser({ products }: { products: Product[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // The category slug for a saved search (e.g. "/category/bijouterie" → "bijouterie"). The
  // saved-search validator re-checks it against the allowlist, so an unexpected path is safe.
  const categorySlug = pathname.split('/').filter(Boolean).pop() ?? null

  const sort = parseSort(searchParams.get('sort'))
  const status = parseStatus(searchParams.get('status'))
  const price = parsePriceRange(searchParams.get('minPrice'), searchParams.get('maxPrice'))
  const materials = useMemo(() => deriveMaterials(products), [products])
  const material = parseMaterial(searchParams.get('material'), products) ?? null

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

  const resetAll = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  const visible = useMemo(
    () =>
      sortProducts(
        filterByMaterial(filterByPrice(filterByStatus(products, status), price), material),
        sort,
      ),
    [products, status, price, material, sort],
  )

  return (
    <div className="au-cat-browser">
      <DiscoveryControls
        sort={sort}
        onSortChange={(s) => setParams({ sort: s === 'recommended' ? null : s })}
        status={status}
        onStatusChange={(s) => setParams({ status: s === 'all' ? null : s })}
        countLabel={productCountLabel(visible.length)}
        priceMin={price.min !== undefined ? String(price.min) : ''}
        priceMax={price.max !== undefined ? String(price.max) : ''}
        onPriceApply={(min, max) => setParams({ minPrice: min || null, maxPrice: max || null })}
        materials={materials}
        material={material}
        onMaterialChange={(m) => setParams({ material: m })}
        onResetAll={resetAll}
      />

      {/* Save the current category + filters (Этап 69A) — logged-in customers only (action-gated). */}
      <SaveSearchControl
        categorySlug={categorySlug}
        sort={sort}
        status={status}
        minPrice={price.min !== undefined ? String(price.min) : null}
        maxPrice={price.max !== undefined ? String(price.max) : null}
        material={material}
      />

      {visible.length === 0 ? (
        <div className="au-discovery-empty">
          <p className="au-discovery-empty-title">Нічого не знайдено</p>
          <p className="au-discovery-empty-sub">
            У цій категорії немає товарів з обраними фільтрами. Спробуйте змінити ціну,
            матеріал чи наявність.
          </p>
          <button className="au-btn au-btn--ghost" type="button" onClick={resetAll}>
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
