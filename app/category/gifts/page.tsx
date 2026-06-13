/**
 * AURELIA — Category: Подарки (Этап 4A)
 * Source: docs/design/aurelia-prototype/03 Category Gifts.html
 * Frontend / static UI only — reuses CategoryLayout.
 */

import type { Metadata } from 'next'
import CategoryLayout from '../../../src/components/category/CategoryLayout'

export const metadata: Metadata = {
  title: 'Подарки — AURELIA',
  description: 'Готовые подарочные решения AURELIA: наборы украшений, парные браслеты и сертификаты.',
}

const CHIPS = [
  { label: 'Все подарки', active: true },
  { label: 'До 1 000 ₽' },
  { label: 'До 3 000 ₽' },
  { label: 'Наборы' },
  { label: 'Сертификаты' },
]

const PRODUCTS_TOP = [
  { category: 'Набор серьги + кулон' },
  { category: 'Набор браслет + кольцо' },
  { category: 'Серьги · позолота' },
  { category: 'Кольцо · родирование' },
  { category: 'Браслет · жемчуг' },
  { category: 'Кулон · эмаль' },
]

const PRODUCTS_BOTTOM = [
  { category: 'Цепочка · позолота' },
  { category: 'Набор «Минимализм»' },
  { category: 'Серьги · серебрение' },
  { category: 'Подарочный сертификат' },
  { category: 'Брошь · эмаль' },
  { category: 'Набор «Жемчуг»' },
]

const SEO_PARAGRAPHS = [
  'Украшение — подарок, который не нужно объяснять. В разделе «Подарки» мы собираем готовые решения на любой повод: наборы серёг и кулонов, парные браслеты, лаконичные кольца и подарочные сертификаты, если хочется оставить выбор за получателем.',
  'Каждый заказ упаковывается в фирменную коробку AURELIA с лентой и открыткой — подарок можно вручать сразу. Если украшение не подойдёт, его можно обменять или вернуть в течение 30 дней.',
  'Не знаете, с чего начать? Отфильтруйте подборку по поводу, бюджету или получателю — а консультанты в чате помогут выбрать размер и покрытие.',
]

export default function GiftsCategoryPage() {
  return (
    <CategoryLayout
      breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Подарки' }]}
      title="Подарки"
      count="· пока 0 товаров"
      chips={CHIPS}
      productsTop={PRODUCTS_TOP}
      productsBottom={PRODUCTS_BOTTOM}
      seoTitle="Подарки от AURELIA"
      seoParagraphs={SEO_PARAGRAPHS}
    />
  )
}
