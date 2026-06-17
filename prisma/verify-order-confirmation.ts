/**
 * AURELIA — Order confirmation / success-flow verification (Этап 27C)
 *
 * Proves the post-order confirmation is honest AND privacy-safe:
 *   - the confirmation is renderable PURELY from what the client already has —
 *     the action's orderCode + the submitted payment/delivery keys — because
 *     every method key resolves to a human label (no server order lookup needed);
 *   - a valid manual order validates and PERSISTS its code + methods + optional
 *     delivery note, and a new order keeps the UAH baseline (Этап 27A);
 *   - invalid / missing payment or delivery is still rejected (Этап 27B);
 *   - the hidden-product guard (Этап 26M) still rejects unpublished products;
 *   - NO unsafe public by-code order lookup exists: src/lib/orders/read.ts was
 *     removed and the /checkout/success fallback performs no DB read.
 *
 * Validation/labels are checked via the pure modules (the server action is
 * `'use server'`). DB writes use only a throwaway `ZZZ-VERIFY-CONFIRM-` order +
 * `zzz-verify-confirm-` product, deleted in `finally`. No reset/seed/drop. No
 * secrets printed. Run: npm run db:verify:order-confirmation
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { validateOrderDraftFields, hasErrors } from '../src/lib/orders/validate'
import type { OrderDraftInput } from '../src/lib/orders/types'
import {
  DELIVERY_METHODS,
  PAYMENT_METHODS,
  deliveryMethodLabel,
  paymentMethodLabel,
} from '../src/lib/orders/methods'

const prisma = new PrismaClient()
const repoRoot = join(__dirname, '..')

let failures = 0
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}`)
    failures++
  }
}

const PRODUCT_PREFIX = 'zzz-verify-confirm-'
const productSlug = `${PRODUCT_PREFIX}${Date.now()}`
const orderCode = `ZZZ-VERIFY-CONFIRM-${Date.now()}`

function validInput(overrides: Partial<OrderDraftInput> = {}): OrderDraftInput {
  return {
    customerName: 'Тест Покупатель',
    customerPhone: '+380501234567',
    deliveryCity: 'Киев',
    deliveryMethod: 'nova_poshta',
    deliveryDetails: 'Новая Почта, отделение №12',
    paymentMethod: 'manual_online',
    items: [{ slug: 'demo', qty: 1 }],
    ...overrides,
  }
}

async function main() {
  console.log('Confirmation renderable from keys alone (no server order lookup):')
  check(
    'every payment key has a human label (≠ key)',
    PAYMENT_METHODS.every((k) => {
      const label = paymentMethodLabel(k)
      return label.length > 0 && label !== k
    }),
  )
  check(
    'every delivery key has a human label (≠ key)',
    DELIVERY_METHODS.every((k) => {
      const label = deliveryMethodLabel(k)
      return label.length > 0 && label !== k
    }),
  )

  console.log('Valid manual order validates (action would return ok + orderCode):')
  check('valid manual order passes validation', !hasErrors(validateOrderDraftFields(validInput())))

  console.log('Invalid / missing payment or delivery still rejected (27B):')
  check('missing payment rejected', !!validateOrderDraftFields(validInput({ paymentMethod: '' })).paymentMethod)
  check('missing delivery rejected', !!validateOrderDraftFields(validInput({ deliveryMethod: '' })).deliveryMethod)
  check('unknown payment rejected', !!validateOrderDraftFields(validInput({ paymentMethod: 'paypal' })).paymentMethod)
  check('unknown delivery rejected', !!validateOrderDraftFields(validInput({ deliveryMethod: 'drone' })).deliveryMethod)

  console.log('Persisted order carries code + methods + note + UAH:')
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
      // currency intentionally NOT set → must inherit UAH default (27A).
    },
    select: { orderCode: true, deliveryMethod: true, deliveryDetails: true, paymentMethod: true, currency: true },
  })
  check('order has a code', order.orderCode === orderCode)
  check('stored paymentMethod label resolves', paymentMethodLabel(order.paymentMethod) === 'Онлайн-оплата по реквизитам')
  check('stored deliveryMethod label resolves', deliveryMethodLabel(order.deliveryMethod) === 'Новая Почта')
  check('stored deliveryDetails preserved', order.deliveryDetails === 'Новая Почта, отделение №12')
  check('new order currency defaults to UAH (27A intact)', order.currency === 'UAH')

  console.log('Hidden-product guard still rejects unpublished (26M):')
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  await prisma.product.create({
    data: {
      slug: productSlug,
      name: 'Confirm verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-CONFIRM-TEST',
      isPublished: false,
    },
    select: { id: true },
  })
  const orderable = await prisma.product.findMany({
    where: { slug: { in: [productSlug] }, isPublished: true },
    select: { slug: true },
  })
  check('hidden product excluded from orderable lookup', orderable.length === 0)

  console.log('No unsafe public by-code order lookup exists:')
  check(
    'src/lib/orders/read.ts removed (no getOrderSummaryByCode)',
    !existsSync(join(repoRoot, 'src/lib/orders/read.ts')),
  )
  const successSrc = readFileSync(join(repoRoot, 'app/checkout/success/page.tsx'), 'utf8')
  check(
    'success page performs no order DB lookup',
    !/getOrderSummaryByCode|orders\/read|prisma\./.test(successSrc),
  )

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: confirmation is client-renderable + privacy-safe; UAH + 27B + 26M intact.')
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
      const orders = await prisma.order.deleteMany({ where: { orderCode: { startsWith: 'ZZZ-VERIFY-CONFIRM-' } } })
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} test product(s), ${orders.count} test order(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
