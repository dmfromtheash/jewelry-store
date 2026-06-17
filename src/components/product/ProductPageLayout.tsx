import '../../styles/product-page.css'
import Link from 'next/link'
import Breadcrumbs, { type Crumb } from '../ui/Breadcrumbs'
import ProductCard from './ProductCard'
import ProductGallery from './ProductGallery'
import ProductInfo from './ProductInfo'
import ProductTabs from './ProductTabs'
import ReviewsEmpty from './ReviewsEmpty'
import RecentlyViewed from './RecentlyViewed'
import type { Product } from '../../lib/catalog'

/**
 * AURELIA — ProductPageLayout (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Frontend / static product page shell: breadcrumbs, gallery + info,
 * tabs, empty reviews, and a "Похожие товары" grid of card placeholders.
 *
 * data-view="customer" selects the storefront state of every placeholder.
 */

interface ProductPageLayoutProps {
  breadcrumbs: Crumb[]
  similar: string[]
  /** real product → drives info/tabs; absent → generic coming-soon fallback */
  product?: Product
}

export default function ProductPageLayout({ breadcrumbs, similar, product }: ProductPageLayoutProps) {
  return (
    <div className="au-product-page" data-view="customer">
      <div className="au-container">
        <Breadcrumbs items={breadcrumbs} />

        <div className="au-product">
          <ProductGallery images={product?.images} />
          <ProductInfo product={product} />
        </div>

        <ProductTabs description={product?.description} specs={product?.specs} />

        {/* Reviews */}
        <section className="au-section">
          <div className="au-section-head">
            <h2 className="au-section-title">Отзывы</h2>
          </div>
          <ReviewsEmpty />
        </section>

        {/* Similar products */}
        <section className="au-section">
          <div className="au-section-head">
            <h2 className="au-section-title">Похожие товары</h2>
            <Link className="au-section-link" href="/category/bijouterie">
              Смотреть все
            </Link>
          </div>
          <div className="au-grid">
            {similar.map((category, i) => (
              <ProductCard key={`similar-${i}`} name="Украшение AURELIA" category={category} />
            ))}
          </div>
        </section>

        {/* Recently viewed (client, from localStorage) */}
        {product && <RecentlyViewed currentSlug={product.slug} />}
      </div>
    </div>
  )
}
