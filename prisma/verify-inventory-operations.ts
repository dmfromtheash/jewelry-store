/**
 * AURELIA — Inventory & stock operations verification (Этап 70A)
 *
 * Proves the inventory operations superblock is safe end-to-end:
 *   - Stock HEALTH classification (pure): untracked / out / low / healthy / negative + thresholds.
 *   - Manual ADJUSTMENT validation (pure): integer-only, no-NaN, no-negative-final, no delta vs an
 *     untracked level, set-from-untracked, no-op rejection, and a safe (length-capped, markup-free)
 *     note.
 *   - Manual adjustment DB path (mirrors the action's race-safe conditional update + movement
 *     record in ONE tx): stock changes, a movement row is recorded with the right delta/before/
 *     after, product vs variant levels are ISOLATED, and a failed tx rolls BOTH back (no orphan
 *     movement, stock unchanged).
 *   - ORDER integration (mirrors createOrderDraft + updateAdminOrderStatus): an order-create
 *     decrement records an `order_created` movement, a cancel restock records an
 *     `order_cancelled_restock` movement, and a failed tx rolls the movement back with the stock.
 *   - DASHBOARD attention (pure): zero/low purchasable stock surface as `warn` items linking to
 *     /admin/inventory.
 *
 * Server-only modules (the action) can't be imported under tsx, so the DB paths MIRROR them using
 * the SHARED pure helper `buildMovementInput` — keeping the mirror honest. Works only on throwaway
 * `zzz-verify-invops-` products / `ZZZ-VERIFY-INVOPS-` orders, with every movement row they create
 * deleted in `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:inventory-operations
 */

import { PrismaClient, OrderStatus } from '@prisma/client'
import {
  classifyStock,
  isAttentionState,
  parseAdjustment,
  LOW_STOCK_THRESHOLD,
} from '../src/lib/inventory/stock-health'
import { buildMovementInput } from '../src/lib/inventory/movements'
import { buildAttentionQueue, type AttentionInput } from '../src/lib/admin/operations-dashboard'

const prisma = new PrismaClient()

let failures = 0
function check(name: string, cond: boolean) {
  if (cond) console.log(`  ✓ ${name}`)
  else {
    console.error(`  ✗ ${name}`)
    failures++
  }
}

const PRODUCT_PREFIX = 'zzz-verify-invops-'
const ORDER_PREFIX = 'ZZZ-VERIFY-INVOPS-'
let seq = 0
const productSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
const orderCode = () => `${ORDER_PREFIX}${Date.now()}-${seq++}`

const createdProductIds: string[] = []
const createdVariantIds: string[] = []

let categoryId = ''
let categoryName = ''

async function createProduct(stockQuantity: number | null): Promise<{ id: string; slug: string }> {
  const slug = productSlug()
  const p = await prisma.product.create({
    data: {
      slug,
      name: 'Invops verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: 'available',
      price: 199000,
      sku: 'AU-INVOPS-TEST',
      isPublished: true,
      stockQuantity,
    },
    select: { id: true, slug: true },
  })
  createdProductIds.push(p.id)
  return p
}

async function createVariant(productId: string, stockQuantity: number | null): Promise<string> {
  const v = await prisma.productVariant.create({
    data: { productId, name: 'coating', value: `inv-${seq++}`, stockQuantity, isDefault: true },
    select: { id: true },
  })
  createdVariantIds.push(v.id)
  return v.id
}

async function productStock(id: string): Promise<number | null> {
  const r = await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true } })
  return r?.stockQuantity ?? null
}
async function variantStock(id: string): Promise<number | null> {
  const r = await prisma.productVariant.findUnique({ where: { id }, select: { stockQuantity: true } })
  return r?.stockQuantity ?? null
}
function movementCountFor(productId: string): Promise<number> {
  return prisma.inventoryStockMovement.count({ where: { productId } })
}

