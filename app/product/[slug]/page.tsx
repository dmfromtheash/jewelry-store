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
import {
  getApprovedReviewsBySlug,
  getReviewSummaryBySlug,
} from '../../../src/lib/reviews/server'
import { getPublishedQuestionsBySlug } from '../../../src/lib/product-qa/server'
import { getCurrentCustomer } from '../../../src/lib/customer/session'
import { buildProductMetaParts, buildProductJsonLd } from '../../../src/lib/seo/product-seo'
import { buildBreadcrumbJsonLd, productOgImages, serializeJsonLd } from '../../../src/lib/seo/site'
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
  // SEO/meta (Этап 62A; OG/Twitter foundation Этап 72A): title + description + canonical +
  // Open Graph + Twitter card. Open Graph images use a REAL product asset only — when a product
  // has only a placeholder we emit NO image (productOgImages returns []), never a fake photo.
  const { title, description, canonical } = buildProductMetaParts(product)
  const ogImages = productOgImages(product)
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonical,
      siteName: 'AURELIA',
      ...(ogImages.length ? { images: ogImages.map((url) => ({ url })) } : {}),
    },
    twitter: {
      card: ogImages.length ? 'summary_large_image' : 'summary',
      title,
      description,
      ...(ogImages.length ? { images: ogImages } : {}),
    },
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

  // Moderated reviews (Этап 59A): approved-only list + aggregate; prefill the review
  // form name for a logged-in customer. A lookup failure must never break the PDP.
  // Product Q&A (Этап 79A): published+answered questions only. Failure-isolated — a Q&A
  // lookup error must never break the PDP (falls back to an empty list / empty state).
  const [reviews, reviewSummary, customer, questions] = await Promise.all([
    getApprovedReviewsBySlug(product.slug),
    getReviewSummaryBySlug(product.slug),
    getCurrentCustomer().catch(() => null),
    getPublishedQuestionsBySlug(product.slug).catch(() => []),
  ])

  // Product structured data (Этап 62A). aggregateRating is included only when there is
  // ≥1 approved review (see buildProductJsonLd) — never a fabricated rating.
  const jsonLd = buildProductJsonLd(product, reviewSummary)

  // Breadcrumb trail shared by the visible breadcrumbs AND BreadcrumbList JSON-LD (Этап 72A).
  const breadcrumbs = [
    { label: 'Головна', href: '/' },
    { label: category.label, href: category.href },
    { label: product.name },
  ]
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbs)

  return (
    <>
      <script
        type="application/ld+json"
        // serializeJsonLd escapes `<` (Этап 76A) — safe inline ld+json even though review text
        // never enters here and product fields are admin-controlled (defence in depth).
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {breadcrumbJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbJsonLd) }}
        />
      )}
      <TrackView event={ANALYTICS_EVENTS.productView} payload={{ productSlug: product.slug }} />
      <ProductPageLayout
        breadcrumbs={breadcrumbs}
        similar={similar}
        product={product}
        reviews={reviews}
        reviewSummary={reviewSummary}
        reviewAuthorName={customer?.name ?? null}
        questions={questions}
      />
    </>
  )
}
