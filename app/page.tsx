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

import type { Metadata } from 'next'
import '../src/styles/home.css'
import Link from 'next/link'
import Placeholder from '../src/components/ui/Placeholder'
import ProductCard from '../src/components/product/ProductCard'
import CategoryCircles from '../src/components/home/CategoryCircles'
import PromoBlocks from '../src/components/home/PromoBlocks'
import Benefits from '../src/components/home/Benefits'
import SeoTextBlock from '../src/components/home/SeoTextBlock'
import { getAllProductsFromDb } from '../src/lib/catalog/server'

const HOME_TITLE = 'AURELIA — біжутерія, прикраси та аксесуари'
const HOME_DESCRIPTION =
  'Інтернет-магазин біжутерії AURELIA: сережки, каблучки, браслети, ланцюжки та подарунки. Біжутерія без меж.'

// Home metadata (Этап 72A): canonical root + Open Graph / Twitter card. Site-wide Organization
// and WebSite structured data live in the root layout; no fabricated imagery is referenced.
export const metadata: Metadata = {
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: '/',
    siteName: 'AURELIA',
  },
  twitter: { card: 'summary', title: HOME_TITLE, description: HOME_DESCRIPTION },
}

export default async function HomePage() {
  // Home rows are drawn from the DB-backed catalog so their cards link to the
  // real /product/[slug] pages.
  const ALL_PRODUCTS = await getAllProductsFromDb()
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
            customerTitle="Незабаром зʼявиться головний банер"
            customerSub="Ми готуємо для вас нову колекцію"
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
            <Link className="au-section-link" href="/category/bijouterie">Дивитися все</Link>
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
                imageUrl={product.imageUrl}
                imageAlt={product.name}
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
            customerTitle="Незабаром зʼявиться нова акція"
          />
          <Placeholder
            variant="banner"
            adminTitle="Добавить баннер"
            adminSub="Для пользователей скоро будет добавлен баннер"
            adminHint="Нажмите, чтобы загрузить изображение баннера"
            customerTitle="Незабаром зʼявиться добірка тижня"
          />
        </div>
      </section>

      {/* ===== Бестселлеры ===== */}
      <section className="au-section">
        <div className="au-container">
          <div className="au-section-head">
            <h2 className="au-section-title">Бестселери</h2>
            <Link className="au-section-link" href="/category/bijouterie">Дивитися все</Link>
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
                imageUrl={product.imageUrl}
                imageAlt={product.name}
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
