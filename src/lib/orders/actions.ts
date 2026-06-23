'use server'

/**
 * AURELIA — Order draft server action (Этап 16A)
 *
 * Creates a guest checkout draft order. The ONLY things trusted from the client
 * are product slugs and quantities; every price, name, sku and availability is
 * read from PostgreSQL and recomputed server-side, so a tampered client price
 * can never affect the stored order. No payment / auth / shipping.
 */

import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { validateOrderDraftFields, hasErrors } from './validate'
import { type OrderDraftInput, type OrderDraftResult } from './types'
import { priceOrderItems } from './pricing'
import { recordCheckoutError, recordDraftOrderCreated } from '../analytics/record'
import { buildMovementInput } from '../inventory/movements'
import { getCurrentCustomer } from '../customer/session'
import { enqueueOrderConfirmationEmail } from '../email/outbox'
import { validateAndPricePromo } from '../promo/server'

function generateOrderCode(): string {
  // 8 hex chars (~4.3B combos); uniqueness is also enforced by the DB + retry.
  return `AUR-${randomBytes(4).toString('hex').toUpperCase()}`
}

/** Thrown inside the order transaction when a tracked product's OR variant's
 *  stock ran out between validation and the conditional decrement (28B / 30B).
 *  Forces rollback. */
class OutOfStockError extends Error {
  constructor(public readonly productName: string) {
    super('out_of_stock')
    this.name = 'OutOfStockError'
  }
}

/** Thrown inside the order transaction when the applied promo hit its usageLimit between
 *  validation and the guarded usedCount increment (Этап 63A). Forces rollback so the order
 *  is never committed past the limit, and the usedCount increment is never leaked. */
class PromoExhaustedError extends Error {
  constructor() {
    super('promo_exhausted')
    this.name = 'PromoExhaustedError'
  }
}

function isUniqueViolation(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
}

