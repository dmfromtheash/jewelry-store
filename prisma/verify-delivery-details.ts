/**
 * AURELIA — Manual delivery details verification (Этап 59A)
 *
 * Non-destructive checks for the manual branch/department + comment fields. Pure
 * validation, plus DB persistence/read-back inside ALWAYS-ROLLED-BACK transactions
 * (a sentinel error aborts each tx) so NOTHING is ever committed; the order count is
 * asserted unchanged afterwards.
 *
 * Covered:
 *   - valid branch/comment accepted; unsafe HTML/script in either field rejected;
 *     over-length branch/comment rejected; a full valid draft (with the new fields) passes;
 *   - DB (rolled back): an order persists deliveryBranch + deliveryComment and reads them
 *     back; a GUEST order (customerId null) with the new fields still works;
 *   - NO carrier API is involved anywhere (these are plain typed fields only).
 *
 * Run with: npm run db:verify:delivery-details
 */

import { PrismaClient } from '@prisma/client'
import { validateOrderDraftFields } from '../src/lib/orders/validate'
import { DELIVERY_BRANCH_MAX, DELIVERY_COMMENT_MAX, type OrderDraftInput } from '../src/lib/orders/types'
import { methodUsesBranch } from '../src/lib/orders/delivery'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_DELIVERY_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

/** A valid base draft (no items issues) we vary the delivery fields on. */
function draft(extra: Partial<OrderDraftInput>): OrderDraftInput {
  return {
    customerName: 'Verify',
    customerPhone: '+380501112233',
    deliveryCity: 'Kyiv',
    deliveryMethod: 'nova_poshta',
    paymentMethod: 'cash_on_delivery',
    items: [{ slug: 'x', qty: 1 }],
    ...extra,
  }
}

async function main() {
  const orderCountBefore = await prisma.order.count()
  console.log('Delivery details:')
  console.log(`  orders in DB: ${orderCountBefore}`)

  // --- 1) Validation (pure) ---
  check('valid branch + comment accepted', Object.keys(
    validateOrderDraftFields(draft({ deliveryBranch: 'Відділення №12', deliveryComment: 'Подзвоніть перед доставкою' })),
  ).length === 0)
  check('empty branch + comment accepted (optional)', Object.keys(
    validateOrderDraftFields(draft({ deliveryBranch: '', deliveryComment: '' })),
  ).length === 0)
  check('unsafe HTML in branch rejected', !!validateOrderDraftFields(draft({ deliveryBranch: '<script>x</script>' })).deliveryBranch)
  check('unsafe HTML in comment rejected', !!validateOrderDraftFields(draft({ deliveryComment: '<img src=x onerror=1>' })).deliveryComment)
  check('javascript: payload in branch rejected', !!validateOrderDraftFields(draft({ deliveryBranch: 'javascript:alert(1)' })).deliveryBranch)
  check('over-length branch rejected', !!validateOrderDraftFields(draft({ deliveryBranch: 'a'.repeat(DELIVERY_BRANCH_MAX + 1) })).deliveryBranch)
  check('over-length comment rejected', !!validateOrderDraftFields(draft({ deliveryComment: 'a'.repeat(DELIVERY_COMMENT_MAX + 1) })).deliveryComment)

  // --- 1b) Branch-hint helper (pure, UI-only, no carrier call) ---
  check('methodUsesBranch true for nova_poshta/ukrposhta', methodUsesBranch('nova_poshta') && methodUsesBranch('ukrposhta'))
  check('methodUsesBranch false for self_pickup + unknown', !methodUsesBranch('self_pickup') && !methodUsesBranch('not_a_method'))

  // --- 2) DB: persistence + read-back, guest preserved (rolled back) ---
  let persistsFields = false
  let guestStillWorks = false
  const baseOrder = {
    status: 'submitted' as const,
    customerName: 'Verify',
    customerPhone: '+380501112233',
    deliveryCity: 'Kyiv',
    deliveryMethod: 'nova_poshta',
    paymentMethod: 'cash_on_delivery',
    subtotalAmount: 0,
    totalAmount: 0,
  }
  const tag = Math.random().toString(36).slice(2, 8)
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          ...baseOrder,
          orderCode: `VERIFY-DLV-${tag}`,
          deliveryBranch: 'Відділення №7',
          deliveryComment: 'Залишити у відділенні',
        },
        select: { customerId: true, deliveryBranch: true, deliveryComment: true },
      })
      persistsFields =
        created.deliveryBranch === 'Відділення №7' &&
        created.deliveryComment === 'Залишити у відділенні' &&
        created.customerId === null

      // A guest order (no customerId) with the new fields still persists.
      const guest = await tx.order.create({
        data: { ...baseOrder, orderCode: `VERIFY-DLV-G-${tag}`, deliveryBranch: 'Самовивіз центр' },
        select: { customerId: true, deliveryBranch: true },
      })
      guestStillWorks = guest.customerId === null && guest.deliveryBranch === 'Самовивіз центр'

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('order persists + reads back branch & comment', persistsFields)
  check('guest order with delivery fields still works', guestStillWorks)

  // --- 3) Nothing committed ---
  const orderCountAfter = await prisma.order.count()
  check('no test orders committed', orderCountAfter === orderCountBefore)

  if (failures === 0) {
    console.log('\nDELIVERY DETAILS VERIFY OK: validation + persistence pass; guest checkout preserved; no carrier API; nothing committed.')
  } else {
    console.error(`\nDELIVERY DETAILS VERIFY FAILED (${failures} check(s)).`)
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
