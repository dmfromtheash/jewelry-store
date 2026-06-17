/**
 * AURELIA — Admin product variants card (Этап 30C)
 *
 * Server-rendered, no client JS. Lists a product's variants and posts to the
 * variant server actions (add / update / delete). Built entirely from the
 * existing admin primitives (.au-adm-card / .au-adm-table / .au-field / .au-btn) —
 * NO new CSS and NO storefront change. The storefront selector/cart is 30D.
 *
 * Each row is a small inline edit form (value / type / Δprice / stock / sku /
 * default) with its own Save button, plus a separate Delete form. An add form
 * sits below the table. Money deltas are shown/entered in whole UAH; the DB
 * stores integer minor units (the action converts).
 */

import {
  addVariantAction,
  updateVariantAction,
  deleteVariantAction,
} from '../../../../src/lib/admin/catalog-actions'
import type { AdminProductVariantRow } from '../../../../src/lib/admin/catalog'

/** ?verr= / ?vok= feedback codes (kept separate from the form's ?err= and gallery ?gerr=). */
const VARIANT_NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  added: { kind: 'ok', text: 'Вариант добавлен.' },
  updated: { kind: 'ok', text: 'Вариант обновлён.' },
  removed: { kind: 'ok', text: 'Вариант удалён.' },
  name: { kind: 'err', text: 'Укажите тип варианта.' },
  value: { kind: 'err', text: 'Укажите значение варианта (например, «Позолота»).' },
  sortOrder: { kind: 'err', text: 'Порядок должен быть целым числом 0 или больше.' },
  pricedelta: { kind: 'err', text: 'Δ цены должна быть числом (можно со знаком минус).' },
  pricetotal: { kind: 'err', text: 'С этой Δ цены итоговая цена товара станет нулевой или отрицательной.' },
  stock: { kind: 'err', text: 'Остаток варианта — целое число 0 или больше (пусто — не отслеживается).' },
  duplicate: { kind: 'err', text: 'Такой вариант (тип + значение) у товара уже есть.' },
  notfound: { kind: 'err', text: 'Вариант не найден.' },
  inuse: { kind: 'err', text: 'Нельзя удалить вариант: он есть в активном заказе (оформлен/в обработке).' },
}

export function resolveVariantNotice(sp: Record<string, string | string[] | undefined>) {
  const ok = typeof sp.vok === 'string' ? VARIANT_NOTICES[sp.vok] : undefined
  const err = typeof sp.verr === 'string' ? VARIANT_NOTICES[sp.verr] : undefined
  return ok ?? err ?? null
}

/** Minor units → whole-UAH string for an input default ('' when null). */
function deltaToInput(minor: number | null): string {
  if (minor == null) return ''
  return String(minor / 100)
}

interface ProductVariantsProps {
  productId: string
  variants: AdminProductVariantRow[]
  notice: { kind: 'ok' | 'err'; text: string } | null
}

export function ProductVariants({ productId, variants, notice }: ProductVariantsProps) {
  return (
    <div className="au-adm-card" style={{ marginTop: 20 }}>
      <h2 className="au-adm-title">Варианты товара</h2>
      <span className="au-adm-sub">
        Покрытие/исполнение одного изделия с отдельной ценой (Δ), остатком и артикулом.
        Первый вариант становится вариантом по умолчанию. Витрина-селектор — этап 30D.
      </span>

      {notice && (
        <p
          className="au-adm-note"
          style={{ color: notice.kind === 'err' ? '#b42318' : undefined }}
        >
          {notice.text}
        </p>
      )}

      {variants.length > 0 ? (
        <table className="au-adm-table">
          <thead>
            <tr>
              <th>Значение</th>
              <th>Тип</th>
              <th>Δ цены, ₴</th>
              <th>Остаток</th>
              <th>Артикул</th>
              <th>Порядок</th>
              <th>По умолч.</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {variants.map((v) => (
              <tr key={v.id}>
                {/* Inline edit form for this variant. */}
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="variantValue"
                    type="text"
                    required
                    defaultValue={v.value}
                    aria-label="Значение варианта"
                  />
                </td>
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="variantName"
                    type="text"
                    defaultValue={v.name}
                    aria-label="Тип варианта"
                  />
                </td>
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="priceDelta"
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    defaultValue={deltaToInput(v.priceDelta)}
                    aria-label="Δ цены, ₴"
                  />
                </td>
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="variantStock"
                    type="text"
                    inputMode="numeric"
                    placeholder="не отслеж."
                    defaultValue={v.stockQuantity != null ? String(v.stockQuantity) : ''}
                    aria-label="Остаток варианта"
                  />
                </td>
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="variantSku"
                    type="text"
                    defaultValue={v.sku ?? ''}
                    aria-label="Артикул варианта"
                  />
                </td>
                <td>
                  <input
                    form={`vf-${v.id}`}
                    name="sortOrder"
                    type="text"
                    inputMode="numeric"
                    defaultValue={String(v.sortOrder)}
                    style={{ width: 64 }}
                    aria-label="Порядок"
                  />
                </td>
                <td style={{ textAlign: 'center' }}>
                  <label style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
                    <input
                      form={`vf-${v.id}`}
                      name="isDefault"
                      type="checkbox"
                      defaultChecked={v.isDefault}
                      aria-label="Вариант по умолчанию"
                    />
                    {v.isDefault ? '●' : ''}
                  </label>
                </td>
                <td>
                  {/* The edit form lives here so its inputs (above, via form=) submit together. */}
                  <form id={`vf-${v.id}`} action={updateVariantAction} style={{ display: 'inline' }}>
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="variantId" value={v.id} />
                    <button className="au-btn au-btn--ghost" type="submit">
                      Сохранить
                    </button>
                  </form>
                  <form action={deleteVariantAction} style={{ display: 'inline', marginLeft: 6 }}>
                    <input type="hidden" name="productId" value={productId} />
                    <input type="hidden" name="variantId" value={v.id} />
                    <button className="au-btn au-btn--ghost" type="submit">
                      Удалить
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="au-adm-sub">Вариантов пока нет — товар продаётся как есть.</p>
      )}

      {/* Add a new variant. */}
      <form
        action={addVariantAction}
        style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}
      >
        <input type="hidden" name="productId" value={productId} />
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-value">Значение *</label>
          <input id="au-variant-value" name="variantValue" type="text" required placeholder="Позолота" />
        </div>
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-name">Тип</label>
          <input id="au-variant-name" name="variantName" type="text" placeholder="coating" />
        </div>
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-delta">Δ цены, ₴</label>
          <input id="au-variant-delta" name="priceDelta" type="text" inputMode="decimal" placeholder="0" style={{ width: 90 }} />
        </div>
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-stock">Остаток</label>
          <input id="au-variant-stock" name="variantStock" type="text" inputMode="numeric" placeholder="не отслеж." style={{ width: 110 }} />
        </div>
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-sku">Артикул</label>
          <input id="au-variant-sku" name="variantSku" type="text" style={{ width: 120 }} />
        </div>
        <div className="au-field" style={{ margin: 0 }}>
          <label htmlFor="au-variant-sort">Порядок</label>
          <input id="au-variant-sort" name="sortOrder" type="text" inputMode="numeric" placeholder="0" style={{ width: 70 }} />
        </div>
        <div className="au-field au-adm-form-check" style={{ margin: 0 }}>
          <label htmlFor="au-variant-default">
            <input id="au-variant-default" name="isDefault" type="checkbox" />
            По умолчанию
          </label>
        </div>
        <button className="au-btn au-btn--primary" type="submit">
          Добавить вариант
        </button>
      </form>
    </div>
  )
}
