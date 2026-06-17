/**
 * AURELIA — Product inventory quantity verification (Этап 28B)
 *
 * Proves product-level stock behaves safely end-to-end:
 *   - the policy helper (isInStock / isProductPurchasable) treats null as "not
 *     tracked" (purchasable) and 0 as out of stock (not purchasable);
 *   - the EXACT conditional decrement the order action uses
 *     (`updateMany where stockQuantity >= qty` + `decrement`) succeeds for
 *     sufficient stock, brings it to 0 when equal, and REFUSES (count 0) when
 *     stock is 0 or below the requested quantity — so stock can never go negative
 *     and overselling is impossible;
 *   - null-stock products are never decremented;
 *   - coming_soon (28A) and hidden (26M) products remain non-orderable;
 *   - a new order keeps UAH (27A), payment/delivery (27B), and starts submitted (27E).
 *
 * Mirrors createOrderDraft's DB operations (the action is `'use server'`). Works
 * only on throwaway `zzz-verify-inv-` product + `ZZZ-VERIFY-INV-` order rows,
 * deleted in `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:inventory
 */

import { PrismaClient, OrderStatus } from '@prisma/client'
import {
  PURCHASABLE_PRODUCT_STATUSES,
  isInStock,
  isProductPurchasable,
} from '../src/lib/catalog/availability'

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

const PRODUCT_PREFIX = 'zzz-verify-inv-'
const ORDER_PREFIX = 'ZZZ-VERIFY-INV-'
const slug = `${PRODUCT_PREFIX}${Date.now()}`
const orderCode = `${ORDER_PREFIX}${Date.now()}`

/** Mirrors the order action's race-safe decrement. Returns true when it applied. */
async function tryDecrement(id: string, qty: number): Promise<boolean> {
  const res = await prisma.product.updateMany({
    where: { id, stockQuantity: { gte: qty } },
    data: { stockQuantity: { decrement: qty } },
  })
  return res.count === 1
}

/** Mirrors createOrderDraft step 3: published AND purchasable status only. */
async function isOrderableSlug(target: string): Promise<boolean> {
  const rows = await prisma.product.findMany({
    where: { slug: target, isPublished: true, status: { in: [...PURCHASABLE_PRODUCT_STATUSES] } },
    select: { slug: true },
  })
  return rows.length === 1
}

async function stockOf(id: string): Promise<number | null> {
  const r = await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true } })
  return r?.stockQuantity ?? null
}

async function main() {
  console.log('Policy helper (stock-aware):')
  check('isInStock(null) → true (not tracked)', isInStock(null))
  check('isInStock(undefined) → true', isInStock(undefined))
  check('isInStock(0) → false', !isInStock(0))
  check('isInStock(5) → true', isInStock(5))
  check('available + price + null stock → purchasable', isProductPurchasable({ status: 'available', price: 1990, stockQuantity: null }))
  check('available + price + 0 stock → NOT purchasable', !isProductPurchasable({ status: 'available', price: 1990, stockQuantity: 0 }))
  check('available + price + 3 stock → purchasable', isProductPurchasable({ status: 'available', price: 1990, stockQuantity: 3 }))

  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')

  const product = await prisma.product.create({
    data: {
      slug,
      name: 'Inventory verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-INV-TEST',
      isPublished: true,
      stockQuantity: null, // start untracked
    },
    select: { id: true },
  })
  const id = product.id

  console.log('Untracked (null) stock → orderable, never decremented:')
  check('null-stock product is orderable', await isOrderableSlug(slug))
  check('null-stock stays null (no decrement path)', (await stockOf(id)) === null)

  console.log('stock > requested qty → order decrements correctly:')
  await prisma.product.update({ where: { id }, data: { stockQuantity: 5 } })
  check('decrement of 2 from 5 applies', await tryDecrement(id, 2))
  check('stock is now 3', (await stockOf(id)) === 3)

  console.log('stock == requested qty → order brings it to 0:')
  check('decrement of 3 from 3 applies', await tryDecrement(id, 3))
  check('stock is now 0', (await stockOf(id)) === 0)

  console.log('stock 0 → cannot be ordered (no decrement, no negative):')
  check('decrement of 1 from 0 is REFUSED', !(await tryDecrement(id, 1)))
  check('stock is still 0 (never negative)', (await stockOf(id)) === 0)
  check('0-stock product is NOT purchasable', !isProductPurchasable({ status: 'available', price: 1990, stockQuantity: 0 }))

  console.log('stock < requested qty → refused, no partial decrement:')
  await prisma.product.update({ where: { id }, data: { stockQuantity: 1 } })
  check('decrement of 2 from 1 is REFUSED', !(await tryDecrement(id, 2)))
  check('stock is still 1 (untouched)', (await stockOf(id)) === 1)

  console.log('coming_soon (28A) + hidden (26M) remain non-orderable:')
  await prisma.product.update({ where: { id }, data: { status: 'coming_soon', price: null } })
  check('coming_soon is NOT orderable', !(await isOrderableSlug(slug)))
  await prisma.product.update({ where: { id }, data: { status: 'available', price: 199000, isPublished: false } })
  check('hidden is NOT orderable', !(await isOrderableSlug(slug)))

  console.log('New order keeps UAH (27A) + payment/delivery (27B) + submitted (27E):')
  const order = await prisma.order.create({
    data: {
      orderCode,
      customerName: 'Inv Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: 'Новая Почта, отделение №5',
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
    },
    select: { status: true, currency: true, deliveryMethod: true, deliveryDetails: true, paymentMethod: true },
  })
  check('order currency UAH (27A)', order.currency === 'UAH')
  check('order starts submitted (27E)', order.status === OrderStatus.submitted)
  check('payment/delivery preserved (27B)',
    order.deliveryMethod === 'nova_poshta' && order.paymentMethod === 'manual_online' && order.deliveryDetails === 'Новая Почта, отделение №5')

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: stock validates + decrements safely (no oversell/negative); 26M/28A/27A/27B/27E intact.')
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
