'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { searchProducts, formatPrice } from '../../lib/catalog'
import { useCatalog } from '../../lib/catalog/CatalogProvider'

/**
 * AURELIA — HeaderSearch (client) — Этап 12A
 *
 * Functional header search: live suggestions (top matches) + submit to
 * /search?q=. Empty queries are ignored (never break navigation). Frontend
 * only — matching runs in-memory over the mock catalog.
 */

const MAX_SUGGESTIONS = 6

export default function HeaderSearch() {
  const router = useRouter()
  const { products } = useCatalog()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const trimmed = query.trim()
  const suggestions = trimmed ? searchProducts(trimmed, products).slice(0, MAX_SUGGESTIONS) : []

  const goToSearch = () => {
    if (!trimmed) return
    setOpen(false)
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <form
      className="au-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        goToSearch()
      }}
      onBlur={(e) => {
        // Close the dropdown only when focus leaves the whole search widget.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false)
      }}
    >
      <button className="au-search-submit" type="submit" aria-label="Шукати">
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="9" cy="9" r="6.5" />
          <path d="M14 14l4.5 4.5" />
        </svg>
      </button>
      <input
        type="search"
        placeholder="Пошук прикрас"
        aria-label="Пошук прикрас"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />

      {open && trimmed && (
        <div className="au-search-suggest">
          {suggestions.length === 0 ? (
            <p className="au-search-suggest-empty">Нічого не знайдено</p>
          ) : (
            <>
              <ul className="au-search-suggest-list">
                {suggestions.map((product) => (
                  <li key={product.slug}>
                    <Link
                      className="au-search-suggest-item"
                      href={`/product/${product.slug}`}
                      onClick={() => setOpen(false)}
                    >
                      <span className="au-search-suggest-name">{product.name}</span>
                      <span className="au-search-suggest-meta">
                        {product.category}
                        {typeof product.price === 'number' ? ` · ${formatPrice(product.price)}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <button className="au-search-suggest-all" type="submit">
                Показати всі результати
              </button>
            </>
          )}
        </div>
      )}
    </form>
  )
}
