/**
 * AURELIA — CategoryToolbar (server component)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html (.au-toolbar)
 *
 * Sort control + a mobile-only "Фильтры" link. The link is an anchor to
 * #filters (the sidebar), so on small screens it jumps to the stacked
 * filters with no client JS. The <select> is a visual placeholder — no
 * client sorting is wired up yet.
 */

export default function CategoryToolbar() {
  return (
    <div className="au-toolbar">
      <div className="au-sort">
        <span>Сортировка:</span>
        <select aria-label="Сортировка" defaultValue="По популярности">
          <option>По популярности</option>
          <option>Сначала новинки</option>
          <option>Сначала дешевле</option>
          <option>Сначала дороже</option>
        </select>
      </div>
      <a className="au-btn au-btn--ghost au-filters-jump" href="#filters">
        Фильтры
      </a>
    </div>
  )
}
