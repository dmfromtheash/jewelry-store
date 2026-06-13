'use client'

import { Fragment, useState } from 'react'

/**
 * AURELIA — ProductTabs (client component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Описание / Характеристики / Доставка и возврат. Minimal client state to
 * switch the active panel — the only interactive piece of the product page.
 */

type TabId = 'desc' | 'specs' | 'delivery'

const TABS: { id: TabId; label: string }[] = [
  { id: 'desc', label: 'Описание' },
  { id: 'specs', label: 'Характеристики' },
  { id: 'delivery', label: 'Доставка и возврат' },
]

const SPECS: [string, string][] = [
  ['Тип', '—'],
  ['Покрытие', '—'],
  ['Вставка', '—'],
  ['Размер', '—'],
  ['Вес', '—'],
]

export default function ProductTabs() {
  const [active, setActive] = useState<TabId>('desc')

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
        <p>
          Описание украшения появится после добавления товара. Здесь будет рассказ о форме,
          покрытии, вставках и о том, с чем украшение лучше сочетать.
        </p>
      </div>

      <div className="au-tab-panel" role="tabpanel" hidden={active !== 'specs'}>
        <dl className="au-spec">
          {SPECS.map(([term, value]) => (
            <Fragment key={term}>
              <dt>{term}</dt>
              <dd>{value}</dd>
            </Fragment>
          ))}
        </dl>
      </div>

      <div className="au-tab-panel" role="tabpanel" hidden={active !== 'delivery'}>
        <p>
          Отправляем заказы в день оформления. Доставка курьером, в пункты выдачи и почтой по всей
          стране. Бесплатно — при заказе от 3 000 ₽. Обмен и возврат — в течение 30 дней с момента
          покупки.
        </p>
      </div>
    </div>
  )
}
