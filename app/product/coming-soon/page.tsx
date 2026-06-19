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
  title: 'Незабаром буде додано прикрасу — AURELIA',
  description: 'Прикраса незабаром зʼявиться в продажу. Підпишіться, щоб дізнатися про надходження.',
}

const SIMILAR = [
  'Сережки · позолота',
  'Каблучка · родіювання',
  'Кулон · перли',
  'Браслет · емаль',
]

export default function ProductComingSoonPage() {
  return (
    <ProductPageLayout
      breadcrumbs={[
        { label: 'Головна', href: '/' },
        { label: 'Біжутерія', href: '/category/bijouterie' },
        { label: 'Незабаром буде додано прикрасу' },
      ]}
      similar={SIMILAR}
    />
  )
}
