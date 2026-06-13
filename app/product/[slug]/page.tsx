/**
 * AURELIA — Dynamic product page (Этап 8A)
 *
 * Statically prerendered per catalog slug — no backend/API/DB. Every product
 * from the mock catalog is enumerated at build time via generateStaticParams;
 * dynamicParams = false makes any unknown slug a 404 (no runtime rendering).
 *
 * Renders the shared ProductPageLayout fed with the real product. The generic
 * /product/coming-soon page stays as the no-product fallback.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProductPageLayout from '../../../src/components/product/ProductPageLayout'
import {
  getAllProductSlugs,
  getProductBySlug,
  getProductsByCategorySlug,
} from '../../../src/lib/catalog'
import type { CategorySlug } from '../../../src/lib/catalog'

export const dynamicParams = false

const CATEGORY_META: Record<CategorySlug, { label: string; href: string }> = {
  bijouterie: { label: 'Бижутерия', href: '/category/bijouterie' },
  gifts: { label: 'Подарки', href: '/category/gifts' },
}

export function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) return {}
  return {
    title: `${product.name} — AURELIA`,
    description: product.description ?? 'Украшение AURELIA — бижутерия без границ.',
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const product = getProductBySlug(slug)
  if (!product) notFound()

  const category = CATEGORY_META[product.categorySlug]
  const similar = getProductsByCategorySlug(product.categorySlug)
    .filter((item) => item.slug !== product.slug)
    .slice(0, 4)
    .map((item) => item.category)

  return (
    <ProductPageLayout
      breadcrumbs={[
        { label: 'Главная', href: '/' },
        { label: category.label, href: category.href },
        { label: product.name },
      ]}
      similar={similar}
      product={product}
    />
  )
}
