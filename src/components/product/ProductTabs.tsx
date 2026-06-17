'use client'

import { Fragment, useState } from 'react'
import type { ProductSpec } from '../../lib/catalog/types'

/**
 * AURELIA — ProductTabs (client component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Описание / Характеристики / Доставка и возврат. Minimal client state to
 * switch the active panel — the only interactive piece of the product page.
 *
 * With `description` / `specs` it shows the product's data; without them it
 * keeps the generic coming-soon fallback copy.
 */

type TabId = 'desc' | 'specs' | 'delivery'

const TABS: { id: TabId; label: string }[] = [
  { id: 'desc', label: 'Описание' },
  { id: 'specs', label: 'Характеристики' },
  { id: 'delivery', label: 'Доставка и возврат' },
]

const DEFAULT_DESCRIPTION =
  'Описание украшения появится после добавления товара. Здесь будет рассказ о форме, ' +
  'покрытии, вставках и о том, с чем украшение лучше сочетать.'

const DEFAULT_SPECS: ProductSpec[] = [
  { label: 'Тип', value: '—' },
  { label: 'Покрытие', value: '—' },
  { label: 'Вставка', value: '—' },
  { label: 'Размер', value: '—' },
  { label: 'Вес', value: '—' },
]

export default function ProductTabs({
  description,
  specs,
}: {
  description?: string
  specs?: ProductSpec[]
}) {
  const [active, setActive] = useState<TabId>('desc')
  const descriptionText = description ?? DEFAULT_DESCRIPTION
  const specRows = specs && specs.length > 0 ? specs : DEFAULT_SPECS

  return (
    <div>
      <div className="au-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active === tab.id}
            className={`au-tab${active === tab.id ? ' is-active' : ''}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="au-tab-panel" role="tabpanel" hidden={active !== 'desc'}>
        <p>{descriptionText}</p>
      </div>

      <div className="au-tab-panel" role="tabpanel" hidden={active !== 'specs'}>
        <dl className="au-spec">
          {specRows.map((spec) => (
            <Fragment key={spec.label}>
              <dt>{spec.label}</dt>
              <dd>{spec.value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>

      <div className="au-tab-panel" role="tabpanel" hidden={active !== 'delivery'}>
        <p>
          Отправляем заказы в день оформления. Доставка курьером, в пункты выдачи и почтой по всей
          стране. Бесплатно — при заказе от 3 000 ₴. Обмен и возврат — в течение 30 дней с момента
          покупки.
        </p>
      </div>
    </div>
  )
}
