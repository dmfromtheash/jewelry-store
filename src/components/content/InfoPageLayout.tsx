import '../../styles/content.css'
import Breadcrumbs from '../ui/Breadcrumbs'
import type { InfoPage, InfoSection } from '../../data/info-pages'

/**
 * AURELIA — InfoPageLayout (server component) — Этап 13A
 *
 * Reusable shell for commercial info pages (delivery, returns, stores, help,
 * about, contacts). Renders breadcrumbs, a serif title, an optional intro and
 * pre-launch notice, and a list of content sections (paragraphs / bullet lists
 * / FAQ). Static, frontend-only — content comes from src/data/info-pages.ts.
 */

const InfoIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.2" />
  </svg>
)

function Section({ section }: { section: InfoSection }) {
  return (
    <section className="au-info-section">
      {section.heading && <h2 className="au-info-section-title">{section.heading}</h2>}

      {section.paragraphs?.map((p, i) => (
        <p className="au-info-p" key={`p-${i}`}>
          {p}
        </p>
      ))}

      {section.bullets && (
        <ul className="au-info-list">
          {section.bullets.map((b, i) => (
            <li key={`b-${i}`}>{b}</li>
          ))}
        </ul>
      )}

      {section.faq && (
        <div className="au-info-faq">
          {section.faq.map((item, i) => (
            <div className="au-info-faq-item" key={`f-${i}`}>
              <p className="au-info-faq-q">{item.q}</p>
              <p className="au-info-faq-a">{item.a}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default function InfoPageLayout({ page }: { page: InfoPage }) {
  return (
    <div className="au-info-page">
      <div className="au-container au-info-inner">
        <Breadcrumbs items={[{ label: 'Головна', href: '/' }, { label: page.title }]} />

        <h1 className="au-info-title">{page.title}</h1>
        {page.intro && <p className="au-info-intro">{page.intro}</p>}

        {page.notice && (
          <div className="au-info-notice">
            <span className="au-info-notice-ico" aria-hidden="true">
              <InfoIcon />
            </span>
            <span>{page.notice}</span>
          </div>
        )}

        <div className="au-info-sections">
          {page.sections.map((section, i) => (
            <Section section={section} key={`s-${i}`} />
          ))}
        </div>
      </div>
    </div>
  )
}
