'use client'

import { useActionState, useState } from 'react'
import { savePromoAction, type PromoActionState } from '../../../../src/lib/admin/promotion-actions'

/**
 * AURELIA — Admin promo create/edit form (Этап 63A)
 *
 * Client form wired to the savePromoAction server action via useActionState, so server-side
 * validation errors render inline. Used for BOTH create (no `promo`) and edit (prefilled).
 * Money is entered in whole UAH (server converts to minor units); percent is 1–100. Reuses
 * existing admin form classes — no new design.
 */

export interface PromoFormValues {
  id: string
  code: string
  internalName: string
  type: 'percent' | 'fixed_amount'
  percentValue: number | null
  amountMinor: number | null
  minSubtotalMinor: number | null
  maxDiscountMinor: number | null
  usageLimit: number | null
  startsAt: string | null
  endsAt: string | null
  notes: string | null
}

const initialState: PromoActionState = {}

/** minor units → UAH string for an input value ("" when null). */
function uah(minor: number | null): string {
  if (minor == null) return ''
  return (minor / 100).toString()
}

/** ISO/date → value for <input type="datetime-local"> ("" when null). */
function dtLocal(value: string | null): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  // yyyy-MM-ddThh:mm in local time
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function PromoForm({ promo }: { promo?: PromoFormValues }) {
  const [state, formAction, pending] = useActionState(savePromoAction, initialState)
  const [type, setType] = useState<'percent' | 'fixed_amount'>(promo?.type ?? 'percent')
  const errors = state.errors ?? {}

  return (
    <form action={formAction} className="au-adm-statusform" style={{ display: 'grid', gap: 10 }}>
      {promo && <input type="hidden" name="id" value={promo.id} />}

      <label className="au-adm-sub" htmlFor={`code-${promo?.id ?? 'new'}`}>Код</label>
      <input id={`code-${promo?.id ?? 'new'}`} name="code" defaultValue={promo?.code ?? ''} placeholder="WELCOME10" className="au-adm-select" />
      {errors.code && <p className="au-field-error">{errors.code}</p>}

      <label className="au-adm-sub" htmlFor={`name-${promo?.id ?? 'new'}`}>Название (внутр.)</label>
      <input id={`name-${promo?.id ?? 'new'}`} name="internalName" defaultValue={promo?.internalName ?? ''} placeholder="Скидка для новых" className="au-adm-select" />
      {errors.internalName && <p className="au-field-error">{errors.internalName}</p>}

      <label className="au-adm-sub" htmlFor={`type-${promo?.id ?? 'new'}`}>Тип</label>
      <select
        id={`type-${promo?.id ?? 'new'}`}
        name="type"
        className="au-adm-select"
        value={type}
        onChange={(e) => setType(e.target.value as 'percent' | 'fixed_amount')}
      >
        <option value="percent">Процент (%)</option>
        <option value="fixed_amount">Фиксированная сумма (₴)</option>
      </select>
      {errors.type && <p className="au-field-error">{errors.type}</p>}

      {type === 'percent' ? (
        <>
          <label className="au-adm-sub" htmlFor={`pct-${promo?.id ?? 'new'}`}>Процент (1–100)</label>
          <input id={`pct-${promo?.id ?? 'new'}`} name="percentValue" type="number" min={1} max={100} defaultValue={promo?.percentValue ?? ''} className="au-adm-select" />
          {errors.percentValue && <p className="au-field-error">{errors.percentValue}</p>}

          <label className="au-adm-sub" htmlFor={`max-${promo?.id ?? 'new'}`}>Макс. скидка, ₴ (необязательно)</label>
          <input id={`max-${promo?.id ?? 'new'}`} name="maxDiscount" defaultValue={uah(promo?.maxDiscountMinor ?? null)} placeholder="напр. 500" className="au-adm-select" />
          {errors.maxDiscount && <p className="au-field-error">{errors.maxDiscount}</p>}
        </>
      ) : (
        <>
          <label className="au-adm-sub" htmlFor={`amt-${promo?.id ?? 'new'}`}>Сумма скидки, ₴</label>
          <input id={`amt-${promo?.id ?? 'new'}`} name="amount" defaultValue={uah(promo?.amountMinor ?? null)} placeholder="напр. 200" className="au-adm-select" />
          {errors.amount && <p className="au-field-error">{errors.amount}</p>}
        </>
      )}

      <label className="au-adm-sub" htmlFor={`min-${promo?.id ?? 'new'}`}>Мин. сумма заказа, ₴ (необязательно)</label>
      <input id={`min-${promo?.id ?? 'new'}`} name="minSubtotal" defaultValue={uah(promo?.minSubtotalMinor ?? null)} placeholder="напр. 1000" className="au-adm-select" />
      {errors.minSubtotal && <p className="au-field-error">{errors.minSubtotal}</p>}

      <label className="au-adm-sub" htmlFor={`lim-${promo?.id ?? 'new'}`}>Лимит использований (необязательно)</label>
      <input id={`lim-${promo?.id ?? 'new'}`} name="usageLimit" type="number" min={1} defaultValue={promo?.usageLimit ?? ''} className="au-adm-select" />
      {errors.usageLimit && <p className="au-field-error">{errors.usageLimit}</p>}

      <label className="au-adm-sub" htmlFor={`starts-${promo?.id ?? 'new'}`}>Начало (необязательно)</label>
      <input id={`starts-${promo?.id ?? 'new'}`} name="startsAt" type="datetime-local" defaultValue={dtLocal(promo?.startsAt ?? null)} className="au-adm-select" />
      {errors.startsAt && <p className="au-field-error">{errors.startsAt}</p>}

      <label className="au-adm-sub" htmlFor={`ends-${promo?.id ?? 'new'}`}>Окончание (необязательно)</label>
      <input id={`ends-${promo?.id ?? 'new'}`} name="endsAt" type="datetime-local" defaultValue={dtLocal(promo?.endsAt ?? null)} className="au-adm-select" />
      {errors.endsAt && <p className="au-field-error">{errors.endsAt}</p>}

      <label className="au-adm-sub" htmlFor={`notes-${promo?.id ?? 'new'}`}>Заметки (необязательно)</label>
      <input id={`notes-${promo?.id ?? 'new'}`} name="notes" defaultValue={promo?.notes ?? ''} className="au-adm-select" />
      {errors.notes && <p className="au-field-error">{errors.notes}</p>}

      {state.error && <p className="au-field-error" role="alert">{state.error}</p>}
      {state.ok && <p className="au-adm-sub" role="status">Сохранено.</p>}

      <button className="au-btn au-btn--primary" type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : promo ? 'Сохранить изменения' : 'Создать промокод'}
      </button>
    </form>
  )
}
