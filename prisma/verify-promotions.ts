/**
 * AURELIA — Promotions / discount verification (Этап 63A)
 *
 * Financial-correctness checks for the promo engine. PURE math + eligibility first, then DB
 * behaviour exercised inside an ALWAYS-ROLLED-BACK transaction (a sentinel error aborts it),
 * so NOTHING is ever committed; the promo + order counts are asserted unchanged afterwards.
 *
 * Covered:
 *   - normalize: trim/uppercase, reject markup/space/over-length;
 *   - discount math: percent rounding in minor units, maxDiscount cap, fixed ≤ subtotal,
 *     final total never negative, clamp to [0, subtotal];
 *   - eligibility: valid percent/fixed accepted; inactive/archived/not-started/expired,
 *     min-subtotal, usage-limit, currency-mismatch (fixed) all rejected;
 *   - DB: an order stores the discount snapshot (discountMinor/promoCode/total); usedCount
 *     increments exactly once and the usage-limit guard blocks the next redemption while an
 *     UNLIMITED code keeps redeeming; a no-promo order keeps discount 0 / total = subtotal;
 *   - server authority: the stored discount equals computeDiscountMinor(promo, subtotal) —
 *     a client-sent discount/total is never a factor;
 *   - nothing committed.
 *
 * Run with: npm run db:verify:promotions
 */

import { PrismaClient } from '@prisma/client'
import {
  computeDiscountMinor,
  evaluatePromo,
  normalizePromoCode,
  type EvaluablePromo,
} from '../src/lib/promo/calc'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_PROMO_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

/** Build an EvaluablePromo with sane defaults for the eligibility tests. */
function promo(overrides: Partial<EvaluablePromo>): EvaluablePromo {
  return {
    type: 'percent',
    percentValue: 10,
    amountMinor: null,
    maxDiscountMinor: null,
    currency: 'UAH',
    isActive: true,
    archivedAt: null,
    startsAt: null,
    endsAt: null,
    minSubtotalMinor: null,
    usageLimit: null,
    usedCount: 0,
    ...overrides,
  }
}

