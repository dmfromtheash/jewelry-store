/**
 * AURELIA — Admin promo form validation (Этап 63A)
 *
 * Pure, dependency-free parsing/validation for the admin promo create/edit form. No Prisma,
 * no `server-only` — so it is also exercised by the verify script. Money is entered in whole
 * UAH (optionally with up to 2 decimals) and converted to integer MINOR units here; percent
 * is a whole number 1–100. Text fields are length-capped + markup-rejected.
 */

import { hasUnsafeMarkup } from '../customer/validate'
import {
  normalizePromoCode,
  PERCENT_MAX,
  PERCENT_MIN,
  type PromoType,
} from '../promo/calc'

export const PROMO_NAME_MAX = 120
export const PROMO_NOTES_MAX = 500

export type PromoFormErrors = Partial<
  Record<
    | 'code'
    | 'internalName'
    | 'type'
    | 'percentValue'
    | 'amount'
    | 'minSubtotal'
    | 'maxDiscount'
    | 'usageLimit'
    | 'startsAt'
    | 'endsAt'
    | 'notes',
    string
  >
>

/** Normalised, ready-to-persist promo values. */
export interface NormalizedPromoForm {
  code: string
  internalName: string
  type: PromoType
  percentValue: number | null
  amountMinor: number | null
  minSubtotalMinor: number | null
  maxDiscountMinor: number | null
  usageLimit: number | null
  startsAt: Date | null
  endsAt: Date | null
  notes: string | null
}

/** Raw string inputs from the admin form (FormData values). */
export interface PromoFormInput {
  code?: string
  internalName?: string
  type?: string
  percentValue?: string
  amount?: string
  minSubtotal?: string
  maxDiscount?: string
  usageLimit?: string
  startsAt?: string
  endsAt?: string
  notes?: string
}

export interface PromoFormResult {
  errors: PromoFormErrors
  value?: NormalizedPromoForm
}

/** Parses a UAH money string ("1234" / "1234.50" / "1 234,5") to integer minor units.
 *  Returns null on empty, NaN, negative, or more than 2 decimals. */
export function parseUahToMinor(raw: string | undefined): number | null {
  if (raw == null) return null
  const cleaned = raw.replace(/\s/g, '').replace(',', '.').trim()
  if (!cleaned) return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const [intPart, fracPart = ''] = cleaned.split('.')
  const frac = (fracPart + '00').slice(0, 2)
  const minor = Number(intPart) * 100 + Number(frac)
  return Number.isSafeInteger(minor) ? minor : null
}

function parsePositiveInt(raw: string | undefined): number | null {
  if (raw == null) return null
  const s = raw.trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return NaN as unknown as number
  const n = Number(s)
  return Number.isSafeInteger(n) ? n : (NaN as unknown as number)
}

function parseDate(raw: string | undefined): Date | null | 'invalid' {
  if (raw == null) return null
  const s = raw.trim()
  if (!s) return null
  const t = Date.parse(s)
  if (!Number.isFinite(t)) return 'invalid'
  return new Date(t)
}

export function validatePromoForm(input: PromoFormInput): PromoFormResult {
  const errors: PromoFormErrors = {}

  const code = normalizePromoCode(input.code)
  if (!code) errors.code = 'Код: лише A–Z, 0–9, «-», «_» (до 40 символів).'

  const internalName = (input.internalName ?? '').trim()
  if (internalName.length < 2) errors.internalName = 'Вкажіть назву (мінімум 2 символи).'
  else if (internalName.length > PROMO_NAME_MAX) errors.internalName = 'Назва задовга.'
  else if (hasUnsafeMarkup(internalName)) errors.internalName = 'Назва містить недопустимі символи.'

  const type = input.type === 'percent' || input.type === 'fixed_amount' ? input.type : null
  if (!type) errors.type = 'Оберіть тип знижки.'

  let percentValue: number | null = null
  let amountMinor: number | null = null
  if (type === 'percent') {
    const p = parsePositiveInt(input.percentValue)
    if (p == null || !Number.isInteger(p) || Number.isNaN(p) || p < PERCENT_MIN || p > PERCENT_MAX) {
      errors.percentValue = `Відсоток: ціле число ${PERCENT_MIN}–${PERCENT_MAX}.`
    } else {
      percentValue = p
    }
  } else if (type === 'fixed_amount') {
    const a = parseUahToMinor(input.amount)
    if (a == null || a <= 0) errors.amount = 'Сума знижки має бути більшою за 0.'
    else amountMinor = a
  }

  // Optional numeric fields (blank → null; present-but-bad → error).
  let minSubtotalMinor: number | null = null
  if ((input.minSubtotal ?? '').trim()) {
    const v = parseUahToMinor(input.minSubtotal)
    if (v == null || v < 0) errors.minSubtotal = 'Мінімальна сума некоректна.'
    else minSubtotalMinor = v
  }

  let maxDiscountMinor: number | null = null
  if ((input.maxDiscount ?? '').trim()) {
    const v = parseUahToMinor(input.maxDiscount)
    if (v == null || v <= 0) errors.maxDiscount = 'Максимальна знижка некоректна.'
    else maxDiscountMinor = v
  }

  let usageLimit: number | null = null
  if ((input.usageLimit ?? '').trim()) {
    const v = parsePositiveInt(input.usageLimit)
    if (v == null || Number.isNaN(v) || v < 1) errors.usageLimit = 'Ліміт використань має бути ≥ 1.'
    else usageLimit = v
  }

  const starts = parseDate(input.startsAt)
  if (starts === 'invalid') errors.startsAt = 'Невірна дата початку.'
  const ends = parseDate(input.endsAt)
  if (ends === 'invalid') errors.endsAt = 'Невірна дата завершення.'
  const startsAt = starts === 'invalid' ? null : starts
  const endsAt = ends === 'invalid' ? null : ends
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAt = 'Дата завершення має бути пізніше за початок.'
  }

  let notes: string | null = null
  const rawNotes = (input.notes ?? '').trim()
  if (rawNotes) {
    if (rawNotes.length > PROMO_NOTES_MAX) errors.notes = 'Нотатка задовга.'
    else if (hasUnsafeMarkup(rawNotes)) errors.notes = 'Нотатка містить недопустимі символи.'
    else notes = rawNotes
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    value: {
      code: code!,
      internalName,
      type: type!,
      percentValue,
      amountMinor,
      minSubtotalMinor,
      maxDiscountMinor,
      usageLimit,
      startsAt,
      endsAt,
      notes,
    },
  }
}
