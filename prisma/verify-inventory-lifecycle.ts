/**
 * AURELIA — Inventory lifecycle (restock on cancel) verification (Этап 28C)
 *
 * Proves the inventory loop closes safely when an order is cancelled:
 *   - a tracked product's stock decrements on order create (28B);
 *   - moving submitted → cancelled AND processing → cancelled RESTORES the
 *     ordered quantity to each tracked product;
 *   - a tracked product with `null` stock stays null (never restocked/resurrected);
 *   - completed orders do NOT restock (terminal, no cancel path);
 *   - an invalid transition (completed → cancelled) is rejected → no restock;
 *   - an already-cancelled order cannot be cancelled/restocked again
 *     (no double restock — guard rejects, and the defensive flip counts 0);
 *   - payment/delivery data (27B) survives cancellation;
 *   - a cancelled order keeps the UAH baseline (27A);
 *   - the 27D/27E needs-attention count (submitted) drops when an order leaves
 *     `submitted` via cancellation.
 *
 * The real restock lives in `updateAdminOrderStatus` (server-only — can't be
 * imported under tsx), so this MIRRORS its exact transaction: a count-guarded
 * `updateMany(where status != cancelled)` flip + a per-tracked-line
 * `updateMany(where stockQuantity not null) { increment }`. Transition legality
 * uses the pure guard. Works only on throwaway `zzz-verify-invlc-` products and
 * `ZZZ-VERIFY-INVLC-` orders, deleted in `finally`. No reset/seed/drop. No
 * secrets printed. Run: npm run db:verify:inventory-lifecycle
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

const PRODUCT_PREFIX = 'zzz-verify-invlc-'
const ORDER_PREFIX = 'ZZZ-VERIFY-INVLC-'
const PAY_DETAILS = 'Новая Почта, отделение №12'

let seq = 0
function uniqueProductSlug(): string {
  return `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
}
function uniqueOrderCode(): string {
  return `${ORDER_PREFIX}${Date.now()}-${seq++}`
}

let categoryId = ''
let categoryName = ''

/** Creates a catalog product with a given stock (null = untracked). Returns id + slug. */
async function createProduct(stockQuantity: number | null): Promise<{ id: string; slug: string }> {
  const slug = uniqueProductSlug()
  const p = await prisma.product.create({
    data: {
      slug,
      name: 'Invlc verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: 'available',
      price: 199000,
      sku: 'AU-INVLC-TEST',
      isPublished: true,
      stockQuantity,
    },
    select: { id: true, slug: true },
  })
  return p
}

/** Mirrors createOrderDraft step 5: race-safe conditional decrement for one tracked line. */
async function decrementOnCreate(id: string, qty: number): Promise<boolean> {
  const res = await prisma.product.updateMany({
    where: { id, stockQuantity: { gte: qty } },
    data: { stockQuantity: { decrement: qty } },
  })
  return res.count === 1
}

/** Creates an order (default submitted) with real OrderItems for the given products. */
async function createOrder(
  status: OrderStatus,
  lines: { productId: string; qty: number }[],
): Promise<string> {
  const orderCode = uniqueOrderCode()
  await prisma.order.create({
    data: {
      orderCode,
      status,
      customerName: 'Invlc Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: PAY_DETAILS,
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
      items: {
        create: lines.map((l) => ({
          productId: l.productId,
          productSlug: 'invlc-snapshot',
          productName: 'Invlc verify товар',
          unitPrice: 199000,
          quantity: l.qty,
          lineTotal: 199000 * l.qty,
        })),
      },
    },
  })
  return orderCode
}

async function stockOf(id: string): Promise<number | null> {
  const r = await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true } })
  return r?.stockQuantity ?? null
}

function needsAttentionCount(): Promise<number> {
  return prisma.order.count({ where: { status: OrderStatus.submitted } })
}

/**
 * Mirrors updateAdminOrderStatus's cancel branch EXACTLY: count-guarded flip to
 * cancelled, then restock each tracked line. Returns the flip count (1 = we owned
 * the cancellation and restocked; 0 = already cancelled, nothing restocked).
 */
async function cancelAndRestock(orderCode: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({
      where: { orderCode, status: { not: OrderStatus.cancelled } },
      data: { status: OrderStatus.cancelled },
    })
    if (flipped.count === 1) {
      const items = await tx.orderItem.findMany({
        where: { order: { orderCode } },
        select: { productId: true, quantity: true },
      })
      for (const item of items) {
        if (!item.productId) continue
        await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: item.quantity } },
        })
      }
    }
    return flipped.count
  })
}

/**
 * Mirrors the admin action: apply the transition guard FIRST, only cancelling
 * when the move is legal. Returns whether a restock-bearing cancel happened.
 */
async function adminCancel(orderCode: string, current: OrderStatus): Promise<boolean> {
  if (!canTransitionOrderStatus(current, OrderStatus.cancelled)) return false
  const flipped = await cancelAndRestock(orderCode)
  return flipped === 1
}

