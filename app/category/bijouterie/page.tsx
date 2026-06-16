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
  title: 'Бижутерия — AURELIA',
  description: 'Серьги, кольца, браслеты, цепочки и кулоны AURELIA — бижутерия без границ.',  
}

const CHIPS = [
  { label: 'Все украшения', active: true },
  { label: 'Серьги' },
  { label: 'Кольца' },
  { label: 'Браслеты' },
  { label: 'Новинки' },
]

const SEO_PARAGRAPHS = [
  'Бижутерия — это свобода: менять образы, пробовать новое и не относиться к украшениям слишком серьёзно. В каталоге AURELIA собраны серьги, кольца, браслеты, цепочки и кулоны на каждый день и для особенных случаев.',
  'Мы работаем с покрытиями из позолоты и родия, гипоаллергенной сталью, искусственным жемчугом, фианитами и эмалью. Базовые формы легко сочетаются между собой — собирайте свои комбинации и многослойные образы.',
  'Все украшения приезжают в фирменной упаковке, а если что-то не подойдёт — обменяем или вернём деньги в течение 30 дней.',
]

export default async function BijouterieCategoryPage() {
  const PRODUCTS = await getProductsByCategorySlugFromDb('bijouterie')

  return (
    <>
      <TrackView event={ANALYTICS_EVENTS.categoryView} payload={{ categorySlug: 'bijouterie' }} />
      <CategoryLayout
        breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Бижутерия' }]}
        title="Бижутерия"
        chips={CHIPS}
        products={PRODUCTS}
        seoTitle="Бижутерия AURELIA"
        seoParagraphs={SEO_PARAGRAPHS}
      />
    </>
  )
}
