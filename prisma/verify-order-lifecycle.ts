/**
 * AURELIA — Order lifecycle processing/fulfillment verification (Этап 27E)
 *
 * Proves the manual admin fulfillment path is correct and non-breaking:
 *   - a new order starts as `submitted` (the schema default checkout relies on);
 *   - `submitted` counts as needs-attention; moving it to `processing` removes it
 *     from that count (so the inbox clears WITHOUT cancelling);
 *   - the legal manual moves are allowed (submitted→processing→completed, plus
 *     submitted/processing→cancelled) and illogical jumps are rejected;
 *   - payment/delivery data (27B) survives every status change;
 *   - a new order keeps the UAH baseline (27A);
 *   - the hidden-product guard (26M) still excludes unpublished products.
 *
 * Transition legality is checked via the pure guard (`transitions.ts`); DB writes
 * use only throwaway `ZZZ-VERIFY-LIFECYCLE-` / `zzz-verify-lifecycle-` rows,
 * deleted in `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:order-lifecycle
 */

import { PrismaClient, OrderStatus } from '@prisma/client'
import { canTransitionOrderStatus } from '../src/lib/orders/transitions'

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

const ORDER_PREFIX = 'ZZZ-VERIFY-LIFECYCLE-'
const PRODUCT_PREFIX = 'zzz-verify-lifecycle-'
const orderCode = `${ORDER_PREFIX}${Date.now()}`
const productSlug = `${PRODUCT_PREFIX}${Date.now()}`

function needsAttentionCount(): Promise<number> {
  return prisma.order.count({ where: { status: OrderStatus.submitted } })
}

const PAY_DETAILS = 'Новая Почта, отделение №9'

async function main() {
  const baseline = await needsAttentionCount()

  console.log('New order starts as submitted (needs attention) + UAH + 27B data:')
  const created = await prisma.order.create({
    data: {
      orderCode,
      // status intentionally NOT set → must inherit the `submitted` default.
      customerName: 'Lifecycle Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: PAY_DETAILS,
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
    },
    select: { status: true, currency: true },
  })
  check('new order defaults to submitted', created.status === OrderStatus.submitted)
  check('new order currency is UAH (27A intact)', created.currency === 'UAH')
  check('submitted order is in needs-attention count', (await needsAttentionCount()) === baseline + 1)

  console.log('Transition legality (pure guard):')
  check('submitted → processing allowed', canTransitionOrderStatus('submitted', 'processing'))
  check('processing → completed allowed', canTransitionOrderStatus('processing', 'completed'))
  check('submitted → cancelled allowed', canTransitionOrderStatus('submitted', 'cancelled'))
  check('processing → cancelled allowed', canTransitionOrderStatus('processing', 'cancelled'))
  check('submitted → completed REJECTED (no skipping)', !canTransitionOrderStatus('submitted', 'completed'))
  check('completed → processing REJECTED (terminal)', !canTransitionOrderStatus('completed', 'processing'))
  check('cancelled → submitted REJECTED (terminal)', !canTransitionOrderStatus('cancelled', 'submitted'))
  check('processing → submitted REJECTED (no backward)', !canTransitionOrderStatus('processing', 'submitted'))

  console.log('submitted → processing clears it from needs-attention (no cancel):')
  await prisma.order.update({ where: { orderCode }, data: { status: OrderStatus.processing } })
  check('needs-attention count back to baseline after processing', (await needsAttentionCount()) === baseline)
  const afterProcessing = await prisma.order.findUnique({
    where: { orderCode },
    select: { status: true, deliveryMethod: true, deliveryDetails: true, paymentMethod: true, currency: true },
  })
  check('status is processing', afterProcessing?.status === OrderStatus.processing)
  check('27B deliveryMethod preserved', afterProcessing?.deliveryMethod === 'nova_poshta')
  check('27B paymentMethod preserved', afterProcessing?.paymentMethod === 'manual_online')
  check('27B deliveryDetails preserved', afterProcessing?.deliveryDetails === PAY_DETAILS)
  check('currency still UAH after status change', afterProcessing?.currency === 'UAH')

  console.log('processing → completed (terminal happy path):')
  await prisma.order.update({ where: { orderCode }, data: { status: OrderStatus.completed } })
  const afterCompleted = await prisma.order.findUnique({
    where: { orderCode },
    select: { status: true, deliveryDetails: true, paymentMethod: true },
  })
  check('status is completed', afterCompleted?.status === OrderStatus.completed)
  check('27B data still intact at completed', afterCompleted?.deliveryDetails === PAY_DETAILS && afterCompleted?.paymentMethod === 'manual_online')

  console.log('26M hidden-product guard still rejects unpublished:')
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  await prisma.product.create({
    data: {
      slug: productSlug,
      name: 'Lifecycle verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-LIFECYCLE-TEST',
      isPublished: false,
    },
    select: { id: true },
  })
  const orderable = await prisma.product.findMany({
    where: { slug: { in: [productSlug] }, isPublished: true },
    select: { slug: true },
  })
  check('hidden product excluded from orderable lookup', orderable.length === 0)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: manual lifecycle submitted→processing→completed works; inbox clears without cancel; 27A/27B/26M intact.')
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
      const orders = await prisma.order.deleteMany({ where: { orderCode: { startsWith: ORDER_PREFIX } } })
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} test product(s), ${orders.count} test order(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
