/**
 * AURELIA — Dynamic product page (Этап 8A; runtime routes Этап 26J)
 *
 * DB-backed PDP. Known catalog slugs are prerendered at build time via
 * generateStaticParams; dynamicParams = true additionally renders any *new*
 * DB slug on-demand at runtime — so a product created through the admin opens
 * by /product/[slug] without a rebuild. A slug with no matching product still
 * yields notFound() (getProductBySlugFromDb returns null).
 *
 * Renders the shared ProductPageLayout fed with the real product. The generic
 * /product/coming-soon page stays as the no-product fallback.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductPageLayout from '../../../src/components/product/ProductPageLayout'
import TrackView from '../../../src/components/analytics/TrackView'
import { ANALYTICS_EVENTS } from '../../../src/lib/analytics/events'
import {
  getAllProductSlugsFromDb,
  getProductBySlugFromDb,
  getProductsByCategorySlugFromDb,
} from '../../../src/lib/catalog/server'
import type { CategorySlug } from '../../../src/lib/catalog'

export const dynamicParams = true

const CATEGORY_META: Record<CategorySlug, { label: string; href: string }> = {
  bijouterie: { label: 'Біжутерія', href: '/category/bijouterie' },
  gifts: { label: 'Подарунки', href: '/category/gifts' },
}

export async function generateStaticParams() {
  const slugs = await getAllProductSlugsFromDb()
  return slugs.map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = await getProductBySlugFromDb(slug)
  if (!product) return {}
  return {
    title: `${product.name} — AURELIA`,
    description: product.description ?? 'Прикраса AURELIA — біжутерія без меж.',
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = await getProductBySlugFromDb(slug)
  if (!product) notFound()

  const category = CATEGORY_META[product.categorySlug]
  const similar = (await getProductsByCategorySlugFromDb(product.categorySlug))
    .filter((item) => item.slug !== product.slug)
    .slice(0, 4)
    .map((item) => item.category)

  return (
    <>
      <TrackView event={ANALYTICS_EVENTS.productView} payload={{ productSlug: product.slug }} />
      <ProductPageLayout
        breadcrumbs={[
          { label: 'Головна', href: '/' },
          { label: category.label, href: category.href },
          { label: product.name },
        ]}
        similar={similar}
        product={product}
      />
    </>
  )
}
