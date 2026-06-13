/**
 * AURELIA — CategoryFilters (server component)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html (.au-filters)
 *
 * Sidebar filters: price range + checkbox groups. Uses native inputs only,
 * so the checked state works without any client JS. The "Применить фильтры"
 * button is a non-functional placeholder (no backend filtering yet).
 *
 * On desktop this is the left column. On tablet/mobile the category layout
 * stacks it below the products (see category.css), and the toolbar's
 * "Фильтры" link jumps here via #filters — accessible with no JS.
 */

const FILTER_GROUPS: { heading: string; options: string[] }[] = [
  { heading: 'Категория', options: ['Серьги', 'Кольца', 'Браслеты', 'Цепочки', 'Кулоны'] },
  { heading: 'Стиль', options: ['Минимализм', 'Классика', 'Акцентные'] },
  { heading: 'Вставка', options: ['Жемчуг', 'Фианит', 'Эмаль', 'Без вставки'] },
  { heading: 'Покрытие', options: ['Позолота', 'Родирование', 'Сталь'] },
]

const Chevron = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M6 9l6 6 6-6" />
  </svg>
)

const Check = () => (
  <span className="box">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
      <path d="M4 12l5 5L20 7" />
    </svg>
  </span>
)

export default function CategoryFilters() {
  return (
    <aside className="au-filters" id="filters" aria-label="Фильтры">
      {/* Price */}
      <div className="au-filter-group">
        <div className="au-filter-head">
          Цена, ₽ <Chevron />
        </div>
        <div className="au-filter-body">
          <div className="au-price-inputs">
            <input type="text" placeholder="от 0" aria-label="Цена от" />
            <span className="dash">—</span>
            <input type="text" placeholder="до 10 000" aria-label="Цена до" />
          </div>
        </div>
      </div>

      {/* Checkbox groups */}
      {FILTER_GROUPS.map((group) => (
        <div className="au-filter-group" key={group.heading}>
          <div className="au-filter-head">
            {group.heading} <Chevron />
          </div>
          <div className="au-filter-body">
            {group.options.map((option) => (
              <label className="au-check" key={option}>
                <input type="checkbox" />
                <Check />
                {option}
                <span className="n">0</span>
              </label>
            ))}
          </div>
        </div>
      ))}

      <button className="au-btn au-btn--ghost au-filter-apply" type="button">
        Применить фильтры
      </button>
    </aside>
  )
}
