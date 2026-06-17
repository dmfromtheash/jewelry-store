/**
 * AURELIA — Storefront variant selector + cart integration verification (Этап 30D)
 *
 * Proves the customer-side surface of Product Variants v1, server-side:
 *   - the runtime catalog mapper exposes full variant refs
 *     (id/value/isDefault/sortOrder/priceDelta-in-UAH/stock) on a variant product;
 *   - a product WITHOUT variants maps with no `variants` (unchanged shape);
 *   - the pure cart helpers (cartLineKey / pickDefaultVariantRef / resolveCartLine)
 *     match the server: composite identity per variant, default fallback for an
 *     old (no-variantId) line, priceDelta folded into the unit price, and a
 *     deleted/foreign/out-of-stock variant routed to "unavailable";
 *   - the shared 30B resolver still resolves default + explicit + rejects bad ids
 *     (parity with the cart helper);
 *   - an order line persists + reads back its variant snapshot (admin display);
 *   - hidden / coming_soon products degrade to "unavailable" client-side.
 *
 * The mapper (`catalog/map.ts`) and cart helpers (`cart/lines.ts`) and the order
 * resolver (`orders/variants.ts`) are PURE, so they are imported directly; the
 * server catalog query is mirrored (its module is `server-only`). Works only on
 * throwaway `zzz-verify-pvs-` products and `ZZZ-VERIFY-PVS-` orders, deleted in
 * `finally`. No reset/seed/drop. No secrets. Run:
 *   npm run db:verify:product-variant-storefront
 */

import { PrismaClient, type ProductStatus } from '@prisma/client'
import { mapDbProductToProduct } from '../src/lib/catalog/map'
import { cartLineKey, pickDefaultVariantRef, resolveCartLine } from '../src/lib/cart/lines'
import { resolveOrderLineVariant } from '../src/lib/orders/variants'
import type { Product } from '../src/lib/catalog/types'

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

const PRODUCT_PREFIX = 'zzz-verify-pvs-'
const ORDER_PREFIX = 'ZZZ-VERIFY-PVS-'
let seq = 0
const uniqueProductSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
const uniqueOrderCode = () => `${ORDER_PREFIX}${Date.now()}-${seq++}`

let categoryId = ''
let categoryName = ''
let categorySlug = ''

// Mirrors catalog/server.ts productInclude (the storefront read shape).
const productInclude = {
  category: { select: { slug: true } },
  variants: {
    select: {
      id: true,
      name: true,
      value: true,
      sortOrder: true,
      isDefault: true,
      priceDelta: true,
      stockQuantity: true,
      sku: true,
    },
    orderBy: { sortOrder: 'asc' as const },
  },
  images: {
    select: { url: true, alt: true, isPrimary: true, position: true },
    orderBy: { position: 'asc' as const },
  },
}

async function createProduct(opts: {
  status?: ProductStatus
  price?: number | null
  stockQuantity?: number | null
}): Promise<string> {
  const p = await prisma.product.create({
    data: {
      slug: uniqueProductSlug(),
      name: 'PVS verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: opts.status ?? 'available',
      isPublished: true,
      price: opts.price === undefined ? 100000 : opts.price,
      stockQuantity: opts.stockQuantity ?? null,
    },
    select: { id: true },
  })
  return p.id
}

let vseq = 0
async function addVariant(
  productId: string,
  opts: { value: string; isDefault?: boolean; priceDelta?: number | null; stockQuantity?: number | null; sku?: string | null },
): Promise<string> {
  const v = await prisma.productVariant.create({
    data: {
      productId,
      name: 'coating',
      value: opts.value,
      sortOrder: vseq++,
      isDefault: opts.isDefault ?? false,
      priceDelta: opts.priceDelta ?? null,
      stockQuantity: opts.stockQuantity ?? null,
      sku: opts.sku ?? null,
    },
    select: { id: true },
  })
  return v.id
}

/** Loads a product through the SAME include the storefront uses, then maps it. */
async function mappedProduct(productId: string): Promise<Product> {
  const row = await prisma.product.findUniqueOrThrow({ where: { id: productId }, include: productInclude })
  return mapDbProductToProduct(row)
}

