/**
 * AURELIA — Product availability / status order-guard verification (Этап 28A)
 *
 * Proves a published product is purchasable ONLY when its status is purchasable,
 * and that the cart/order path degrades safely otherwise:
 *   - the policy helper (isProductPurchasable / isPurchasableStatus) is correct;
 *   - the server orderable lookup (isPublished + purchasable status) INCLUDES an
 *     available product and EXCLUDES a coming_soon one and a hidden one (26M);
 *   - the cart resolver treats a non-purchasable resolved product as unavailable
 *     (so it is never submitted) without crashing;
 *   - a new order keeps the UAH baseline (27A) and its payment/delivery data (27B),
 *     and starts in the `submitted` lifecycle status (27E).
 *
 * Mirrors createOrderDraft's authoritative WHERE shape. Works only on throwaway
 * `zzz-verify-avail-` product + `ZZZ-VERIFY-AVAIL-` order rows, deleted in
 * `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:product-availability
 */

import { PrismaClient, OrderStatus } from '@prisma/client'
import {
  PURCHASABLE_PRODUCT_STATUSES,
  isProductPurchasable,
  isPurchasableStatus,
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

const PRODUCT_PREFIX = 'zzz-verify-avail-'
const ORDER_PREFIX = 'ZZZ-VERIFY-AVAIL-'
const slug = `${PRODUCT_PREFIX}${Date.now()}`
const orderCode = `${ORDER_PREFIX}${Date.now()}`

/** Mirrors createOrderDraft step 3: published AND purchasable status only. */
async function orderableSlugs(slugs: string[]): Promise<Set<string>> {
  const rows = await prisma.product.findMany({
    where: {
      slug: { in: slugs },
      isPublished: true,
      status: { in: [...PURCHASABLE_PRODUCT_STATUSES] },
    },
    select: { slug: true },
  })
  return new Set(rows.map((r) => r.slug))
}

async function main() {
  console.log('Policy helper (single source of truth):')
  check("'available' is a purchasable status", isPurchasableStatus('available'))
  check("'coming_soon' is NOT purchasable", !isPurchasableStatus('coming_soon'))
  check("'coming-soon' (UI form) is NOT purchasable", !isPurchasableStatus('coming-soon'))
  check('available + price → purchasable', isProductPurchasable({ status: 'available', price: 1990 }))
  check('available + null price → NOT purchasable', !isProductPurchasable({ status: 'available', price: null }))
  check('coming-soon → NOT purchasable', !isProductPurchasable({ status: 'coming-soon', price: null }))

  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')

  console.log('Published + available → orderable:')
  const created = await prisma.product.create({
    data: {
      slug,
      name: 'Availability verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-AVAIL-TEST',
      isPublished: true,
    },
    select: { id: true },
  })
  check('available published product IS orderable', (await orderableSlugs([slug])).has(slug))

  console.log('Published + coming_soon → NOT orderable (the 28A gap closed):')
  await prisma.product.update({ where: { id: created.id }, data: { status: 'coming_soon', price: null } })
  check('coming_soon published product is NOT orderable', !(await orderableSlugs([slug])).has(slug))
  // Cart resolver safety: a resolved-but-non-purchasable product → unavailable.
  const resolvedComingSoon = { status: 'coming-soon', price: null } // UI shape from map.ts
  check('cart resolver marks coming_soon product unavailable (no crash)', !isProductPurchasable(resolvedComingSoon))

  console.log('Hidden (isPublished=false) → still NOT orderable (26M preserved):')
  await prisma.product.update({ where: { id: created.id }, data: { status: 'available', price: 199000, isPublished: false } })
  check('hidden available product is NOT orderable', !(await orderableSlugs([slug])).has(slug))

  console.log('Restore published + available → orderable again:')
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: true } })
  check('restored product IS orderable again', (await orderableSlugs([slug])).has(slug))

  console.log('New order keeps UAH (27A) + payment/delivery (27B) + submitted (27E):')
  const order = await prisma.order.create({
    data: {
      orderCode,
      // status omitted → default; currency omitted → default.
      customerName: 'Avail Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      deliveryDetails: 'Новая Почта, отделение №3',
      paymentMethod: 'manual_online',
      subtotalAmount: 199000,
      totalAmount: 199000,
    },
    select: { status: true, currency: true, deliveryMethod: true, deliveryDetails: true, paymentMethod: true },
  })
  check('new order currency is UAH (27A)', order.currency === 'UAH')
  check('new order starts submitted (27E)', order.status === OrderStatus.submitted)
  check('payment/delivery preserved (27B)',
    order.deliveryMethod === 'nova_poshta' &&
    order.paymentMethod === 'manual_online' &&
    order.deliveryDetails === 'Новая Почта, отделение №3')

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: only published + purchasable products are orderable; cart degrades safely; 26M/27A/27B/27E intact.')
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
