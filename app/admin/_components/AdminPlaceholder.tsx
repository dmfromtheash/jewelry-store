/**
 * AURELIA — Admin placeholder section (Этап 20A)
 *
 * Presentational-only scaffold for admin sections that exist in navigation but
 * are not implemented yet. It deliberately shows NO metrics or data — only the
 * intent of the section and what is planned — so the navigation foundation can
 * ship without faking dashboards. Auth is enforced by the calling page (server),
 * not here.
 */

import Link from 'next/link'

export function AdminPlaceholder({
  title,
  lead,
  planned,
  stage,
  actionHref,
  actionLabel,
}: {
  /** Section heading (Russian, matches sidebar label). */
  title: string
  /** One-line description of the section's eventual purpose. */
  lead: string
  /** Capabilities planned for later — described as intent, never as live data. */
  planned: string[]
  /** Roadmap stage that will deliver this section, if known. */
  stage?: string
  /** Optional link to a part of this section that IS already implemented. */
  actionHref?: string
  /** Label for the optional action link (required when actionHref is set). */
  actionLabel?: string
}) {
  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">{title}</h1>
          <span className="au-adm-sub">{lead}</span>
        </div>
        <span className="au-adm-badge au-adm-badge--draft">В планах</span>
      </div>

      <div className="au-adm-card">
        <h2 className="au-adm-card-title">Раздел появится позже</h2>
        <p className="au-adm-note">
          Это заготовка навигации. Функциональность ещё не реализована — здесь
          намеренно нет метрик и данных.
        </p>
        <ul className="au-adm-planned">
          {planned.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        {stage && (
          <p className="au-adm-note">
            Запланировано: этап {stage} (см. docs/backend/ADMIN_SUPERPANEL_ROADMAP.md).
          </p>
        )}
        {actionHref && actionLabel && (
          <p className="au-adm-cta">
            <Link className="au-btn au-btn--primary" href={actionHref}>
              {actionLabel}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}