async function main() {
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, slug: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name
  categorySlug = category.slug

  // ── A: mapper exposes full variant refs on a variant product ──
  console.log('catalog mapper exposes variant refs:')
  const pA = await createProduct({ price: 100000, stockQuantity: null }) // 100000 minor → 1000 UAH
  const steelId = await addVariant(pA, { value: 'Сталь', isDefault: true })
  const goldId = await addVariant(pA, { value: 'Позолота', priceDelta: 50000, sku: 'AU-PVS-GOLD' }) // +500 UAH
  const zeroId = await addVariant(pA, { value: 'Родий', stockQuantity: 0 })
  const mappedA = await mappedProduct(pA)
  check('mapped product has variants array', Array.isArray(mappedA.variants) && mappedA.variants!.length === 3)
  const refGold = mappedA.variants!.find((v) => v.id === goldId)
  check('variant ref carries id/value/isDefault', !!refGold && refGold.value === 'Позолота' && refGold.isDefault === false)
  check('priceDelta converted minor→UAH (50000→500)', refGold?.priceDelta === 500)
  check('default variant flagged on the ref', mappedA.variants!.find((v) => v.id === steelId)?.isDefault === true)
  check('legacy coatings still flattened', Array.isArray(mappedA.coatings) && mappedA.coatings!.length === 3)

  // ── B: product WITHOUT variants maps unchanged (no variants field) ──
  console.log('product without variants is unchanged:')
  const pB = await createProduct({ price: 80000, stockQuantity: 5 })
  const mappedB = await mappedProduct(pB)
  check('no-variant product has no variants field', mappedB.variants === undefined)
  check('no-variant product has no coatings field', mappedB.coatings === undefined)
  check('no-variant resolveCartLine uses product price', resolveCartLine(mappedB, undefined).unitPrice === 800)
  check('no-variant resolveCartLine available', resolveCartLine(mappedB, undefined).available)

  // ── C: pure cart helpers (identity + default + price + unavailable) ──
  console.log('cart helpers: identity, default fallback, price, unavailable:')
  check('cartLineKey distinct per variant', cartLineKey('s', 'a') !== cartLineKey('s', 'b'))
  check('cartLineKey stable for no-variant', cartLineKey('s') === cartLineKey('s', undefined))
  check('pickDefaultVariantRef returns the isDefault row', pickDefaultVariantRef(mappedA.variants!)?.id === steelId)

  const def = resolveCartLine(mappedA, undefined) // old-style line → default fallback
  check('old-style line resolves to default variant', def.available && def.variant?.id === steelId)
  check('default unit price = base (no delta)', def.unitPrice === 1000)

  const gold = resolveCartLine(mappedA, goldId)
  check('explicit variant resolves', gold.available && gold.variant?.id === goldId)
  check('explicit unit price = base + delta (1000+500)', gold.unitPrice === 1500)
  check('variant label is the value', gold.label === 'Позолота')

  check('deleted/foreign variantId → unavailable', resolveCartLine(mappedA, 'bogus-id').available === false)
  check('out-of-stock variant → unavailable', resolveCartLine(mappedA, zeroId).available === false)

  // ── D: parity with the shared 30B server resolver ──
  console.log('server resolver parity (minor units):')
  const serverVariants = mappedA.variants!.map((v) => ({
    id: v.id,
    name: v.name,
    value: v.value,
    sortOrder: v.sortOrder,
    isDefault: v.isDefault,
    priceDelta: v.priceDelta == null ? null : v.priceDelta * 100, // UAH ref → minor for the server
    stockQuantity: v.stockQuantity ?? null,
    sku: v.sku ?? null,
  }))
  const sDef = resolveOrderLineVariant({ productPrice: 100000, productStock: null, variants: serverVariants })
  check('server resolves default for no-variantId', sDef.ok && sDef.variant?.id === steelId)
  const sGold = resolveOrderLineVariant({ productPrice: 100000, productStock: null, variants: serverVariants, variantId: goldId })
  check('server unit price = 150000 minor (1500 UAH)', sGold.ok && sGold.unitPrice === 150000)
  check('server rejects foreign variantId', !resolveOrderLineVariant({ productPrice: 100000, productStock: null, variants: serverVariants, variantId: 'bogus-id' }).ok)

  // ── E: order line persists + reads back the variant snapshot (admin display) ──
  console.log('order line variant snapshot round-trips:')
  const orderCode = uniqueOrderCode()
  await prisma.order.create({
    data: {
      orderCode,
      status: 'submitted',
      customerName: 'PVS Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      paymentMethod: 'manual_online',
      subtotalAmount: 150000,
      totalAmount: 150000,
      items: {
        create: [
          {
            productId: pA,
            productSlug: 'pvs-snapshot',
            productName: 'PVS verify товар',
            productSku: 'AU-PVS-GOLD',
            variantId: goldId,
            variantName: 'coating',
            variantValue: 'Позолота',
            stockSource: 'variant',
            unitPrice: 150000,
            quantity: 1,
            lineTotal: 150000,
          },
        ],
      },
    },
  })
  const item = await prisma.orderItem.findFirst({
    where: { order: { orderCode } },
    select: { variantName: true, variantValue: true, unitPrice: true },
  })
  check('order item keeps variantValue snapshot', item?.variantValue === 'Позолота')
  check('order item keeps server unit price', item?.unitPrice === 150000)

  // ── F: hidden / coming_soon degrade to unavailable client-side ──
  console.log('hidden / coming_soon degrade to unavailable:')
  // Hidden products are absent from the public snapshot → getBySlug undefined.
  check('missing product (hidden) → unavailable', resolveCartLine(undefined, undefined).available === false)
  const pSoon = await createProduct({ status: 'coming_soon', price: null, stockQuantity: null })
  const mappedSoon = await mappedProduct(pSoon)
  check('coming_soon product → unavailable', resolveCartLine(mappedSoon, undefined).available === false)

  void categorySlug

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: catalog exposes variants, cart helpers match the server resolver, snapshot round-trips, and storefront guards degrade safely.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
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
