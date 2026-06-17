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

export const metadata: Metadata = {
  title: 'Подарки — AURELIA',
  description: 'Готовые подарочные решения AURELIA: наборы украшений, парные браслеты и сертификаты.',
}

const CHIPS = [
  { label: 'Все подарки', active: true },
  { label: 'До 1 000 ₴' },
  { label: 'До 3 000 ₴' },
  { label: 'Наборы' },
  { label: 'Сертификаты' },
]

const SEO_PARAGRAPHS = [
  'Украшение — подарок, который не нужно объяснять. В разделе «Подарки» мы собираем готовые решения на любой повод: наборы серег и кулонов, парные браслеты, лаконичные кольца и подарочные сертификаты, если хочется оставить выбор за получателем.',
  'Каждый заказ упаковывается в фирменную коробку AURELIA с лентой и открыткой — подарок можно вручать сразу. Если украшение не подойдёт, его можно обменять или вернуть в течение 30 дней.',
  'Не знаете, с чего начать? Отфильтруйте подборку по поводу, бюджету или получателю — а консультанты в чате помогут выбрать размер и покрытие.',
]

export default async function GiftsCategoryPage() {
  const PRODUCTS = await getProductsByCategorySlugFromDb('gifts')

  return (
    <>
      <TrackView event={ANALYTICS_EVENTS.categoryView} payload={{ categorySlug: 'gifts' }} />
      <CategoryLayout
        breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Подарки' }]}
        title="Подарки"
        chips={CHIPS}
        products={PRODUCTS}
        seoTitle="Подарки от AURELIA"
        seoParagraphs={SEO_PARAGRAPHS}
      />
    </>
  )
}
