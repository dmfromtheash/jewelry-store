/**
 * AURELIA — ProductCard (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-card)
 *
 * An empty product card placeholder. Like Placeholder, it carries both
 * the admin ("Добавить товар") and customer ("Скоро будет добавлен товар")
 * states; CSS [data-view] decides which shows. Storefront = customer.
 *
 * Hover actions (Купить / в избранное / быстрый просмотр) are structured
 * and styled (slide into a reserved slot BELOW the body so the media is
 * never covered; always visible on mobile). They are visual only for now —
 * links point to "#" because product/cart routes do not exist yet.
 */

interface ProductCardProps {
  name: string
  category: string
  tag?: string
  /** gold tag variant (e.g. "New"); otherwise dark (e.g. "Хит") */
  tagGold?: boolean
}

const GemIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default function ProductCard({ name, category, tag, tagGold = false }: ProductCardProps) {
  return (
    <article className="au-card">
      {tag && (
        <span className={`au-card-tag${tagGold ? ' au-card-tag--gold' : ''}`}>{tag}</span>
      )}

      <div className="au-card-media">
        <span className="dash only-admin" />
        <div className="only-admin">
          <span className="au-ph-plus">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          <span className="t">Добавить товар</span>
          <span className="s">Нажмите, чтобы загрузить изображение</span>
        </div>
        <div className="only-customer">
          <span className="au-ph-gem">
            <GemIcon />
          </span>
          <span className="t-cust">Скоро будет добавлен товар</span>
        </div>
      </div>

      <div className="au-card-body">
        <h3 className="au-card-name">{name}</h3>
        <p className="au-card-cat">{category}</p>
        <div className="au-card-meta">
          <span className="au-stars" aria-hidden="true">★★★★★</span>
          <span className="au-card-reviews">0 отзывов</span>
        </div>
        <div className="au-card-price">
          <span className="dim">— ₽</span>
        </div>

        {/* reserved slot keeps layout from jumping when actions appear */}
        <div className="au-card-actions-slot" />
        <div className="au-card-actions">
          <a className="au-btn au-btn--primary buy" href="#">Купить</a>
          <button className="au-act-ico" type="button" aria-label="В избранное">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 6.9 4.5c2 0 3.6 1.1 5.1 3 1.5-1.9 3.1-3 5.1-3 3.3 0 5.4 3.1 4.2 6.3C19.5 15.4 12 20 12 20z" />
            </svg>
          </button>
          <a className="au-act-ico" href="#" aria-label="Быстрый просмотр">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
              <circle cx="12" cy="12" r="2.8" />
            </svg>
          </a>
        </div>
      </div>
    </article>
  )
}