export async function createOrderDraft(input: OrderDraftInput): Promise<OrderDraftResult> {
  // 1) Field validation (authoritative; the form reuses the same rules for UX).
  const fieldErrors = validateOrderDraftFields(input)
  if (hasErrors(fieldErrors)) {
    await recordCheckoutError({ errorType: 'validation' })
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors }
  }

  // 2-4) Server-authoritative pricing (Этап 63A): normalise items, fetch real products
  //       (published + purchasable gates), resolve variants, and build snapshot lines +
  //       the authoritative subtotal. The client price/name/status is never trusted. The
  //       SAME helper drives the checkout promo preview, so preview and stored order agree.
  const priced = await priceOrderItems(input.items)
  if (!priced.ok) {
    await recordCheckoutError({
      errorType: priced.errorType,
      itemCount: priced.errorType === 'empty_cart' ? 0 : undefined,
    })
    return {
      ok: false,
      error: priced.error,
      ...(priced.errorType === 'empty_cart' ? { fieldErrors: { items: 'Кошик порожній.' } } : {}),
    }
  }
  const { itemRows, stockDecrements, subtotalMinor: subtotalAmount, itemCount } = priced

  // 4a) Promo discount (Этап 63A). Server-authoritative: the discount is recomputed here
  //     from the just-computed subtotal — any client-sent discount/total is ignored. An
  //     invalid/ineligible code does NOT block checkout; it simply applies no discount and
  //     surfaces a generic field error so the customer can fix or drop it.
  let discountMinor = 0
  let appliedPromoId: string | null = null
  let appliedPromoCode: string | null = null
  const rawPromo = input.promoCode?.trim()
  if (rawPromo) {
    const promoResult = await validateAndPricePromo(rawPromo, subtotalAmount)
    if (!promoResult.ok) {
      return { ok: false, error: promoResult.error, fieldErrors: { promoCode: promoResult.error } }
    }
    discountMinor = promoResult.promo.discountMinor
    appliedPromoId = promoResult.promo.promoId
    appliedPromoCode = promoResult.promo.code
  }
  // Final total = subtotal - discount, clamped ≥ 0 by computeDiscountMinor's invariant.
  const totalAmount = subtotalAmount - discountMinor

  // 4b) Optional customer linking (Этап 47A). Resolved from the VERIFIED customer
  //     session server-side — never trusted from the client. Guest checkout keeps
  //     `customerId = null`; a logged-in customer's order is attached to their
  //     account so it shows in their order history. A lookup failure (e.g. stale
  //     session) safely falls back to a guest order rather than blocking checkout.
  let customerId: string | null = null
  try {
    const customer = await getCurrentCustomer()
    customerId = customer?.id ?? null
  } catch {
    customerId = null
  }

  // 5) Persist Order + OrderItems, decrement tracked stock, AND (Этап 63A) increment the
  //    promo usedCount — all in ONE transaction, so they never partially succeed. Retry only
  //    on the (rare) order-code collision; a rollback also undoes any stock decrement AND the
  //    promo usedCount increment, so the retry (and any failure) never leaks a redemption.
  for (let attempt = 0; attempt < 5; attempt++) {
    const orderCode = generateOrderCode()
    try {
      const order = await prisma.$transaction(async (tx) => {
        // Conditional decrement: `stockQuantity >= qty` in the WHERE guarantees
        // stock can never go negative and prevents oversell under concurrent
        // orders (a racing tx that already took the stock makes count === 0).
        // The decrement hits the variant row when the line tracks variant stock,
        // else the product row (28B fallback) — both fully race-safe (Этап 30B).
        for (const d of stockDecrements) {
          const res =
            d.source === 'variant'
              ? await tx.productVariant.updateMany({
                  where: { id: d.id, stockQuantity: { gte: d.qty } },
                  data: { stockQuantity: { decrement: d.qty } },
                })
              : await tx.product.updateMany({
                  where: { id: d.id, stockQuantity: { gte: d.qty } },
                  data: { stockQuantity: { decrement: d.qty } },
                })
          if (res.count !== 1) throw new OutOfStockError(d.name)

          // Inventory ledger (Этап 70A): record the decrement in the SAME tx, so the movement
          // commits/rolls back atomically with the stock change + order. Only the signed delta is
          // captured here (before/after are left null to keep this hot path read-free).
          await tx.inventoryStockMovement.create({
            data: buildMovementInput({
              level: d.source,
              delta: -d.qty,
              reason: 'order_created',
              productId: d.productId,
              variantId: d.source === 'variant' ? d.id : null,
              orderCode,
            }),
          })
        }

        // Promo redemption (Этап 63A): increment usedCount ONLY when the code still has
        // budget. The `usageLimit IS NULL OR usedCount < usageLimit` guard makes this
        // race-safe — a concurrent checkout that already took the last redemption makes
        // count === 0 here, forcing a rollback (the order is NOT committed past the limit).
        if (appliedPromoId) {
          const claimed = await tx.promoCode.updateMany({
            where: {
              id: appliedPromoId,
              OR: [{ usageLimit: null }, { usedCount: { lt: prisma.promoCode.fields.usageLimit } }],
            },
            data: { usedCount: { increment: 1 } },
          })
          if (claimed.count !== 1) throw new PromoExhaustedError()
        }

        return tx.order.create({
          data: {
            orderCode,
            status: 'submitted',
            // Server-resolved owner (Этап 47A): null for guests, the verified
            // customer id when logged in. Never read from the client payload.
            customerId,
            customerName: input.customerName.trim(),
            customerPhone: input.customerPhone.trim(),
            customerEmail: input.customerEmail?.trim() ? input.customerEmail.trim() : null,
            deliveryCity: input.deliveryCity.trim(),
            // Allowlisted by validateOrderDraftFields above — store the normalised
            // key, never a raw/unknown client value.
            deliveryMethod: input.deliveryMethod.trim(),
            // Optional free-text note (отделение/адрес/комментарий); null if blank.
            deliveryDetails: input.deliveryDetails?.trim() ? input.deliveryDetails.trim() : null,
            // Manual branch/department + separate comment (Этап 59A); null if blank.
            // Validated above (length + no-markup) — never a carrier API value.
            deliveryBranch: input.deliveryBranch?.trim() ? input.deliveryBranch.trim() : null,
            deliveryComment: input.deliveryComment?.trim() ? input.deliveryComment.trim() : null,
            paymentMethod: input.paymentMethod.trim(),
            subtotalAmount,
            // Promo snapshot (Этап 63A): discount + the code id/text actually applied.
            // 0 / null when no promo, so a no-promo order is identical to pre-63A.
            discountMinor,
            promoCodeId: appliedPromoId,
            promoCode: appliedPromoCode,
            totalAmount,
            items: { create: itemRows },
          },
          select: { orderCode: true },
        })
      })
      // Analytics: order CODE + coarse totals only — never customer PII.
      await recordDraftOrderCreated({ orderCode: order.orderCode, itemCount, totalMinor: totalAmount })
      // Email foundation (Этап 59A; processing 60A): record an order-confirmation outbox
      // row. NO email is sent (no provider) — the no-send processor settles it to a terminal
      // state such as `skipped_no_provider`. Best-effort: the email helper swallows its own
      // errors, so this can never break a successful checkout. The recipient is stored only
      // if the customer supplied an email.
      await enqueueOrderConfirmationEmail(
        order.orderCode,
        input.customerEmail?.trim() ? input.customerEmail.trim() : null,
      )
      return { ok: true, orderCode: order.orderCode }
    } catch (e) {
      // Lost a stock race (someone else took the last unit while we checked out).
      if (e instanceof OutOfStockError) {
        await recordCheckoutError({ errorType: 'product_unavailable', itemCount })
        return { ok: false, error: `Товар «${e.productName}» закінчився. Оновіть кошик.` }
      }
      // Promo ran out of redemptions between validation and commit (Этап 63A). The whole
      // tx rolled back, so the usedCount increment was undone — nothing is leaked.
      if (e instanceof PromoExhaustedError) {
        await recordCheckoutError({ errorType: 'server', itemCount })
        const msg = 'Промокод більше недоступний. Оформіть замовлення без нього.'
        return { ok: false, error: msg, fieldErrors: { promoCode: msg } }
      }
      if (isUniqueViolation(e) && attempt < 4) continue
      console.error('createOrderDraft failed:', e)
      await recordCheckoutError({ errorType: 'server', itemCount })
      return { ok: false, error: 'Не вдалося створити замовлення. Спробуйте ще раз.' }
    }
  }
  await recordCheckoutError({ errorType: 'server', itemCount })
  return { ok: false, error: 'Не вдалося створити замовлення. Спробуйте ще раз.' }
}
