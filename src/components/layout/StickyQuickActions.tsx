'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ProfileButton from '../auth/ProfileButton'
import CartButton from '../cart/CartButton'
import FavoritesButton from '../favorites/FavoritesButton'

/**
 * AURELIA — StickyQuickActions (client) — Этап 77A
 *
 * Compact quick-action group surfaced ONLY while the category nav is pinned to
 * the top (sticky/scrolled state). The category nav (.au-nav) is already
 * `position: sticky; top: 0`, so it stays at the top once the main header has
 * scrolled out of view. At that moment the header icons (search / profile /
 * favorites / cart) are no longer reachable — this group brings them back, plus
 * a Home shortcut and a compact inline search.
 *
 * At the top of the page the group is invisible and non-interactive, so the
 * normal (non-scrolled) header design is left completely unchanged. This is a
 * targeted exception to the design lock for the sticky quick actions only.
 *
 * Reuse: the profile / favorites / cart icons are the EXISTING header components,
 * so their badges, counts and login/account/cart-drawer behaviour are preserved
 * automatically (no duplicated state logic). Only Home and the compact search
 * are new, and they match the existing icon style + search route (/search?q=).
 *
 * Sticky detection uses an IntersectionObserver on the main header — no
 * per-frame scroll work, no layout thrashing, and listeners are cleaned up.
 */
export default function StickyQuickActions({ accountName }: { accountName?: string | null }) {
  const router = useRouter()
  const [stuck, setStuck] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sticky/scrolled detection: once the main header has fully scrolled out of
  // view, the already-sticky category nav is pinned at the top — that is when
  // the quick actions should appear.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const header = document.querySelector('.au-header')
    if (!header) return
    const io = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 },
    )
    io.observe(header)
    return () => io.disconnect()
  }, [])

  // Collapse the inline search whenever the group hides (back at the top).
  useEffect(() => {
    if (!stuck) setSearchOpen(false)
  }, [stuck])

  // Focus the field when it opens.
  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  const submitSearch = () => {
    const trimmed = query.trim()
    if (!trimmed) return // empty query → never navigate / break routing
    setSearchOpen(false)
    router.push(`/search?q=${encodeURIComponent(trimmed)}`)
  }

  return (
    <div className="au-quick-actions-bar" aria-hidden={!stuck}>
      <div className="au-quick-actions-in">
        <div className={`au-quick-actions${stuck ? ' is-visible' : ''}`}>
          <Link className="au-icon-btn" href="/" aria-label="На головну">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 11.5 12 5l8 6.5" />
              <path d="M6 10.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.5" />
            </svg>
          </Link>

          <form
            className={`au-quick-search${searchOpen ? ' is-open' : ''}`}
            role="search"
            onSubmit={(e) => {
              e.preventDefault()
              submitSearch()
            }}
          >
            <button
              className="au-icon-btn"
              type="button"
              aria-label="Пошук"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <svg width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="9" cy="9" r="6.5" />
                <path d="M14 14l4.5 4.5" />
              </svg>
            </button>
            <input
              ref={inputRef}
              className="au-quick-search-input"
              type="search"
              placeholder="Пошук прикрас"
              aria-label="Пошук прикрас"
              value={query}
              tabIndex={searchOpen ? 0 : -1}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setSearchOpen(false)
              }}
            />
          </form>

          <ProfileButton accountName={accountName} />
          <FavoritesButton />
          <CartButton />
        </div>
      </div>
    </div>
  )
}
