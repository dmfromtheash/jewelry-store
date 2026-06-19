'use client'

import Link from 'next/link'
import { useFavorites } from './FavoritesProvider'
import { type Product } from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'
import ProductCard from '../product/ProductCard'

/**
 * AURELIA — FavoritesPageClient (client) — Этап 11A
 *
 * Renders the wishlist: empty state with catalog links, or a product grid
 * resolved from the catalog by stored slugs (no duplicated data). Removing an
 * item happens via the heart on each card; "Очистить избранное" clears all.
 */

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default function FavoritesPageClient() {
  const { slugs, count, clearFavorites } = useFavorites()
  const { getBySlug } = useCatalog()

  const products = slugs
    .map((slug) => getBySlug(slug))
    .filter((p): p is Product => Boolean(p))

  if (products.length === 0) {
    return (
      <div className="au-container au-fav-page">
        <div className="au-fav-empty">
          <span className="au-fav-empty-ico">
            <GemIcon />
          </span>
          <h1 className="au-fav-empty-title">В обраному поки порожньо</h1>
          <p className="au-fav-empty-sub">
            Позначайте прикраси сердечком — вони збережуться тут.
          </p>
          <div className="au-fav-empty-actions">
            <Link className="au-btn au-btn--primary" href="/category/bijouterie">
              До каталогу
            </Link>
            <Link className="au-btn au-btn--ghost" href="/">
              На головну
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="au-container au-fav-page">
      <div className="au-fav-head">
        <h1 className="au-fav-title">
          Обране <span className="au-fav-count">· {count}</span>
        </h1>
        <button className="au-btn au-btn--ghost au-fav-clear" type="button" onClick={clearFavorites}>
          Очистити обране
        </button>
      </div>

      <div className="au-grid au-fav-grid">
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
    </div>
  )
}
