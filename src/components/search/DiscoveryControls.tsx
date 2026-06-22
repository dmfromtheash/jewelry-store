'use client'

import { useEffect, useState } from 'react'
import { SORT_OPTIONS, STATUS_OPTIONS, type SortKey, type StatusFilter } from '../../lib/catalog'

/**
 * AURELIA — DiscoveryControls (client) — Этап 12A; price/material/summary Этап 64A
 *
 * Shared sort + status toolbar used by the category browser and the search page. Pure
 * presentational: all state lives in the parent (and the URL). Этап 64A adds OPTIONAL
 * price-range inputs, a material/coating facet, and an active-filters summary with a
 * reset — all rendered only when the parent wires them, so existing callers are unaffected.
 * Reuses existing storefront classes (no new design system).
 */

interface DiscoveryControlsProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  countLabel: string
  // --- Этап 64A optional extras ---
  /** Applied price bounds (whole UAH as strings, '' when unset) for the inputs. */
  priceMin?: string
  priceMax?: string
  onPriceApply?: (min: string, max: string) => void
  /** Available material/coating facet values (already derived from the shown products). */
  materials?: string[]
  material?: string | null
  onMaterialChange?: (material: string | null) => void
  /** Clears every filter + sort. Shown in the active-filters summary. */
  onResetAll?: () => void
}

function statusLabel(v: StatusFilter): string {
  return STATUS_OPTIONS.find((o) => o.value === v)?.label ?? v
}
function sortLabel(v: SortKey): string {
  return SORT_OPTIONS.find((o) => o.value === v)?.label ?? v
}

export default function DiscoveryControls({
  sort,
  onSortChange,
  status,
  onStatusChange,
  countLabel,
  priceMin,
  priceMax,
  onPriceApply,
  materials,
  material = null,
  onMaterialChange,
  onResetAll,
}: DiscoveryControlsProps) {
  // Local, uncontrolled-ish price inputs; committed to the URL via onPriceApply.
  const [minInput, setMinInput] = useState(priceMin ?? '')
  const [maxInput, setMaxInput] = useState(priceMax ?? '')
  useEffect(() => setMinInput(priceMin ?? ''), [priceMin])
  useEffect(() => setMaxInput(priceMax ?? ''), [priceMax])

  const showPrice = typeof onPriceApply === 'function'
  const showMaterials = !!materials && materials.length > 0 && typeof onMaterialChange === 'function'

  const activeChips: string[] = []
  if (status !== 'all') activeChips.push(statusLabel(status))
  if (material) activeChips.push(material)
  if (priceMin || priceMax) activeChips.push(`${priceMin || '0'}–${priceMax || '∞'} ₴`)
  if (sort !== 'recommended') activeChips.push(sortLabel(sort))

  return (
    <>
      <div className="au-discovery">
        <div className="au-discovery-status" role="group" aria-label="Наявність">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`au-discovery-chip${status === opt.value ? ' is-active' : ''}`}
              aria-pressed={status === opt.value}
              onClick={() => onStatusChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="au-discovery-right">
          <span className="au-discovery-count">{countLabel}</span>
          <label className="au-sort">
            <span>Сортування:</span>
            <select
              aria-label="Сортування"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Price range + material facet (Этап 64A) — only when the parent wires them. */}
      {(showPrice || showMaterials) && (
        <div className="au-discovery">
          {showPrice && (
            <form
              className="au-discovery-price"
              onSubmit={(e) => {
                e.preventDefault()
                onPriceApply!(minInput.trim(), maxInput.trim())
              }}
            >
              <span className="au-sort"><span>Ціна, ₴:</span></span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Ціна від"
                placeholder="від"
                value={minInput}
                onChange={(e) => setMinInput(e.target.value)}
                style={{ width: 84 }}
              />
              <input
                type="number"
                min={0}
                inputMode="numeric"
                aria-label="Ціна до"
                placeholder="до"
                value={maxInput}
                onChange={(e) => setMaxInput(e.target.value)}
                style={{ width: 84 }}
              />
              <button className="au-btn au-btn--ghost" type="submit">Застосувати</button>
            </form>
          )}

          {showMaterials && (
            <div className="au-discovery-status" role="group" aria-label="Матеріал / покриття">
              <button
                type="button"
                className={`au-discovery-chip${!material ? ' is-active' : ''}`}
                aria-pressed={!material}
                onClick={() => onMaterialChange!(null)}
              >
                Будь-який матеріал
              </button>
              {materials!.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`au-discovery-chip${material === m ? ' is-active' : ''}`}
                  aria-pressed={material === m}
                  onClick={() => onMaterialChange!(m)}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active-filters summary + reset (Этап 64A). */}
      {activeChips.length > 0 && onResetAll && (
        <div className="au-discovery">
          <span className="au-discovery-count">Фільтри: {activeChips.join(' · ')}</span>
          <button className="au-btn au-btn--ghost" type="button" onClick={onResetAll}>
            Скинути все
          </button>
        </div>
      )}
    </>
  )
}
