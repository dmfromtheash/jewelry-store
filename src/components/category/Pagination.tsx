/**
 * AURELIA — Pagination (server component)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html (.au-pagination)
 *
 * Static pagination placeholder — buttons are visual only (no routing yet).
 */

const Arrow = ({ dir }: { dir: 'prev' | 'next' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    {dir === 'prev' ? <path d="M15 6l-6 6 6 6" /> : <path d="M9 6l6 6-6 6" />}
  </svg>
)

export default function Pagination() {
  return (
    <nav className="au-pagination" aria-label="Страницы">
      <button className="au-page-btn" type="button" aria-label="Назад">
        <Arrow dir="prev" />
      </button>
      <button className="au-page-btn is-active" type="button">1</button>
      <button className="au-page-btn" type="button">2</button>
      <button className="au-page-btn" type="button">3</button>
      <button className="au-page-btn dots" type="button">…</button>
      <button className="au-page-btn" type="button">12</button>
      <button className="au-page-btn" type="button" aria-label="Вперёд">
        <Arrow dir="next" />
      </button>
    </nav>
  )
}
