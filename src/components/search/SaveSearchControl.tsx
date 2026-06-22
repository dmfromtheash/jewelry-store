'use client'

/**
 * AURELIA — SaveSearchControl (client) — Этап 69A
 *
 * A small "Зберегти пошук" action row for the logged-in customer to bookmark the CURRENT
 * catalog/search filters. Self-contained so the shared DiscoveryControls toolbar stays
 * untouched. Sends ONLY the current filter params (query/category/sort/status/price/material)
 * to the server action, which validates them and stores clean fields (never a raw URL). A
 * guest is gently asked to log in (the action returns authenticated:false). Reuses ONLY
 * existing classes (au-discovery / au-btn / au-co-note / au-field-error) — no new design/CSS.
 */

import { useState, useTransition } from 'react'
import { createSavedSearchAction } from '../../lib/customer/saved-search-actions'

interface SaveSearchControlProps {
  query?: string | null
  categorySlug?: string | null
  sort?: string | null
  status?: string | null
  minPrice?: string | null
  maxPrice?: string | null
  material?: string | null
}

export default function SaveSearchControl(props: SaveSearchControlProps) {
  const [saved, setSaved] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleSave() {
    setMessage(null)
    setIsError(false)
    startTransition(async () => {
      const result = await createSavedSearchAction({
        query: props.query ?? null,
        categorySlug: props.categorySlug ?? null,
        sort: props.sort ?? null,
        status: props.status ?? null,
        minPrice: props.minPrice ?? null,
        maxPrice: props.maxPrice ?? null,
        material: props.material ?? null,
      })
      if (result.ok) {
        setSaved(true)
      } else {
        setIsError(true)
        setMessage(result.error)
      }
    })
  }

  return (
    <div className="au-discovery">
      {saved ? (
        <span className="au-co-note" role="status">
          Пошук збережено — він зʼявиться в особистому кабінеті.
        </span>
      ) : (
        <>
          <button className="au-btn au-btn--ghost" type="button" onClick={handleSave} disabled={pending}>
            {pending ? 'Зберігаємо…' : 'Зберегти пошук'}
          </button>
          {message && (
            <span className={isError ? 'au-field-error' : 'au-co-note'} role={isError ? 'alert' : 'status'}>
              {message}
            </span>
          )}
        </>
      )}
    </div>
  )
}