async function main() {
  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // ── Scenario A: submitted → cancelled restores stock (tracked + null mixed) ──
  console.log('submitted → cancelled restores tracked stock; null stays null:')
  const trackedA = await createProduct(5)
  const untrackedA = await createProduct(null)
  const orderA = await createOrder(OrderStatus.submitted, [
    { productId: trackedA.id, qty: 2 },
    { productId: untrackedA.id, qty: 1 },
  ])
  // Decrement-on-create (28B): tracked 5 → 3; null untouched.
  check('decrement on create applies (tracked 5 → 3)', await decrementOnCreate(trackedA.id, 2))
  check('null-stock line not decremented on create', !(await decrementOnCreate(untrackedA.id, 1)))
  check('tracked stock is 3 after create', (await stockOf(trackedA.id)) === 3)
  check('null stock still null after create', (await stockOf(untrackedA.id)) === null)

  const baselineBeforeCancelA = await needsAttentionCount()
  check('submitted order counts toward needs-attention (27D)', baselineBeforeCancelA >= 1)

  check('submitted → cancelled restock happened', await adminCancel(orderA, OrderStatus.submitted))
  check('tracked stock restored 3 → 5', (await stockOf(trackedA.id)) === 5)
  check('null stock NOT restocked (stays null)', (await stockOf(untrackedA.id)) === null)

  const cancelledA = await prisma.order.findUnique({
    where: { orderCode: orderA },
    select: { status: true, currency: true, deliveryMethod: true, deliveryDetails: true, paymentMethod: true },
  })
  check('order status is cancelled', cancelledA?.status === OrderStatus.cancelled)
  check('27A currency still UAH after cancel', cancelledA?.currency === 'UAH')
  check('27B delivery/payment preserved after cancel',
    cancelledA?.deliveryMethod === 'nova_poshta' &&
    cancelledA?.paymentMethod === 'manual_online' &&
    cancelledA?.deliveryDetails === PAY_DETAILS)
  check('needs-attention count dropped after cancel (27E)',
    (await needsAttentionCount()) === baselineBeforeCancelA - 1)

  // ── Scenario A': no double restock on an already-cancelled order ──
  console.log('already-cancelled order cannot be cancelled/restocked again:')
  check('guard rejects cancelled → cancelled', !(await adminCancel(orderA, OrderStatus.cancelled)))
  check('stock unchanged after rejected re-cancel (still 5)', (await stockOf(trackedA.id)) === 5)
  // Defensive layer: even a direct restock call no-ops (flip count 0).
  check('defensive flip counts 0 on already-cancelled', (await cancelAndRestock(orderA)) === 0)
  check('stock STILL 5 after defensive no-op restock', (await stockOf(trackedA.id)) === 5)

  // ── Scenario B: processing → cancelled restores stock ──
  console.log('processing → cancelled restores tracked stock:')
  const trackedB = await createProduct(8)
  const orderB = await createOrder(OrderStatus.submitted, [{ productId: trackedB.id, qty: 3 }])
  await decrementOnCreate(trackedB.id, 3) // 8 → 5
  check('tracked stock is 5 after create', (await stockOf(trackedB.id)) === 5)
  // Admin takes it into processing (allowed setup move), then cancels.
  await prisma.order.update({ where: { orderCode: orderB }, data: { status: OrderStatus.processing } })
  check('processing → cancelled restock happened', await adminCancel(orderB, OrderStatus.processing))
  check('tracked stock restored 5 → 8', (await stockOf(trackedB.id)) === 8)

  // ── Scenario C: completed does NOT restock; invalid transition rejected ──
  console.log('completed does not restock (terminal, invalid cancel):')
  const trackedC = await createProduct(6)
  const orderC = await createOrder(OrderStatus.submitted, [{ productId: trackedC.id, qty: 2 }])
  await decrementOnCreate(trackedC.id, 2) // 6 → 4
  await prisma.order.update({ where: { orderCode: orderC }, data: { status: OrderStatus.processing } })
  await prisma.order.update({ where: { orderCode: orderC }, data: { status: OrderStatus.completed } })
  check('completed → cancelled is REJECTED by guard', !canTransitionOrderStatus('completed', 'cancelled'))
  check('admin cancel of completed does NOT restock', !(await adminCancel(orderC, OrderStatus.completed)))
  check('completed order stock untouched (still 4)', (await stockOf(trackedC.id)) === 4)
  const stillCompleted = await prisma.order.findUnique({
    where: { orderCode: orderC },
    select: { status: true },
  })
  check('completed order stays completed (not flipped)', stillCompleted?.status === OrderStatus.completed)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: restock fires only on transition INTO cancelled; no double/negative restock; null/completed/invalid safe; 27A/27B/27D/27E intact.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway rows (unique prefixes). OrderItems
    // cascade with their order. No reset/seed/drop.
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
