/**
 * AURELIA — Admin placeholder section (Этап 20A)
 *
 * Presentational-only scaffold for admin sections that exist in navigation but
 * are not implemented yet. It deliberately shows NO metrics or data — only the
 * intent of the section and what is planned — so the navigation foundation can
 * ship without faking dashboards. Auth is enforced by the calling page (server),
 * not here.
 */

export function AdminPlaceholder({
  title,
  lead,
  planned,
  stage,
}: {
  /** Section heading (Russian, matches sidebar label). */
  title: string
  /** One-line description of the section's eventual purpose. */
  lead: string
  /** Capabilities planned for later — described as intent, never as live data. */
  planned: string[]
  /** Roadmap stage that will deliver this section, if known. */
  stage?: string
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
      </div>
    </div>
  )
}
