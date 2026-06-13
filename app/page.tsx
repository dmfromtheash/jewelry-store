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
import Link from 'next/link'
import Placeholder from '../src/components/ui/Placeholder'
import ProductCard from '../src/components/product/ProductCard'
import CategoryCircles from '../src/components/home/CategoryCircles'
import PromoBlocks from '../src/components/home/PromoBlocks'
import Benefits from '../src/components/home/Benefits'
import SeoTextBlock from '../src/components/home/SeoTextBlock'
import { getAllProducts } from '../src/lib/catalog'

export default function HomePage() {
  // Home rows are drawn from the shared mock catalog so their cards link to the
  // real /product/[slug] pages (no backend — just slices of the static data).
  const ALL_PRODUCTS = getAllProducts()
  const NEW_ARRIVALS = ALL_PRODUCTS.slice(0, 4)
  const BESTSELLERS = ALL_PRODUCTS.slice(4, 8)

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
            <Link className="au-section-link" href="/category/bijouterie">Смотреть все</Link>
          </div>
          <div className="au-grid">
            {NEW_ARRIVALS.map((product) => (
              <ProductCard
                key={product.slug}
                name={product.name}
                category={product.category}
                slug={product.slug}
                status={product.status}
                price={product.price}
                tag={product.tag}
                tagGold={product.tagGold}
              />
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
            <Link className="au-section-link" href="/category/bijouterie">Смотреть все</Link>
          </div>
          <div className="au-grid">
            {BESTSELLERS.map((product) => (
              <ProductCard
                key={product.slug}
                name={product.name}
                category={product.category}
                slug={product.slug}
                status={product.status}
                price={product.price}
                tag={product.tag}
                tagGold={product.tagGold}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ===== Специальные подборки (промо-квадраты) ===== */}
      <PromoBlocks />

      {/* ===== Benefits ===== */}
      <Benefits />

      {/* ===== SEO / информационный блок ===== */}
      <SeoTextBlock />
    </div>
  )
}
