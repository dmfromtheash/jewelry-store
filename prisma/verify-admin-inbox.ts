/**
 * AURELIA — Admin new-orders inbox / owner-attention verification (Этап 27D)
 *
 * Proves the "needs attention" inbox is correct and non-breaking:
 *   - a NEW order (status `submitted`, exactly what createOrderDraft produces)
 *     is counted in the needs-attention total;
 *   - after its status moves on (`submitted → cancelled`, an allowed transition)
 *     it DROPS OUT of the needs-attention total;
 *   - the admin list + detail query shapes still work (no break);
 *   - the order keeps its Этап 27B payment/delivery data;
 *   - a new order keeps the Этап 27A UAH baseline.
 *
 * Mirrors the server-only reads with the SAME Prisma shapes (admin/orders.ts is
 * `'use server'`-adjacent / `server-only`, so it can't be imported under tsx) and
 * uses the pure transition guard to assert the lifecycle move is legal. Works
 * only on a throwaway `ZZZ-VERIFY-INBOX-` order, deleted in `finally`. No
 * reset/seed/drop. No secrets printed. Run: npm run db:verify:admin-inbox
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

const PREFIX = 'ZZZ-VERIFY-INBOX-'
const orderCode = `${PREFIX}${Date.now()}`

/** Mirrors getNeedsAttentionOrderCount(): count of orders awaiting action. */
function needsAttentionCount(): Promise<number> {
  return prisma.order.count({ where: { status: OrderStatus.submitted } })
}

async function main() {
  const baseline = await needsAttentionCount()

  console.log('A new (submitted) order enters the needs-attention inbox:')
  await prisma.order.create({
    data: {
      orderCode,
      status: OrderStatus.submitted, // what checkout produces
      customerName: 'Inbox Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: 'Новая Почта, отделение №7',
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
      // currency intentionally NOT set → must inherit UAH default (27A).
    },
  })
  const afterCreate = await needsAttentionCount()
  check('needs-attention count increments for a new order', afterCreate === baseline + 1)

  console.log('27B payment/delivery + 27A UAH preserved on the order:')
  // Same select shape the admin detail read uses (getAdminOrderByCode subset).
  const detail = await prisma.order.findUnique({
    where: { orderCode },
    select: {
      orderCode: true,
      status: true,
      deliveryMethod: true,
      deliveryDetails: true,
      paymentMethod: true,
      currency: true,
      items: { select: { productName: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  check('admin detail query returns the order', detail?.orderCode === orderCode)
  check('deliveryMethod preserved', detail?.deliveryMethod === 'nova_poshta')
  check('paymentMethod preserved', detail?.paymentMethod === 'manual_online')
  check('deliveryDetails preserved', detail?.deliveryDetails === 'Новая Почта, отделение №7')
  check('new order currency is UAH (27A intact)', detail?.currency === 'UAH')

  console.log('Admin list query (inbox filter) still works and includes it:')
  // Same select shape getAdminOrders uses, filtered to the inbox status.
  const list = await prisma.order.findMany({
    where: { status: OrderStatus.submitted },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      orderCode: true,
      status: true,
      customerName: true,
      deliveryCity: true,
      deliveryMethod: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  })
  check('inbox list includes the new order', list.some((o) => o.orderCode === orderCode))

  console.log('Processing the order removes it from the inbox:')
  check('submitted → cancelled is an allowed transition', canTransitionOrderStatus('submitted', 'cancelled'))
  await prisma.order.update({ where: { orderCode }, data: { status: OrderStatus.cancelled } })
  const afterCancel = await needsAttentionCount()
  check('needs-attention count returns to baseline after processing', afterCancel === baseline)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: new orders surface in the inbox and clear after processing; 27A/27B intact.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway order (unique prefix). No reset/seed/drop.
    try {
      const removed = await prisma.order.deleteMany({ where: { orderCode: { startsWith: PREFIX } } })
      console.log(`Cleanup: removed ${removed.count} test order(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
