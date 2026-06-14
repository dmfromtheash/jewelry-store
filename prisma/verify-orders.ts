/**
 * AURELIA — Order schema verification (Этап 16A)
 *
 * Non-destructive backend check for the order draft tables:
 *   - Order / OrderItem models are accessible (counts succeed)
 *   - the create path works, exercised inside a transaction that is ALWAYS
 *     rolled back (a sentinel error aborts it) — so NO order is ever committed.
 *
 * No deleteMany, no raw SQL, no committed test data. Read-mostly + rollback.
 *
 * Run with: npm run db:verify:orders
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ROLLBACK_SENTINEL = '__AURELIA_ORDER_SMOKE_ROLLBACK__'

async function main() {
  const orderCount = await prisma.order.count()
  const itemCount = await prisma.orderItem.count()

  console.log('Order tables:')
  console.log(`  orders:      ${orderCount}`)
  console.log(`  order items: ${itemCount}`)

  // Exercise the create path WITHOUT committing: create inside a transaction,
  // then throw the sentinel to force a full rollback.
  let createPathOk = false
  try {
    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          orderCode: `SMOKE-${Date.now()}`,
          status: 'draft',
          customerName: 'smoke-test',
          customerPhone: '+70000000000',
          deliveryCity: 'smoke',
          deliveryMethod: 'pickup',
          paymentMethod: 'not_connected',
          subtotalAmount: 0,
          totalAmount: 0,
          items: {
            create: [
              {
                productSlug: 'smoke',
                productName: 'smoke',
                unitPrice: 0,
                quantity: 1,
                lineTotal: 0,
              },
            ],
          },
        },
      })
      throw new Error(ROLLBACK_SENTINEL)
    })
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK_SENTINEL) {
      createPathOk = true // transaction rolled back as intended
    } else {
      throw e
    }
  }

  // Confirm nothing was committed by the smoke.
  const orderCountAfter = await prisma.order.count()
  const committedNothing = orderCountAfter === orderCount

  console.log(`  create-path (rolled back): ${createPathOk ? 'OK' : 'FAIL'}`)
  console.log(`  no test data committed:    ${committedNothing ? 'OK' : 'FAIL'}`)

  if (createPathOk && committedNothing) {
    console.log('\nORDERS VERIFY OK: order tables accessible; create path works (rolled back).')
  } else {
    console.error('\nORDERS VERIFY FAILED')
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
