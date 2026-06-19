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

export const metadata: Metadata = {
  title: 'Біжутерія — AURELIA',
  description: 'Сережки, каблучки, браслети, ланцюжки та кулони AURELIA — біжутерія без меж.',
}

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
