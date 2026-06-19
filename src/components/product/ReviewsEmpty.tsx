/**
 * AURELIA — ReviewsEmpty (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html (.au-reviews-empty)
 * Empty state for reviews. The "Подписаться на новинки" button is visual only.
 */

export default function ReviewsEmpty() {
  return (
    <div className="au-reviews-empty">
      <svg
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        className="au-reviews-empty-ico"
        aria-hidden="true"
      >
        <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L3 20l1-5.4a8.5 8.5 0 1 1 17-3.1z" />
      </svg>
      <p className="h">Відгуків поки немає</p>
      <p className="p">
        Коли прикраса зʼявиться в продажу, тут будуть відгуки покупців із фото та оцінками.
      </p>
      <button className="au-btn au-btn--ghost" type="button">
        Підписатися на новинки
      </button>
    </div>
  )
}
