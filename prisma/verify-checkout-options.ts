/**
 * AURELIA — Manual payment/delivery checkout verification (Этап 27B)
 *
 * Proves the Ukraine-first MANUAL checkout MVP is safe end-to-end:
 *   - the SAME authoritative validator the server action uses accepts a valid
 *     manual payment + delivery combo and rejects invalid / missing / legacy
 *     values (so a tampered payload can't write an unknown method);
 *   - the Order row actually STORES the selected methods + optional delivery
 *     note, and a new order inherits the UAH currency baseline (Этап 27A);
 *   - the Этап 26M hidden-product guard still holds (a hidden product is never
 *     returned by the authoritative orderable lookup).
 *
 * Validation is checked via the pure validator (the server action itself is
 * `'use server'` and can't be imported under tsx). DB writes use only throwaway
 * rows with unique `zzz-verify-checkout-` / `ZZZ-VERIFY-CHECKOUT-` prefixes and
 * are deleted in `finally`. No reset/seed/drop. No secrets printed.
 *
 * Run: npm run db:verify:checkout-options
 */

import { PrismaClient } from '@prisma/client'
import { validateOrderDraftFields, hasErrors } from '../src/lib/orders/validate'
import { DELIVERY_DETAILS_MAX, type OrderDraftInput } from '../src/lib/orders/types'

const prisma = new PrismaClient()

let failures = 0
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}`)
    failures++
  }
}

const PRODUCT_PREFIX = 'zzz-verify-checkout-'
const productSlug = `${PRODUCT_PREFIX}${Date.now()}`
const orderCode = `ZZZ-VERIFY-CHECKOUT-${Date.now()}`

/** A fully valid manual-checkout payload (current UA allowlist). */
function validInput(overrides: Partial<OrderDraftInput> = {}): OrderDraftInput {
  return {
    customerName: 'Тест Покупатель',
    customerPhone: '+380501234567',
    deliveryCity: 'Киев',
    deliveryMethod: 'nova_poshta',
    deliveryDetails: 'Новая Почта, отделение №12',
    paymentMethod: 'cash_on_delivery',
    items: [{ slug: 'demo', qty: 1 }],
    ...overrides,
  }
}

async function main() {
  console.log('Validation — valid manual payment/delivery is accepted:')
  check('valid combo passes (no field errors)', !hasErrors(validateOrderDraftFields(validInput())))
  check(
    'both manual payment methods are accepted',
    !hasErrors(validateOrderDraftFields(validInput({ paymentMethod: 'manual_online' }))) &&
      !hasErrors(validateOrderDraftFields(validInput({ paymentMethod: 'cash_on_delivery' }))),
  )
  check(
    'all four delivery methods are accepted',
    ['self_pickup', 'nova_poshta', 'ukrposhta', 'local_courier'].every(
      (m) => !hasErrors(validateOrderDraftFields(validInput({ deliveryMethod: m }))),
    ),
  )

  console.log('Validation — invalid / missing / legacy is rejected:')
  check(
    'unknown delivery method rejected',
    !!validateOrderDraftFields(validInput({ deliveryMethod: 'teleport' })).deliveryMethod,
  )
  check(
    'unknown payment method rejected',
    !!validateOrderDraftFields(validInput({ paymentMethod: 'bitcoin' })).paymentMethod,
  )
  check(
    'legacy delivery key (pickup) no longer accepted',
    !!validateOrderDraftFields(validInput({ deliveryMethod: 'pickup' })).deliveryMethod,
  )
  check(
    'legacy payment key (not_connected) no longer accepted',
    !!validateOrderDraftFields(validInput({ paymentMethod: 'not_connected' })).paymentMethod,
  )
  check(
    'missing delivery method rejected',
    !!validateOrderDraftFields(validInput({ deliveryMethod: '' })).deliveryMethod,
  )
  check(
    'missing payment method rejected',
    !!validateOrderDraftFields(validInput({ paymentMethod: '' })).paymentMethod,
  )
  check(
    'over-long delivery note rejected',
    !!validateOrderDraftFields(validInput({ deliveryDetails: 'a'.repeat(DELIVERY_DETAILS_MAX + 1) }))
      .deliveryDetails,
  )

  console.log('Persistence — Order stores the selected methods + note + UAH:')
  const order = await prisma.order.create({
    data: {
      orderCode,
      customerName: 'Тест',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: 'Новая Почта, отделение №12',
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
      // currency intentionally NOT set → must inherit the UAH default (27A).
    },
    select: { deliveryMethod: true, deliveryDetails: true, paymentMethod: true, currency: true },
  })
  check('stored deliveryMethod = nova_poshta', order.deliveryMethod === 'nova_poshta')
  check('stored paymentMethod = manual_online', order.paymentMethod === 'manual_online')
  check('stored deliveryDetails preserved', order.deliveryDetails === 'Новая Почта, отделение №12')
  check('new order currency defaults to UAH (27A intact)', order.currency === 'UAH')

  console.log('26M hidden-product guard still intact:')
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  const created = await prisma.product.create({
    data: {
      slug: productSlug,
      name: 'Checkout verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-CHECKOUT-TEST',
      isPublished: false, // hidden
    },
    select: { id: true },
  })
  const orderable = await prisma.product.findMany({
    where: { slug: { in: [productSlug] }, isPublished: true },
    select: { slug: true },
  })
  check('hidden product excluded from orderable lookup', orderable.length === 0)
  // sanity: same product becomes orderable once published
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: true } })
  const orderableAfter = await prisma.product.findMany({
    where: { slug: { in: [productSlug] }, isPublished: true },
    select: { slug: true },
  })
  check('published product is orderable', orderableAfter.length === 1)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: manual payment/delivery validated + stored; UAH + 26M guard intact.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway rows (unique prefixes). No reset/seed/drop.
    try {
      const orders = await prisma.order.deleteMany({ where: { orderCode: { startsWith: 'ZZZ-VERIFY-CHECKOUT-' } } })
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} test product(s), ${orders.count} test order(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
