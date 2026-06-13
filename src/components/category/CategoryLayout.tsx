import '../../styles/category.css'
import Breadcrumbs, { type Crumb } from '../ui/Breadcrumbs'
import Placeholder from '../ui/Placeholder'
import ProductCard from '../product/ProductCard'
import SeoTextBlock from '../home/SeoTextBlock'
import CategoryFilters from './CategoryFilters'
import CategoryToolbar from './CategoryToolbar'
import Pagination from './Pagination'

/**
 * AURELIA — CategoryLayout (server component)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html
 *
 * Reusable category page shell: breadcrumbs, title + count, filters sidebar,
 * category banner, quick chips, toolbar, two product grids with a mid-grid
 * promo banner, pagination, and an SEO block. Frontend / static only.
 *
 * data-view="customer" selects the storefront state of every placeholder.
 */

interface CategoryProduct {
  category: string
  name?: string
  tag?: string
  tagGold?: boolean
}

interface CategoryLayoutProps {
  breadcrumbs: Crumb[]
  title: string
  count?: string
  chips: { label: string; active?: boolean }[]
  productsTop: CategoryProduct[]
  productsBottom: CategoryProduct[]
  seoTitle: string
  seoParagraphs: string[]
}

function ProductGrid({ products, keyPrefix }: { products: CategoryProduct[]; keyPrefix: string }) {
  return (
    <div className="au-cat-grid">
      {products.map((product, i) => (
        <ProductCard
          key={`${keyPrefix}-${i}`}
          name={product.name ?? 'Украшение AURELIA'}
          category={product.category}
          tag={product.tag}
          tagGold={product.tagGold}
        />
      ))}
    </div>
  )
}

export default function CategoryLayout({
  breadcrumbs,
  title,
  count,
  chips,
  productsTop,
  productsBottom,
  seoTitle,
  seoParagraphs,
}: CategoryLayoutProps) {
  return (
    <div className="au-cat" data-view="customer">
      <div className="au-container">
        <Breadcrumbs items={breadcrumbs} />

        <h1 className="au-page-title">
          {title} {count && <span className="au-page-count">{count}</span>}
        </h1>

        <div className="au-cat-layout">
          <CategoryFilters />

          <div className="au-cat-content">
            {/* Category banner */}
            <div className="au-cat-banner">
              <Placeholder
                variant="banner-wide"
                adminTitle="Добавить баннер категории"
                adminSub="Для пользователей скоро будет добавлен баннер"
                adminHint="Нажмите, чтобы загрузить изображение баннера"
                customerTitle="Скоро здесь появится новая коллекция"
              />
            </div>

            {/* Quick chips */}
            <div className="au-chip-row">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  className={`au-chip${chip.active ? ' is-active' : ''}`}
                  type="button"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            <CategoryToolbar />

            <ProductGrid products={productsTop} keyPrefix="top" />

            {/* Mid-grid promo banner */}
            <div className="au-cat-midbanner">
              <Placeholder
                variant="banner-wide"
                adminTitle="Добавить баннер"
                adminSub="Промо-вставка между рядами товаров"
                customerTitle="Скоро появится подборка недели"
              />
            </div>

            <ProductGrid products={productsBottom} keyPrefix="bottom" />

            <Pagination />
          </div>
        </div>
      </div>

      <SeoTextBlock title={seoTitle} paragraphs={seoParagraphs} />
    </div>
  )
}
