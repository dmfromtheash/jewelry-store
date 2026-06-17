'use client'

/**
 * AURELIA — ProductCard (client component) — Этапы 8A/11A
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-card)
 *
 * Product card placeholder (no images yet — carries admin/customer states via
 * [data-view]). Client interactions added in 11A:
 *   - corner favorite heart (always visible, active state) → favorites store;
 *   - "Купить": quick add-to-cart for available products (opens the drawer),
 *     otherwise a link to the product page;
 *   - clickable media + quick-view link to /product/[slug].
 * No nested <a><button>: the favorite button is a sibling of the media link.
 */

import Link from 'next/link'
import { formatPrice } from '../../lib/catalog'
import type { ProductStatus } from '../../lib/catalog'
import { useFavorites } from '../favorites/FavoritesProvider'
import { useCart } from '../cart/CartProvider'

interface ProductCardProps {
  name: string
  category: string
  tag?: string
  /** gold tag variant (e.g. "New"); otherwise dark (e.g. "Хит") */
  tagGold?: boolean
  /** real catalog slug → card links to /product/[slug]; absent → coming-soon */
  slug?: string
  status?: ProductStatus
  /** UAH; a number renders a real price, otherwise the "— ₴" placeholder */
  price?: number | null
  /** real uploaded image URL → rendered in place of the media placeholder */
  imageUrl?: string | null
  /** alt text for the real image (falls back to the product name) */
  imageAlt?: string
}

const GemIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

const HeartIcon = ({ filled }: { filled: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
  </svg>
)

export default function ProductCard({
  name,
  category,
  tag,
  tagGold = false,
  slug,
  status,
  price,
  imageUrl,
  imageAlt,
}: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites()
  const { addItem, openCart } = useCart()

  // Real catalog products link to their slug page; placeholder cards (no slug)
  // keep the existing coming-soon fallback.
  const href = slug ? `/product/${slug}` : '/product/coming-soon'
  const favorited = slug ? isFavorite(slug) : false
  const canBuy = status === 'available' && !!slug

  return (
    <article className="au-card">
      {tag && (
        <span className={`au-card-tag${tagGold ? ' au-card-tag--gold' : ''}`}>{tag}</span>
      )}

      {slug && (
        <button
          className={`au-card-fav${favorited ? ' is-active' : ''}`}
          type="button"
          aria-pressed={favorited}
          aria-label={favorited ? 'Убрать из избранного' : 'В избранное'}
          onClick={() => toggleFavorite(slug)}
        >
          <HeartIcon filled={favorited} />
        </button>
      )}

      <Link className="au-card-media" href={href} aria-label={name}>
        {imageUrl ? (
          // Real uploaded image fills the existing media box (no layout change —
          // sizing is inline so no card stylesheet is touched).
          <img
            src={imageUrl}
            alt={imageAlt || name}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <>
            <span className="dash only-admin" />
            <div className="only-admin">
              <span className="au-ph-plus">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
              <span className="t">Добавить товар</span>
              <span className="s">Нажмите, чтобы загрузить изображение</span>
            </div>
            <div className="only-customer">
              <span className="au-ph-gem">
                <GemIcon />
              </span>
              <span className="t-cust">Скоро будет добавлен товар</span>
            </div>
          </>
        )}
      </Link>

      <div className="au-card-body">
        <h3 className="au-card-name">{name}</h3>
        <p className="au-card-cat">{category}</p>
        <div className="au-card-meta">
          <span className="au-stars" aria-hidden="true">★★★★★</span>
          <span className="au-card-reviews">0 отзывов</span>
        </div>
        <div className="au-card-price">
          {typeof price === 'number' ? formatPrice(price) : <span className="dim">— ₴</span>}
        </div>

        {/* reserved slot keeps layout from jumping when actions appear */}
        <div className="au-card-actions-slot" />
        <div className="au-card-actions">
          {canBuy ? (
            <button
              className="au-btn au-btn--primary buy"
              type="button"
              onClick={() => {
                addItem(slug!)
                openCart()
              }}
            >
              Купить
            </button>
          ) : (
            <Link className="au-btn au-btn--primary buy" href={href}>
              Купить
            </Link>
          )}
          <Link className="au-act-ico" href={href} aria-label="Быстрый просмотр">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="2.8" />
            </svg>
          </Link>
        </div>
      </div>
    </article>
  )
}
