/**
 * AURELIA — Home Page (Этап 3A)
 * Source: docs/design/aurelia-prototype/02 Home Page.html
 *
 * Frontend / static UI only: hero banner placeholder, category circles,
 * "Новинки" and "Бестселлеры" card grids (empty-state placeholders),
 * two promo banner placeholders, and the benefits strip.
 *
 * data-view="customer" selects the storefront (customer) state of every
 * placeholder via CSS. The admin ("Добавить ...") state lives in the same
 * markup and is revealed later when the admin view is wired up.
 */

import '../src/styles/home.css'
import '../src/styles/card.css'
import Placeholder from '../src/components/ui/Placeholder'
import ProductCard from '../src/components/product/ProductCard'
import CategoryCircles from '../src/components/home/CategoryCircles'
import Benefits from '../src/components/home/Benefits'

const NEW_ARRIVALS = [
  { name: 'Украшение AURELIA', category: 'Серьги · позолота', tag: 'New', tagGold: true },
  { name: 'Украшение AURELIA', category: 'Кольцо · серебрение', tag: 'New', tagGold: true },
  { name: 'Украшение AURELIA', category: 'Браслет · позолота' },
  { name: 'Украшение AURELIA', category: 'Цепочка · родирование' },
]

const BESTSELLERS = [
  { name: 'Украшение AURELIA', category: 'Кулон · позолота', tag: 'Хит' },
  { name: 'Украшение AURELIA', category: 'Набор · позолота', tag: 'Хит' },
  { name: 'Украшение AURELIA', category: 'Серьги · жемчуг' },
  { name: 'Украшение AURELIA', category: 'Аксессуар · эмаль' },
]

export default function HomePage() {
  return (
    <div className="au-home" data-view="customer">
      {/* ===== Hero banner ===== */}
      <section className="au-section au-section--hero">
        <div className="au-container">
          <Placeholder
            variant="hero"
            adminTitle="Добавить главный баннер"
            adminSub="Для пользователей: скоро появится главный баннер"
            adminHint="Нажмите, чтобы загрузить обложку баннера"
            customerTitle="Скоро появится главный баннер"
            customerSub="Мы готовим для вас новую коллекцию"
            withRule
            showImageIcon
          />
        </div>
      </section>

      {/* ===== Category circles ===== */}
      <section className="au-section au-section--cats">
        <div className="au-container">
          <CategoryCircles />
        </div>
      </section>

      {/* ===== Новинки ===== */}
      <section className="au-section">
        <div className="au-container">
          <div className="au-section-head">
            <h2 className="au-section-title">Новинки</h2>
            <a className="au-section-link" href="#">Смотреть все</a>
          </div>
          <div className="au-grid">
            {NEW_ARRIVALS.map((product, i) => (
              <ProductCard key={`new-${i}`} {...product} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Promo banners ===== */}
      <section className="au-section">
        <div className="au-container au-home-banners">
          <Placeholder
            variant="banner"
            adminTitle="Добавить баннер"
            adminSub="Для пользователей скоро будет добавлен баннер"
            adminHint="Нажмите, чтобы загрузить изображение баннера"
            customerTitle="Скоро появится новая акция"
          />
          <Placeholder
            variant="banner"
            adminTitle="Добавить баннер"
            adminSub="Для пользователей скоро будет добавлен баннер"
            adminHint="Нажмите, чтобы загрузить изображение баннера"
            customerTitle="Скоро появится подборка недели"
          />
        </div>
      </section>

      {/* ===== Бестселлеры ===== */}
      <section className="au-section">
        <div className="au-container">
          <div className="au-section-head">
            <h2 className="au-section-title">Бестселлеры</h2>
            <a className="au-section-link" href="#">Смотреть все</a>
          </div>
          <div className="au-grid">
            {BESTSELLERS.map((product, i) => (
              <ProductCard key={`best-${i}`} {...product} />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Benefits ===== */}
      <Benefits />
    </div>
  )
}
