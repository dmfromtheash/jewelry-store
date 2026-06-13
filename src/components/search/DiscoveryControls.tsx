'use client'

import { SORT_OPTIONS, STATUS_OPTIONS, type SortKey, type StatusFilter } from '../../lib/catalog'

/**
 * AURELIA — DiscoveryControls (client) — Этап 12A
 * Shared sort + status toolbar used by the category browser and the search
 * page. Pure presentational: state lives in the parent (and the URL).
 */

interface DiscoveryControlsProps {
  sort: SortKey
  onSortChange: (sort: SortKey) => void
  status: StatusFilter
  onStatusChange: (status: StatusFilter) => void
  countLabel: string
}

export default function DiscoveryControls({
  sort,
  onSortChange,
  status,
  onStatusChange,
  countLabel,
}: DiscoveryControlsProps) {
  return (
    <div className="au-discovery">
      <div className="au-discovery-status" role="group" aria-label="Наличие">
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
          <span>Сортировка:</span>
          <select
            aria-label="Сортировка"
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
  )
}
