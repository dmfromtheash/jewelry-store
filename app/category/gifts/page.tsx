/**
 * AURELIA — Category: Подарки (Этап 4A)
 * Source: docs/design/aurelia-prototype/03 Category Gifts.html
 * Frontend / static UI only — reuses CategoryLayout.
 */

import type { Metadata } from 'next'
import CategoryLayout from '../../../src/components/category/CategoryLayout'
import TrackView from '../../../src/components/analytics/TrackView'
import { ANALYTICS_EVENTS } from '../../../src/lib/analytics/events'
import { getProductsByCategorySlugFromDb } from '../../../src/lib/catalog/server'
import { buildBreadcrumbJsonLd } from '../../../src/lib/seo/site'

const DESCRIPTION =
  'Готові подарункові рішення AURELIA: набори прикрас, парні браслети та сертифікати.'

export const metadata: Metadata = {
  title: 'Подарунки — AURELIA',
  description: DESCRIPTION,
  alternates: { canonical: '/category/gifts' },
  openGraph: {
    type: 'website',
    title: 'Подарунки — AURELIA',
    description: DESCRIPTION,
    url: '/category/gifts',
  },
  twitter: { card: 'summary', title: 'Подарунки — AURELIA', description: DESCRIPTION },
}

// BreadcrumbList structured data (Этап 72A) — mirrors the visible breadcrumbs below.
const BREADCRUMB_JSON_LD = buildBreadcrumbJsonLd([
  { label: 'Головна', href: '/' },
  { label: 'Подарунки', href: '/category/gifts' },
])

const CHIPS = [
  { label: 'Усі подарунки', active: true },
  { label: 'До 1 000 ₴' },
  { label: 'До 3 000 ₴' },
  { label: 'Набори' },
  { label: 'Сертифікати' },
]

const SEO_PARAGRAPHS = [
  'Прикраса — подарунок, який не треба пояснювати. У розділі «Подарунки» ми збираємо готові рішення на будь-яку нагоду: набори сережок і кулонів, парні браслети, лаконічні каблучки та подарункові сертифікати, якщо хочеться залишити вибір за отримувачем.',
  'Кожне замовлення пакується у фірмову коробку AURELIA зі стрічкою та листівкою — подарунок можна вручати одразу. Якщо прикраса не підійде, її можна обміняти або повернути протягом 30 днів.',
  'Не знаєте, з чого почати? Відфільтруйте добірку за нагодою, бюджетом або отримувачем — а консультанти в чаті допоможуть обрати розмір і покриття.',
]

export default async function GiftsCategoryPage() {
  const PRODUCTS = await getProductsByCategorySlugFromDb('gifts')

  return (
    <>
      {BREADCRUMB_JSON_LD && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(BREADCRUMB_JSON_LD) }}
        />
      )}
      <TrackView event={ANALYTICS_EVENTS.categoryView} payload={{ categorySlug: 'gifts' }} />
      <CategoryLayout
        breadcrumbs={[{ label: 'Головна', href: '/' }, { label: 'Подарунки' }]}
        title="Подарунки"
        chips={CHIPS}
        products={PRODUCTS}
        seoTitle="Подарунки від AURELIA"
        seoParagraphs={SEO_PARAGRAPHS}
      />
    </>
  )
}
