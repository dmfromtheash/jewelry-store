/**
 * AURELIA — Server promo layer (Этап 63A)
 *
 * Server-only Prisma reads for promo validation. Resolves a NORMALISED code to its row and
 * runs the pure `evaluatePromo` rules (src/lib/promo/calc.ts). It NEVER trusts a client
 * discount/total — the caller passes a server-computed subtotal. Returns a safe, generic
 * error to the customer (no leak of which rule failed or whether the code exists).
 *
 * `import 'server-only'` keeps Prisma out of any client bundle.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import {
  evaluatePromo,
  normalizePromoCode,
  PROMO_GENERIC_ERROR,
  type PromoEvaluation,
} from './calc'

/** Fields needed to evaluate a promo. */
const PROMO_EVAL_SELECT = {
  id: true,
  code: true,
  type: true,
  percentValue: true,
  amountMinor: true,
  currency: true,
  isActive: true,
  archivedAt: true,
  startsAt: true,
  endsAt: true,
  minSubtotalMinor: true,
  maxDiscountMinor: true,
  usageLimit: true,
  usedCount: true,
} as const

export type PricedPromo = {
  promoId: string
  code: string
  discountMinor: number
}

export type PromoApplyResult =
  | { ok: true; promo: PricedPromo }
  | { ok: false; error: string }

/**
 * Validates a raw client code against a SERVER-COMPUTED subtotal and returns the discount.
 * All failures collapse to one generic message. This is used both by the checkout preview
 * action and (authoritatively) by the order action before persistence.
 */
export async function validateAndPricePromo(
  rawCode: string,
  subtotalMinor: number,
  now: Date = new Date(),
): Promise<PromoApplyResult> {
  const code = normalizePromoCode(rawCode)
  if (!code) return { ok: false, error: PROMO_GENERIC_ERROR }

  const row = await prisma.promoCode.findUnique({
    where: { code },
    select: PROMO_EVAL_SELECT,
  })
  if (!row) return { ok: false, error: PROMO_GENERIC_ERROR }

  const evaluation: PromoEvaluation = evaluatePromo(row, subtotalMinor, now)
  if (!evaluation.ok) return { ok: false, error: PROMO_GENERIC_ERROR }

  return { ok: true, promo: { promoId: row.id, code: row.code, discountMinor: evaluation.discountMinor } }
}
