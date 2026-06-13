/**
 * AURELIA — Product page: coming soon (Этап 5A)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Placeholder product page ("Скоро будет добавлено украшение") rendered as a
 * full product page. Frontend / static UI only — no real product, cart, or
 * backend. ProductCard placeholders link here.
 */

import type { Metadata } from 'next'
import ProductPageLayout from '../../../src/components/product/ProductPageLayout'

export const metadata: Metadata = {
  title: 'Скоро будет добавлено украшение — AURELIA',
  description: 'Украшение скоро появится в продаже. Подпишитесь, чтобы узнать о поступлении.',
}

const SIMILAR = [
  'Серьги · позолота',
  'Кольцо · родирование',
  'Кулон · жемчуг',
  'Браслет · эмаль',
]

export default function ProductComingSoonPage() {
  return (
    <ProductPageLayout
      breadcrumbs={[
        { label: 'Главная', href: '/' },
        { label: 'Бижутерия', href: '/category/bijouterie' },
        { label: 'Скоро будет добавлено украшение' },
      ]}
      similar={SIMILAR}
    />
  )
}