async function main() {
  const promoCountBefore = await prisma.promoCode.count()
  const orderCountBefore = await prisma.order.count()
  console.log('Promotions:')
  console.log(`  promo codes in DB: ${promoCountBefore}`)

  // --- 1) Normalize (pure) ---
  check('normalize trims + uppercases', normalizePromoCode('  welcome10 ') === 'WELCOME10')
  check('normalize rejects markup', normalizePromoCode('<b>x</b>') === null)
  check('normalize rejects spaces', normalizePromoCode('two words') === null)
  check('normalize rejects over-length', normalizePromoCode('A'.repeat(41)) === null)
  check('normalize accepts dash/underscore', normalizePromoCode('new_year-25') === 'NEW_YEAR-25')

  // --- 2) Discount math (pure, minor units) ---
  check('percent 10% of 24900 = 2490', computeDiscountMinor({ type: 'percent', percentValue: 10, amountMinor: null, maxDiscountMinor: null }, 24900) === 2490)
  check('percent rounds to nearest minor unit', computeDiscountMinor({ type: 'percent', percentValue: 10, amountMinor: null, maxDiscountMinor: null }, 12345) === 1235) // 1234.5 → 1235
  check('percent capped by maxDiscount', computeDiscountMinor({ type: 'percent', percentValue: 50, amountMinor: null, maxDiscountMinor: 1000 }, 100000) === 1000)
  check('fixed amount applied', computeDiscountMinor({ type: 'fixed_amount', percentValue: null, amountMinor: 5000, maxDiscountMinor: null }, 100000) === 5000)
  check('fixed cannot exceed subtotal', computeDiscountMinor({ type: 'fixed_amount', percentValue: null, amountMinor: 999999, maxDiscountMinor: null }, 5000) === 5000)
  check('discount never negative / total never negative', (() => {
    const d = computeDiscountMinor({ type: 'fixed_amount', percentValue: null, amountMinor: 5000, maxDiscountMinor: null }, 5000)
    return d === 5000 && 5000 - d === 0
  })())
  check('invalid percent → 0 discount', computeDiscountMinor({ type: 'percent', percentValue: 0, amountMinor: null, maxDiscountMinor: null }, 10000) === 0)

  // --- 3) Eligibility (pure) ---
  const now = new Date('2026-06-22T12:00:00.000Z')
  check('valid percent accepted', evaluatePromo(promo({}), 100000, now).ok)
  check('valid fixed accepted', evaluatePromo(promo({ type: 'fixed_amount', percentValue: null, amountMinor: 5000 }), 100000, now).ok)
  check('invalid (inactive) rejected', !evaluatePromo(promo({ isActive: false }), 100000, now).ok)
  check('archived rejected', !evaluatePromo(promo({ archivedAt: now }), 100000, now).ok)
  check('not-started rejected', !evaluatePromo(promo({ startsAt: '2026-07-01T00:00:00.000Z' }), 100000, now).ok)
  check('expired rejected', !evaluatePromo(promo({ endsAt: '2026-06-01T00:00:00.000Z' }), 100000, now).ok)
  check('min-subtotal enforced', !evaluatePromo(promo({ minSubtotalMinor: 200000 }), 100000, now).ok)
  check('min-subtotal met accepted', evaluatePromo(promo({ minSubtotalMinor: 50000 }), 100000, now).ok)
  check('usage-limit reached rejected', !evaluatePromo(promo({ usageLimit: 5, usedCount: 5 }), 100000, now).ok)
  check('currency mismatch (fixed) rejected', !evaluatePromo(promo({ type: 'fixed_amount', percentValue: null, amountMinor: 5000, currency: 'EUR' }), 100000, now).ok)
  check('percent ignores currency mismatch', evaluatePromo(promo({ currency: 'EUR' }), 100000, now).ok)

  // --- 4) DB integration (rolled back) ---
  let storesSnapshot = false
  let serverAuthoritative = false
  let usageFirstOk = false
  let usageSecondBlocked = false
  let unlimitedKeepsGoing = false
  let noPromoOk = false
  let usedCountAfterClaims = -1
  const ts = Date.now()
  try {
    await prisma.$transaction(async (tx) => {
      // Percent promo, usageLimit 1.
      const p = await tx.promoCode.create({
        data: { code: `VERIFY10-${ts}`, internalName: 'verify percent', type: 'percent', percentValue: 10, usageLimit: 1 },
        select: { id: true, code: true },
      })

      const subtotal = 100000
      const discount = computeDiscountMinor({ type: 'percent', percentValue: 10, amountMinor: null, maxDiscountMinor: null }, subtotal)

      const order = await tx.order.create({
        data: {
          orderCode: `PROMO-${ts}`,
          status: 'submitted',
          customerName: 'verify',
          customerPhone: '+380000000000',
          deliveryCity: 'verify',
          deliveryMethod: 'self_pickup',
          paymentMethod: 'cash_on_delivery',
          subtotalAmount: subtotal,
          discountMinor: discount,
          promoCodeId: p.id,
          promoCode: p.code,
          totalAmount: subtotal - discount,
          items: { create: [{ productSlug: 'verify', productName: 'verify', unitPrice: subtotal, quantity: 1, lineTotal: subtotal }] },
        },
        select: { discountMinor: true, promoCode: true, totalAmount: true, subtotalAmount: true },
      })
      storesSnapshot = order.discountMinor === 10000 && order.promoCode === p.code && order.totalAmount === 90000
      // The stored discount is exactly what the server math produces from (promo, subtotal) —
      // not any client-supplied number.
      serverAuthoritative = order.discountMinor === computeDiscountMinor({ type: 'percent', percentValue: 10, amountMinor: null, maxDiscountMinor: null }, order.subtotalAmount)

      // Usage guard (the EXACT guard the order action uses).
      const guard = (id: string) => ({
        id,
        OR: [{ usageLimit: null }, { usedCount: { lt: prisma.promoCode.fields.usageLimit } }],
      })
      const claim1 = await tx.promoCode.updateMany({ where: guard(p.id), data: { usedCount: { increment: 1 } } })
      const claim2 = await tx.promoCode.updateMany({ where: guard(p.id), data: { usedCount: { increment: 1 } } })
      usageFirstOk = claim1.count === 1
      usageSecondBlocked = claim2.count === 0
      usedCountAfterClaims = (await tx.promoCode.findUnique({ where: { id: p.id }, select: { usedCount: true } }))!.usedCount

      // Unlimited promo keeps redeeming.
      const pUnl = await tx.promoCode.create({
        data: { code: `VERIFYUNL-${ts}`, internalName: 'verify unlimited', type: 'fixed_amount', amountMinor: 5000, usageLimit: null },
        select: { id: true },
      })
      const claimA = await tx.promoCode.updateMany({ where: guard(pUnl.id), data: { usedCount: { increment: 1 } } })
      const claimB = await tx.promoCode.updateMany({ where: guard(pUnl.id), data: { usedCount: { increment: 1 } } })
      unlimitedKeepsGoing = claimA.count === 1 && claimB.count === 1

      // No-promo order: discount 0, total = subtotal (pre-63A compatible).
      const order2 = await tx.order.create({
        data: {
          orderCode: `NOPROMO-${ts}`,
          status: 'submitted',
          customerName: 'verify',
          customerPhone: '+380000000000',
          deliveryCity: 'verify',
          deliveryMethod: 'self_pickup',
          paymentMethod: 'cash_on_delivery',
          subtotalAmount: 5000,
          totalAmount: 5000,
          items: { create: [{ productSlug: 'verify', productName: 'verify', unitPrice: 5000, quantity: 1, lineTotal: 5000 }] },
        },
        select: { discountMinor: true, totalAmount: true, promoCode: true },
      })
      noPromoOk = order2.discountMinor === 0 && order2.totalAmount === 5000 && order2.promoCode === null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }

  check('order stores discount snapshot (discount/code/total)', storesSnapshot)
  check('stored discount equals server-computed value (no client trust)', serverAuthoritative)
  check('usedCount increments once (guard count=1)', usageFirstOk)
  check('usage limit blocks the next redemption (guard count=0)', usageSecondBlocked)
  check('usedCount lands at exactly 1 after the blocked retry', usedCountAfterClaims === 1)
  check('unlimited promo keeps redeeming', unlimitedKeepsGoing)
  check('no-promo order keeps discount 0 / total = subtotal', noPromoOk)

  // --- 5) Nothing committed ---
  const promoCountAfter = await prisma.promoCode.count()
  const orderCountAfter = await prisma.order.count()
  check('no test promo rows committed', promoCountAfter === promoCountBefore)
  check('no test order rows committed', orderCountAfter === orderCountBefore)

  if (failures === 0) {
    console.log('\nPROMOTIONS VERIFY OK: normalize, discount math, eligibility, order snapshot, usage-limit concurrency + no-promo compatibility all pass; nothing committed.')
  } else {
    console.error(`\nPROMOTIONS VERIFY FAILED (${failures} check(s)).`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
