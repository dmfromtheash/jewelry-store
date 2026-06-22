/**
 * AURELIA — Promo code validation + discount math (Этап 63A)
 *
 * Pure, dependency-free promo logic — NO Prisma, NO React, NO `server-only` — so the
 * EXACT same rules run in the server order action, the admin layer, and the verify script
 * (under tsx). This is the financial-correctness core: money is integer MINOR units, the
 * discount is always clamped to `[0, subtotal]`, so the final total can never go negative.
 *
 * The customer ever submits only the code STRING; the server recomputes the subtotal and
 * the discount here. A client-sent discount/total is never trusted anywhere.
 */

import { hasUnsafeMarkup } from '../customer/validate'

/** Promo discount kind (mirrors the Prisma `PromoType` enum). */
export type PromoType = 'percent' | 'fixed_amount'

/** Code format: A–Z, 0–9, dash, underscore; length-capped. */
export const PROMO_CODE_MAX = 40
const PROMO_CODE_RE = /^[A-Z0-9_-]{1,40}$/

export const PERCENT_MIN = 1
export const PERCENT_MAX = 100

/**
 * Normalises a raw promo code: trims, uppercases, and validates the charset/length.
 * Returns the normalised code, or `null` when it is empty/too long/has unsafe markup or
 * illegal characters — so an invalid code can never reach a DB lookup.
 */
export function normalizePromoCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  if (!code || code.length > PROMO_CODE_MAX) return null
  if (hasUnsafeMarkup(code)) return null
  if (!PROMO_CODE_RE.test(code)) return null
  return code
}

/** The promo fields the discount math needs (a subset of the PromoCode row). */
export interface PromoRule {
  type: PromoType
  percentValue: number | null
  amountMinor: number | null
  maxDiscountMinor: number | null
}

/**
 * Computes the discount in MINOR units for a given subtotal. Always returns an integer in
 * `[0, subtotalMinor]`:
 *   - percent: `round(subtotal * percent / 100)`, then capped by `maxDiscountMinor` (if set);
 *   - fixed_amount: the fixed `amountMinor`;
 * both are finally clamped to the subtotal so the total is never negative, and to ≥ 0.
 * A malformed rule (missing/invalid value) yields a 0 discount rather than throwing.
 */
export function computeDiscountMinor(rule: PromoRule, subtotalMinor: number): number {
  if (!Number.isFinite(subtotalMinor) || subtotalMinor <= 0) return 0

  let discount = 0
  if (rule.type === 'percent') {
    const pct = rule.percentValue
    if (!Number.isInteger(pct) || pct == null || pct < PERCENT_MIN || pct > PERCENT_MAX) return 0
    discount = Math.round((subtotalMinor * pct) / 100)
    if (rule.maxDiscountMinor != null && Number.isInteger(rule.maxDiscountMinor)) {
      discount = Math.min(discount, Math.max(0, rule.maxDiscountMinor))
    }
  } else if (rule.type === 'fixed_amount') {
    const amt = rule.amountMinor
    if (!Number.isInteger(amt) || amt == null || amt <= 0) return 0
    discount = amt
  } else {
    return 0
  }

  // Clamp to [0, subtotal] — the invariant that keeps the final total non-negative.
  if (discount < 0) discount = 0
  if (discount > subtotalMinor) discount = subtotalMinor
  return discount
}

/** Why a promo was rejected (all map to ONE generic customer-facing message). */
export type PromoRejectReason =
  | 'not_found'
  | 'inactive'
  | 'archived'
  | 'not_started'
  | 'expired'
  | 'min_subtotal'
  | 'usage_limit'
  | 'currency_mismatch'
  | 'no_discount'

/** The full promo shape `evaluatePromo` checks (a subset of the PromoCode row). */
export interface EvaluablePromo extends PromoRule {
  currency: string
  isActive: boolean
  archivedAt: Date | string | null
  startsAt: Date | string | null
  endsAt: Date | string | null
  minSubtotalMinor: number | null
  usageLimit: number | null
  usedCount: number
}

export type PromoEvaluation =
  | { ok: true; discountMinor: number }
  | { ok: false; reason: PromoRejectReason }

function toTime(d: Date | string | null): number | null {
  if (d == null) return null
  const t = d instanceof Date ? d.getTime() : Date.parse(d)
  return Number.isFinite(t) ? t : null
}

/**
 * Fully evaluates a promo against a subtotal at time `now`, enforcing every eligibility rule
 * BEFORE computing the discount: active, not archived, within the date window, currency match
 * (UAH), minimum subtotal, and usage limit. Returns the clamped discount or a machine reason.
 * `orderCurrency` defaults to UAH (the only storefront currency today).
 */
export function evaluatePromo(
  promo: EvaluablePromo,
  subtotalMinor: number,
  now: Date = new Date(),
  orderCurrency = 'UAH',
): PromoEvaluation {
  if (!promo.isActive) return { ok: false, reason: 'inactive' }
  if (promo.archivedAt != null) return { ok: false, reason: 'archived' }

  const nowMs = now.getTime()
  const starts = toTime(promo.startsAt)
  if (starts != null && nowMs < starts) return { ok: false, reason: 'not_started' }
  const ends = toTime(promo.endsAt)
  if (ends != null && nowMs >= ends) return { ok: false, reason: 'expired' }

  // Currency only matters for a fixed-amount discount (a percent is currency-agnostic).
  if (promo.type === 'fixed_amount' && promo.currency !== orderCurrency) {
    return { ok: false, reason: 'currency_mismatch' }
  }

  if (promo.minSubtotalMinor != null && subtotalMinor < promo.minSubtotalMinor) {
    return { ok: false, reason: 'min_subtotal' }
  }

  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) {
    return { ok: false, reason: 'usage_limit' }
  }

  const discountMinor = computeDiscountMinor(promo, subtotalMinor)
  if (discountMinor <= 0) return { ok: false, reason: 'no_discount' }
  return { ok: true, discountMinor }
}

/** Single generic, non-leaking customer-facing rejection (Ukrainian). */
export const PROMO_GENERIC_ERROR =
  'Промокод недійсний або не підходить до цього замовлення.'
