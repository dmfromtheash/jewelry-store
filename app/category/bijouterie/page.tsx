/**
 * AURELIA — Category: Бижутерия (Этап 4A)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html
 * Frontend / static UI only — reuses CategoryLayout.
 */

import type { Metadata } from 'next'
import CategoryLayout from '../../../src/components/category/CategoryLayout'
import TrackView from '../../../src/components/analytics/TrackView'
import { ANALYTICS_EVENTS } from '../../../src/lib/analytics/events'
import { getProductsByCategorySlugFromDb } from '../../../src/lib/catalog/server'
import { buildBreadcrumbJsonLd, serializeJsonLd } from '../../../src/lib/seo/site'

const DESCRIPTION =
  'Сережки, каблучки, браслети, ланцюжки та кулони AURELIA — біжутерія без меж.'

export const metadata: Metadata = {
  title: 'Біжутерія — AURELIA',
  description: DESCRIPTION,
  alternates: { canonical: '/category/bijouterie' },
  openGraph: {
    type: 'website',
    title: 'Біжутерія — AURELIA',
    description: DESCRIPTION,
    url: '/category/bijouterie',
  },
  twitter: { card: 'summary', title: 'Біжутерія — AURELIA', description: DESCRIPTION },
}

// BreadcrumbList structured data (Этап 72A) — mirrors the visible breadcrumbs below.
const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { label: 'Головна', href: '/' },
  { label: 'Біжутерія', href: '/category/bijouterie' },
])

const CHIPS = [
  { label: 'Усі прикраси', active: true },
  { label: 'Сережки' },
  { label: 'Каблучки' },
  { label: 'Браслети' },
  { label: 'Новинки' },
]

const SEO_PARAGRAPHS = [
  'Біжутерія — це свобода: змінювати образи, пробувати нове й не ставитися до прикрас надто серйозно. У каталозі AURELIA зібрані сережки, каблучки, браслети, ланцюжки та кулони на щодень і для особливих випадків.',
  'Ми працюємо з покриттями з позолоти та родію, гіпоалергенною сталлю, штучними перлами, фіанітами та емаллю. Базові форми легко поєднуються між собою — збирайте власні комбінації та багатошарові образи.',
  'Усі прикраси приїжджають у фірмовому пакуванні, а якщо щось не підійде — обміняємо або повернемо гроші протягом 30 днів.',
]

export default async function BijouterieCategoryPage() {
  const PRODUCTS = await getProductsByCategorySlugFromDb('bijouterie')

  return (
    <>
      {BREADCRUMB_JSON_LD && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeJsonLd(BREADCRUMB_JSON_LD) }}
        />
      )}
      <TrackView event={ANALYTICS_EVENTS.categoryView} payload={{ categorySlug: 'bijouterie' }} />
      <CategoryLayout
        breadcrumbs={[{ label: 'Головна', href: '/' }, { label: 'Біжутерія' }]}
        title="Біжутерія"
        chips={CHIPS}
        products={PRODUCTS}
        seoTitle="Біжутерія AURELIA"
        seoParagraphs={SEO_PARAGRAPHS}
      />
    </>
  )
}
