/**
 * AURELIA — Admin order management verification (Этап 17A)
 *
 * Non-destructive check for the admin order screens' data path:
 *   - Order table is readable (count)
 *   - the OrderStatus enum values are available
 *   - if any order exists, it can be read back by orderCode (the detail read)
 *
 * No writes, no deletes, no raw SQL, no test data. Read-only.
 *
 * Run with: npm run db:verify:admin-orders
 */

import { OrderStatus, PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const EXPECTED_STATUSES = ['draft', 'submitted', 'cancelled']

async function main() {
  const orderCount = await prisma.order.count()
  const statuses = Object.values(OrderStatus)

  console.log('Admin orders check:')
  console.log(`  orders:   ${orderCount}`)
  console.log(`  statuses: ${statuses.join(', ')}`)

  const problems: string[] = []

  for (const s of EXPECTED_STATUSES) {
    if (!statuses.includes(s as OrderStatus)) problems.push(`missing OrderStatus '${s}'`)
  }

  if (orderCount > 0) {
    const first = await prisma.order.findFirst({ select: { orderCode: true } })
    const one = first
      ? await prisma.order.findUnique({
          where: { orderCode: first.orderCode },
          select: { orderCode: true, status: true, _count: { select: { items: true } } },
        })
      : null
    if (!one) {
      problems.push('could not read an existing order by orderCode')
    } else {
      console.log(`  read-by-code: ${one.orderCode} status=${one.status} items=${one._count.items}`)
    }
  } else {
    console.log('  read-by-code: skipped (no orders yet)')
  }

  if (problems.length === 0) {
    console.log('\nADMIN ORDERS VERIFY OK: order table + statuses accessible.')
  } else {
    console.error('\nADMIN ORDERS VERIFY FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
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
