/**
 * AURELIA — Category: Бижутерия (Этап 4A)
 * Source: docs/design/aurelia-prototype/04 Category Bijouterie.html
 * Frontend / static UI only — reuses CategoryLayout.
 */

import type { Metadata } from 'next'
import CategoryLayout from '../../../src/components/category/CategoryLayout'

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

const PRODUCTS_TOP = [
  { category: 'Серьги · позолота' },
  { category: 'Кольцо · родирование' },
  { category: 'Браслет · жемчуг' },
  { category: 'Цепочка · позолота' },
  { category: 'Кулон · фианит' },
  { category: 'Серьги · эмаль' },
]

const PRODUCTS_BOTTOM = [
  { category: 'Кольцо · сталь' },
  { category: 'Браслет · позолота' },
  { category: 'Серьги · фианит' },
  { category: 'Кулон · жемчуг' },
  { category: 'Цепочка · родирование' },
  { category: 'Брошь · эмаль' },
]

const SEO_PARAGRAPHS = [
  'Бижутерия — это свобода: менять образы, пробовать новое и не относиться к украшениям слишком серьёзно. В каталоге AURELIA собраны серьги, кольца, браслеты, цепочки и кулоны на каждый день и для особенных случаев.',
  'Мы работаем с покрытиями из позолоты и родия, гипоаллергенной сталью, искусственным жемчугом, фианитами и эмалью. Базовые формы легко сочетаются между собой — собирайте свои комбинации и многослойные образы.',
  'Все украшения приезжают в фирменной упаковке, а если что-то не подойдёт — обменяем или вернём деньги в течение 30 дней.',
]

export default function BijouterieCategoryPage() {
  return (
    <CategoryLayout
      breadcrumbs={[{ label: 'Главная', href: '/' }, { label: 'Бижутерия' }]}
      title="Бижутерия"
      count="· пока 0 товаров"
      chips={CHIPS}
      productsTop={PRODUCTS_TOP}
      productsBottom={PRODUCTS_BOTTOM}
      seoTitle="Бижутерия AURELIA"
      seoParagraphs={SEO_PARAGRAPHS}
    />
  )
}
