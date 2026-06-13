import { Suspense } from 'react'
import '../../styles/category.css'
import Breadcrumbs, { type Crumb } from '../ui/Breadcrumbs'
import Placeholder from '../ui/Placeholder'
import SeoTextBlock from '../home/SeoTextBlock'
import CategoryFilters from './CategoryFilters'
import CategoryBrowser from './CategoryBrowser'
import type { Product } from '../../lib/catalog'

/**
 * AURELIA — CategoryLayout (server component)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html
 *
 * Reusable category page shell: breadcrumbs, title, filters sidebar, category
 * banner, quick chips, and the interactive product browser (sort/filter + grid,
 * Этап 12A). Frontend / static only.
 *
 * data-view="customer" selects the storefront state of every placeholder.
 */

interface CategoryLayoutProps {
  breadcrumbs: Crumb[]
  title: string
  chips: { label: string; active?: boolean }[]
  products: Product[]
  seoTitle: string
  seoParagraphs: string[]
}

export default function CategoryLayout({
  breadcrumbs,
  title,
  chips,
  products,
  seoTitle,
  seoParagraphs,
}: CategoryLayoutProps) {
  return (
    <div className="au-cat" data-view="customer">
      <div className="au-container">
        <Breadcrumbs items={breadcrumbs} />

        <h1 className="au-page-title">{title}</h1>

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

            {/* Quick chips (decorative quick links) */}
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

            {/* Interactive browser (sort / status filter + grid) */}
            <Suspense fallback={<div className="au-cat-browser" />}>
              <CategoryBrowser products={products} />
            </Suspense>
          </div>
        </div>
      </div>

      <SeoTextBlock title={seoTitle} paragraphs={seoParagraphs} />
    </div>
  )
}
