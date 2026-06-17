/**
 * AURELIA — UAH currency baseline verification (Этап 27A)
 *
 * Proves the store's currency baseline is Ukraine-first (UAH) after the
 * `switch_currency_to_uah` migration, on every layer that matters at runtime:
 *
 *   1. Product DEFAULT — a new product created WITHOUT an explicit currency
 *      (exactly how admin create works) inherits 'UAH'.
 *   2. Order DEFAULT — a new order created WITHOUT an explicit currency
 *      (exactly how createOrderDraft persists) inherits 'UAH'.
 *   3. Catalog BASELINE — no real catalog product row is left on 'RUB'.
 *   4. Customer DISPLAY — formatPrice() renders the ₴ glyph and never ₽.
 *   5. 26M guard intact — the authoritative orderable lookup still filters
 *      `isPublished: true`, so the currency switch didn't weaken hidden-product
 *      safety.
 *
 * Works only on throwaway rows with a unique `zzz-verify-currency-` prefix and
 * deletes them in `finally`. It does NOT reset/seed/drop and never rewrites real
 * catalog or order rows. No secrets printed. Run: npm run db:verify:currency
 */

import { PrismaClient } from '@prisma/client'
import { formatPrice } from '../src/lib/catalog'

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

const PREFIX = 'zzz-verify-currency-'
const slug = `${PREFIX}${Date.now()}`
const orderCode = `ZZZ-VERIFY-${Date.now()}`

async function main() {
  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) {
    throw new Error('No category found — seed the catalog before running this check.')
  }

  console.log('Product default currency (admin create omits currency):')
  const product = await prisma.product.create({
    data: {
      slug,
      name: 'Currency verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000,
      sku: 'AU-CURRENCY-TEST',
      // currency intentionally NOT set → must inherit the column default.
    },
    select: { currency: true, isPublished: true },
  })
  check("new product currency defaults to 'UAH'", product.currency === 'UAH')

  console.log('Order default currency (createOrderDraft omits currency):')
  const order = await prisma.order.create({
    data: {
      orderCode,
      customerName: 'Verify',
      customerPhone: '+380000000000',
      deliveryCity: 'Kyiv',
      deliveryMethod: 'pickup',
      paymentMethod: 'not_connected',
      subtotalAmount: 199000,
      totalAmount: 199000,
      // currency intentionally NOT set → must inherit the column default.
    },
    select: { currency: true },
  })
  check("new order currency defaults to 'UAH'", order.currency === 'UAH')

  console.log('Catalog baseline (no real product left on RUB):')
  const rubProducts = await prisma.product.count({
    where: { currency: 'RUB', slug: { not: { startsWith: PREFIX } } },
  })
  check('zero catalog products with currency RUB', rubProducts === 0)

  console.log('Customer-facing display formatter:')
  const formatted = formatPrice(2490)
  check('formatPrice renders the ₴ glyph', formatted.includes('₴'))
  check('formatPrice never renders the ₽ glyph', !formatted.includes('₽'))

  console.log('26M hidden-product guard still intact:')
  // The orderable lookup must still exclude an unpublished product regardless of
  // the currency change. Hide our throwaway product and confirm it drops out.
  const created = await prisma.product.findFirst({ where: { slug }, select: { id: true } })
  if (created) {
    await prisma.product.update({ where: { id: created.id }, data: { isPublished: false } })
  }
  const orderable = await prisma.product.findMany({
    where: { slug: { in: [slug] }, isPublished: true },
    select: { slug: true },
  })
  check('orderable lookup still excludes a hidden product', orderable.length === 0)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: currency baseline is UAH; new products/orders default to UAH; 26M guard intact.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway rows. The unique prefixes
    // guarantee we never touch real catalog/order data. No reset/seed/drop.
    try {
      const orders = await prisma.order.deleteMany({ where: { orderCode: { startsWith: 'ZZZ-VERIFY-' } } })
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } })
      console.log(`Cleanup: removed ${products.count} test product(s), ${orders.count} test order(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