/** Mirrors adjustStockAction's tx: race-safe conditional update on the exact pre-value + movement. */
async function applyManualAdjustment(
  level: 'product' | 'variant',
  targetId: string,
  productId: string,
  before: number | null,
  newValue: number,
  delta: number,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const res =
      level === 'product'
        ? await tx.product.updateMany({ where: { id: targetId, stockQuantity: before }, data: { stockQuantity: newValue } })
        : await tx.productVariant.updateMany({ where: { id: targetId, stockQuantity: before }, data: { stockQuantity: newValue } })
    if (res.count !== 1) return false
    await tx.inventoryStockMovement.create({
      data: buildMovementInput({
        level,
        delta,
        reason: 'manual_adjustment',
        productId,
        variantId: level === 'variant' ? targetId : null,
        quantityBefore: before,
        quantityAfter: newValue,
        actorLabel: 'verify',
        note: 'invops note',
      }),
    })
    return true
  })
}

async function main() {
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // ── 1) Stock-health classification (pure) ──
  console.log('Stock-health classification:')
  check('null → untracked', classifyStock(null) === 'untracked')
  check('undefined → untracked', classifyStock(undefined) === 'untracked')
  check('-1 → negative', classifyStock(-1) === 'negative')
  check('0 → out', classifyStock(0) === 'out')
  check('1 → low', classifyStock(1) === 'low')
  check(`${LOW_STOCK_THRESHOLD} (threshold) → low`, classifyStock(LOW_STOCK_THRESHOLD) === 'low')
  check(`${LOW_STOCK_THRESHOLD + 1} → healthy`, classifyStock(LOW_STOCK_THRESHOLD + 1) === 'healthy')
  check('out/low/negative are attention states', isAttentionState('out') && isAttentionState('low') && isAttentionState('negative'))
  check('healthy/untracked are NOT attention states', !isAttentionState('healthy') && !isAttentionState('untracked'))

  // ── 2) Manual-adjustment validation (pure) ──
  console.log('Manual-adjustment validation:')
  const setOk = parseAdjustment({ mode: 'set', rawValue: '10', current: 3 })
  check('set 10 from 3 → delta +7, newValue 10', setOk.ok && setOk.data.delta === 7 && setOk.data.newValue === 10)
  const setFromNull = parseAdjustment({ mode: 'set', rawValue: '8', current: null })
  check('set 8 from untracked → delta +8, newValue 8', setFromNull.ok && setFromNull.data.delta === 8 && setFromNull.data.newValue === 8)
  const deltaOk = parseAdjustment({ mode: 'delta', rawValue: '-2', current: 5 })
  check('delta -2 from 5 → newValue 3', deltaOk.ok && deltaOk.data.newValue === 3 && deltaOk.data.delta === -2)
  check('delta on untracked → error untracked', (() => { const r = parseAdjustment({ mode: 'delta', rawValue: '1', current: null }); return !r.ok && r.error === 'untracked' })())
  check('delta making stock negative → error negative', (() => { const r = parseAdjustment({ mode: 'delta', rawValue: '-5', current: 1 }); return !r.ok && r.error === 'negative' })())
  check('set negative → error value', (() => { const r = parseAdjustment({ mode: 'set', rawValue: '-3', current: 1 }); return !r.ok && r.error === 'value' })())
  check('non-integer value → error value', (() => { const r = parseAdjustment({ mode: 'set', rawValue: 'abc', current: 1 }); return !r.ok && r.error === 'value' })())
  check('decimal value → error value', (() => { const r = parseAdjustment({ mode: 'set', rawValue: '2.5', current: 1 }); return !r.ok && r.error === 'value' })())
  check('set == current → error noop', (() => { const r = parseAdjustment({ mode: 'set', rawValue: '4', current: 4 }); return !r.ok && r.error === 'noop' })())
  check('delta 0 → error noop', (() => { const r = parseAdjustment({ mode: 'delta', rawValue: '0', current: 4 }); return !r.ok && r.error === 'noop' })())
  check('invalid mode → error mode', (() => { const r = parseAdjustment({ mode: 'wat', rawValue: '1', current: 1 }); return !r.ok && r.error === 'mode' })())
  check('markup note → error note', (() => { const r = parseAdjustment({ mode: 'set', rawValue: '9', current: 1, rawNote: '<script>x' }); return !r.ok && r.error === 'note' })())
  check('overlong note → error note', (() => { const r = parseAdjustment({ mode: 'set', rawValue: '9', current: 1, rawNote: 'x'.repeat(201) }); return !r.ok && r.error === 'note' })())

  // ── 3) Manual adjustment DB path (mirror) ──
  console.log('Manual adjustment changes stock + records movement:')
  const adjProduct = await createProduct(2)
  const before3 = await productStock(adjProduct.id)
  const applied = await applyManualAdjustment('product', adjProduct.id, adjProduct.id, before3, 9, 9 - (before3 ?? 0))
  check('product adjustment applied', applied)
  check('product stock is now 9', (await productStock(adjProduct.id)) === 9)
  const mov = await prisma.inventoryStockMovement.findFirst({
    where: { productId: adjProduct.id, reason: 'manual_adjustment' },
    orderBy: { createdAt: 'desc' },
    select: { delta: true, quantityBefore: true, quantityAfter: true, level: true, note: true, actorLabel: true },
  })
  check('movement recorded with delta +7', mov?.delta === 7)
  check('movement before 2 → after 9', mov?.quantityBefore === 2 && mov?.quantityAfter === 9)
  check('movement level = product, note + actor safe', mov?.level === 'product' && mov?.note === 'invops note' && mov?.actorLabel === 'verify')

  console.log('Product ↔ variant isolation:')
  const isoProduct = await createProduct(4)
  const isoVariant = await createVariant(isoProduct.id, 4)
  await applyManualAdjustment('variant', isoVariant, isoProduct.id, 4, 1, -3)
  check('variant stock changed to 1', (await variantStock(isoVariant)) === 1)
  check('product stock UNCHANGED (still 4)', (await productStock(isoProduct.id)) === 4)
  check('variant movement carries productId for resolution', (await prisma.inventoryStockMovement.count({ where: { variantId: isoVariant, reason: 'manual_adjustment', productId: isoProduct.id } })) === 1)

  console.log('Stale guard: a concurrent change makes the conditional update a no-op:')
  const staleProduct = await createProduct(5)
  // Simulate: caller read before=5, but stock is now 2 → conditional update on =5 matches 0 rows.
  await prisma.product.update({ where: { id: staleProduct.id }, data: { stockQuantity: 2 } })
  const staleApplied = await applyManualAdjustment('product', staleProduct.id, staleProduct.id, 5, 10, 5)
  check('stale adjustment did NOT apply', !staleApplied)
  check('stale product stock untouched (still 2)', (await productStock(staleProduct.id)) === 2)
  check('no movement recorded for stale adjustment', (await prisma.inventoryStockMovement.count({ where: { productId: staleProduct.id } })) === 0)

  console.log('Rollback: a failing tx leaves NO movement and NO stock change:')
  const rbProduct = await createProduct(6)
  const SENTINEL = '__INVOPS_ROLLBACK__'
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { id: rbProduct.id, stockQuantity: 6 }, data: { stockQuantity: 1 } })
      await tx.inventoryStockMovement.create({
        data: buildMovementInput({ level: 'product', delta: -5, reason: 'manual_adjustment', productId: rbProduct.id, quantityBefore: 6, quantityAfter: 1 }),
      })
      throw new Error(SENTINEL)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== SENTINEL) throw e
  }
  check('rolled-back stock unchanged (still 6)', (await productStock(rbProduct.id)) === 6)
  check('rolled-back movement NOT committed', (await movementCountFor(rbProduct.id)) === 0)

  // ── 4) Order integration (mirror) ──
  console.log('Order create records an order_created movement (same tx):')
  const ordProduct = await createProduct(10)
  const codeA = orderCode()
  await prisma.$transaction(async (tx) => {
    const res = await tx.product.updateMany({ where: { id: ordProduct.id, stockQuantity: { gte: 3 } }, data: { stockQuantity: { decrement: 3 } } })
    if (res.count !== 1) throw new Error('decrement failed')
    await tx.inventoryStockMovement.create({
      data: buildMovementInput({ level: 'product', delta: -3, reason: 'order_created', productId: ordProduct.id, orderCode: codeA }),
    })
    await tx.order.create({
      data: {
        orderCode: codeA, status: 'submitted', customerName: 'Invops', customerPhone: '+380501234567',
        deliveryCity: 'Киев', deliveryMethod: 'nova_poshta', paymentMethod: 'manual_online',
        subtotalAmount: 199000 * 3, totalAmount: 199000 * 3,
        items: { create: [{ productId: ordProduct.id, productSlug: ordProduct.slug, productName: 'Invops', stockSource: 'product', unitPrice: 199000, quantity: 3, lineTotal: 199000 * 3 }] },
      },
    })
  })
  check('stock decremented 10 → 7 on create', (await productStock(ordProduct.id)) === 7)
  check('order_created movement recorded (delta -3, orderCode)', (await prisma.inventoryStockMovement.count({ where: { productId: ordProduct.id, reason: 'order_created', orderCode: codeA, delta: -3 } })) === 1)

  console.log('Order cancel records an order_cancelled_restock movement (same tx):')
  await prisma.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({ where: { orderCode: codeA, status: { not: OrderStatus.cancelled } }, data: { status: OrderStatus.cancelled } })
    if (flipped.count !== 1) return
    const res = await tx.product.updateMany({ where: { id: ordProduct.id, stockQuantity: { not: null } }, data: { stockQuantity: { increment: 3 } } })
    if (res.count === 1) {
      await tx.inventoryStockMovement.create({
        data: buildMovementInput({ level: 'product', delta: 3, reason: 'order_cancelled_restock', productId: ordProduct.id, orderCode: codeA }),
      })
    }
  })
  check('stock restocked 7 → 10 on cancel', (await productStock(ordProduct.id)) === 10)
  check('order_cancelled_restock movement recorded (delta +3)', (await prisma.inventoryStockMovement.count({ where: { productId: ordProduct.id, reason: 'order_cancelled_restock', delta: 3 } })) === 1)

  console.log('Order movement rolls back with a failed checkout tx:')
  const rbOrdProduct = await createProduct(5)
  try {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({ where: { id: rbOrdProduct.id, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
      await tx.inventoryStockMovement.create({
        data: buildMovementInput({ level: 'product', delta: -2, reason: 'order_created', productId: rbOrdProduct.id, orderCode: orderCode() }),
      })
      throw new Error(SENTINEL)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== SENTINEL) throw e
  }
  check('failed checkout left stock at 5', (await productStock(rbOrdProduct.id)) === 5)
  check('failed checkout left NO movement', (await movementCountFor(rbOrdProduct.id)) === 0)

  // ── 5) Dashboard attention (pure) ──
  console.log('Dashboard attention surfaces stock problems → /admin/inventory:')
  const zero: AttentionInput = {
    orders: { submitted: 0, processing: 0 },
    reviews: { pending: 0 },
    email: { queued: 0, failed: 0 },
    promos: { exhausted: 0, expiringSoon: 0 },
    catalog: { withoutPrice: 0, withoutImage: 0, zeroStockPurchasable: 0, lowStockPurchasable: 0 },
    customers: { unverified: 0 },
    interests: { active: 0 },
  }
  const q = buildAttentionQueue({ ...zero, catalog: { withoutPrice: 0, withoutImage: 0, zeroStockPurchasable: 2, lowStockPurchasable: 4 } })
  check('zero-stock item → warn, /admin/inventory, count 2', q.some((i) => i.key === 'catalog-zerostock' && i.severity === 'warn' && i.href === '/admin/inventory' && i.count === 2))
  check('low-stock item → warn, /admin/inventory, count 4', q.some((i) => i.key === 'catalog-lowstock' && i.severity === 'warn' && i.href === '/admin/inventory' && i.count === 4))
  check('no stock items when counts are zero', buildAttentionQueue(zero).every((i) => i.key !== 'catalog-zerostock' && i.key !== 'catalog-lowstock'))

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: stock health + manual adjustment (validated, race-safe, audited) + order/cancel movements + rollback safety + dashboard attention all pass.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove every throwaway row this run created (movements first — loose ids, no
    // cascade — then orders, then products; variants cascade with the product). No reset/seed/drop.
    try {
      const mv = await prisma.inventoryStockMovement.deleteMany({
        where: {
          OR: [
            { productId: { in: createdProductIds } },
            { variantId: { in: createdVariantIds } },
            { orderCode: { startsWith: ORDER_PREFIX } },
          ],
        },
      })
      const orders = await prisma.order.deleteMany({ where: { orderCode: { startsWith: ORDER_PREFIX } } })
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} product(s), ${orders.count} order(s), ${mv.count} movement(s).`)
      const leftover = await prisma.inventoryStockMovement.count({ where: { orderCode: { startsWith: ORDER_PREFIX } } })
      if (leftover !== 0) console.error(`Cleanup WARNING: ${leftover} movement row(s) remain.`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
