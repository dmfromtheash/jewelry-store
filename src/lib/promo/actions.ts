'use server'

/**
 * AURELIA — Checkout promo preview action (Этап 63A)
 *
 * Lets the checkout UI PREVIEW a promo code before submitting the order. It is preview-only:
 * the authoritative discount is recomputed by createOrderDraft at submit (this action never
 * persists anything and never increments usedCount). The server recomputes the subtotal from
 * the catalog via priceOrderItems — the client subtotal/discount is never trusted — and runs
 * the same promo rules. All failures return ONE generic Ukrainian message.
 */

import { priceOrderItems } from '../orders/pricing'
import type { OrderDraftItemInput } from '../orders/types'
import { validateAndPricePromo } from './server'
import { PROMO_GENERIC_ERROR } from './calc'

export type PromoPreviewResult =
  | {
      ok: true
      code: string
      discountMinor: number
      subtotalMinor: number
      totalMinor: number
    }
  | { ok: false; error: string }

export async function previewPromoAction(
  rawCode: string,
  items: OrderDraftItemInput[],
): Promise<PromoPreviewResult> {
  // Recompute the authoritative subtotal from the DB (same path the order uses).
  const priced = await priceOrderItems(Array.isArray(items) ? items : [])
  if (!priced.ok) {
    // Don't leak the specific cart problem through the promo box — keep it generic.
    return { ok: false, error: PROMO_GENERIC_ERROR }
  }

  const result = await validateAndPricePromo(rawCode, priced.subtotalMinor)
  if (!result.ok) return { ok: false, error: result.error }

  const discountMinor = result.promo.discountMinor
  return {
    ok: true,
    code: result.promo.code,
    discountMinor,
    subtotalMinor: priced.subtotalMinor,
    totalMinor: priced.subtotalMinor - discountMinor,
  }
}
