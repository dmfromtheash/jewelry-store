/**
 * AURELIA — Product variant order foundation verification (Этап 30B)
 *
 * Proves the server/order/inventory foundation for selectable product variants
 * WITHOUT any UI:
 *   - a product WITHOUT variants still orders and decrements/restocks PRODUCT
 *     stock exactly as 28B/28C (and snapshots null variant fields);
 *   - a variant product with NO variantId falls back to the default variant (§6
 *     backward compatibility — never rejected);
 *   - a valid variantId resolves, snapshots variantId/name/value, and priceDelta
 *     flows into the server-authoritative unitPrice;
 *   - an unknown variantId, and a variantId belonging to ANOTHER product, are
 *     both rejected;
 *   - variant stock decrements when tracked (> qty, = qty → 0), and 0 / < qty
 *     reject; variant stock null falls back to product stock; null at BOTH levels
 *     is untracked (no decrement);
 *   - cancel restocks the SAME level that was decremented (variant vs product),
 *     on submitted→cancelled and processing→cancelled, with no double restock;
 *   - a legacy line (stockSource null, pre-30B) still restocks product stock;
 *   - hidden (26M) and coming_soon (28A) products still reject;
 *   - payment/delivery (27B) persist, currency stays UAH (27A), new order is
 *     submitted (27E).
 *
 * The real logic lives in server-only modules (`createOrderDraft` is 'use server';
 * `updateAdminOrderStatus` is 'server-only'), so this MIRRORS their exact
 * transactions while importing the SHARED, pure policy (`resolveOrderLineVariant`,
 * `canTransitionOrderStatus`, `isPurchasableStatus`) — the same code the server
 * runs. Works only on throwaway `zzz-verify-pv-` products and `ZZZ-VERIFY-PV-`
 * orders, deleted in `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:product-variants
 */

import { PrismaClient, OrderStatus, Prisma, type ProductStatus } from '@prisma/client'
import { resolveOrderLineVariant } from '../src/lib/orders/variants'
import { canTransitionOrderStatus } from '../src/lib/orders/transitions'
import { isPurchasableStatus, PURCHASABLE_PRODUCT_STATUSES } from '../src/lib/catalog/availability'

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

const PRODUCT_PREFIX = 'zzz-verify-pv-'
const ORDER_PREFIX = 'ZZZ-VERIFY-PV-'
const PAY_DETAILS = 'Новая Почта, отделение №7'

let seq = 0
const uniqueProductSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
const uniqueOrderCode = () => `${ORDER_PREFIX}${Date.now()}-${seq++}`

let categoryId = ''
let categoryName = ''

async function createProduct(opts: {
  status?: ProductStatus
  isPublished?: boolean
  price?: number | null
  stockQuantity?: number | null
}): Promise<{ id: string; slug: string }> {
  return prisma.product.create({
    data: {
      slug: uniqueProductSlug(),
      name: 'PV verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: opts.status ?? 'available',
      isPublished: opts.isPublished ?? true,
      price: opts.price === undefined ? 100000 : opts.price,
      stockQuantity: opts.stockQuantity ?? null,
    },
    select: { id: true, slug: true },
  })
}

let variantSeq = 0
async function createVariant(
  productId: string,
  opts: {
    value: string
    isDefault?: boolean
    priceDelta?: number | null
    stockQuantity?: number | null
    sku?: string | null
    sortOrder?: number
  },
): Promise<{ id: string }> {
  return prisma.productVariant.create({
    data: {
      productId,
      name: 'coating',
      value: opts.value,
      sortOrder: opts.sortOrder ?? variantSeq++,
      isDefault: opts.isDefault ?? false,
      priceDelta: opts.priceDelta ?? null,
      stockQuantity: opts.stockQuantity ?? null,
      sku: opts.sku ?? null,
    },
    select: { id: true },
  })
}

type LineInput = { slug: string; variantId?: string | null; qty: number }
type CreateResult = { ok: true; orderCode: string } | { ok: false; error: string }

/** Mirrors createOrderDraft's catalog gate + variant resolution + transactional decrement. */
async function placeOrder(
  lines: LineInput[],
  opts?: { paymentMethod?: string; deliveryMethod?: string; deliveryDetails?: string },
): Promise<CreateResult> {
  const requested = new Map<string, { slug: string; variantId: string | null; qty: number }>()
  for (const item of lines) {
    const variantId = item.variantId && item.variantId.trim() ? item.variantId.trim() : null
    const qty = Math.floor(item.qty)
    const key = `${item.slug}::${variantId ?? ''}`
    const ex = requested.get(key)
    requested.set(key, { slug: item.slug, variantId, qty: (ex?.qty ?? 0) + qty })
  }

  const slugs = [...new Set([...requested.values()].map((l) => l.slug))]
  const products = await prisma.product.findMany({
    where: {
      slug: { in: slugs },
      isPublished: true,
      status: { in: [...PURCHASABLE_PRODUCT_STATUSES] },
    },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      price: true,
      status: true,
      stockQuantity: true,
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
      },
    },
  })
  const bySlug = new Map(products.map((p) => [p.slug, p]))

  const itemRows: Prisma.OrderItemCreateWithoutOrderInput[] = []
  const stockDecrements: { source: 'variant' | 'product'; id: string; qty: number }[] = []
  let subtotalAmount = 0
  for (const { slug, variantId, qty } of requested.values()) {
    const product = bySlug.get(slug)
    if (!product) return { ok: false, error: 'product_unavailable' }
    if (!isPurchasableStatus(product.status) || product.price == null) {
      return { ok: false, error: 'not_orderable' }
    }
    const resolved = resolveOrderLineVariant({
      productPrice: product.price,
      productStock: product.stockQuantity,
      variants: product.variants,
      variantId,
    })
    if (!resolved.ok) return { ok: false, error: resolved.reason }
    const { variant, unitPrice, stockSource, availableStock } = resolved
    if (stockSource && availableStock != null && availableStock < qty) {
      return { ok: false, error: 'out_of_stock' }
    }
    if (stockSource === 'variant' && variant) {
      stockDecrements.push({ source: 'variant', id: variant.id, qty })
    } else if (stockSource === 'product') {
      stockDecrements.push({ source: 'product', id: product.id, qty })
    }
    const lineTotal = unitPrice * qty
    subtotalAmount += lineTotal
    itemRows.push({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      productSku: variant?.sku ?? product.sku ?? null,
      variantId: variant?.id ?? null,
      variantName: variant?.name ?? null,
      variantValue: variant?.value ?? null,
      stockSource: stockSource ?? null,
      unitPrice,
      quantity: qty,
      lineTotal,
    })
  }

  const orderCode = uniqueOrderCode()
  try {
    await prisma.$transaction(async (tx) => {
      for (const d of stockDecrements) {
        const res =
          d.source === 'variant'
            ? await tx.productVariant.updateMany({
                where: { id: d.id, stockQuantity: { gte: d.qty } },
                data: { stockQuantity: { decrement: d.qty } },
              })
            : await tx.product.updateMany({
                where: { id: d.id, stockQuantity: { gte: d.qty } },
                data: { stockQuantity: { decrement: d.qty } },
              })
        if (res.count !== 1) throw new Error('out_of_stock_race')
      }
      await tx.order.create({
        data: {
          orderCode,
          status: 'submitted',
          customerName: 'PV Verify',
          customerPhone: '+380501234567',
          deliveryCity: 'Киев',
          deliveryMethod: opts?.deliveryMethod ?? 'nova_poshta',
          deliveryDetails: opts?.deliveryDetails ?? PAY_DETAILS,
          paymentMethod: opts?.paymentMethod ?? 'manual_online',
          subtotalAmount,
          totalAmount: subtotalAmount,
          // currency intentionally omitted → exercises the UAH schema default (27A).
          items: { create: itemRows },
        },
      })
    })
    return { ok: true, orderCode }
  } catch {
    return { ok: false, error: 'out_of_stock' }
  }
}

/** Mirrors updateAdminOrderStatus's cancel branch (variant-aware restock keyed on stockSource). */
async function adminCancel(orderCode: string, current: OrderStatus): Promise<boolean> {
  if (!canTransitionOrderStatus(current, OrderStatus.cancelled)) return false
  const count = await prisma.$transaction(async (tx) => {
    const flipped = await tx.order.updateMany({
      where: { orderCode, status: { not: OrderStatus.cancelled } },
      data: { status: OrderStatus.cancelled },
    })
    if (flipped.count === 1) {
      const items = await tx.orderItem.findMany({
        where: { order: { orderCode } },
        select: { productId: true, variantId: true, stockSource: true, quantity: true },
      })
      for (const item of items) {
        if (item.stockSource === 'variant' && item.variantId) {
          await tx.productVariant.updateMany({
            where: { id: item.variantId, stockQuantity: { not: null } },
            data: { stockQuantity: { increment: item.quantity } },
          })
          continue
        }
        if (!item.productId) continue
        await tx.product.updateMany({
          where: { id: item.productId, stockQuantity: { not: null } },
          data: { stockQuantity: { increment: item.quantity } },
        })
      }
    }
    return flipped.count
  })
  return count === 1
}

const variantStock = async (id: string) =>
  (await prisma.productVariant.findUnique({ where: { id }, select: { stockQuantity: true } }))
    ?.stockQuantity ?? null
const productStock = async (id: string) =>
  (await prisma.product.findUnique({ where: { id }, select: { stockQuantity: true } }))
    ?.stockQuantity ?? null
const firstItem = (orderCode: string) =>
  prisma.orderItem.findFirst({
    where: { order: { orderCode } },
    select: {
      variantId: true,
      variantName: true,
      variantValue: true,
      stockSource: true,
      unitPrice: true,
      productSku: true,
    },
  })

async function main() {
  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // ── A: product WITHOUT variants — orders, decrements + restocks PRODUCT stock ──
  console.log('product without variants — normal order + product stock 28B/28C:')
  const pA = await createProduct({ price: 199000, stockQuantity: 5 })
  const oA = await placeOrder([{ slug: pA.slug, qty: 2 }])
  check('no-variant product orders normally', oA.ok)
  check('product stock decremented 5 → 3', (await productStock(pA.id)) === 3)
  const itemA = oA.ok ? await firstItem(oA.orderCode) : null
  check('no-variant line snapshots null variant fields', !!itemA && itemA.variantId === null && itemA.variantName === null && itemA.variantValue === null)
  check('no-variant line stockSource = product', itemA?.stockSource === 'product')
  check('no-variant unitPrice = product price', itemA?.unitPrice === 199000)
  if (oA.ok) check('submitted → cancelled restocks product 3 → 5', (await adminCancel(oA.orderCode, OrderStatus.submitted)) && (await productStock(pA.id)) === 5)

  // ── B: variant product, NO variantId → default fallback (never rejected) ──
  console.log('variant product, no variantId → default-variant fallback (§6):')
  const pB = await createProduct({ price: 100000, stockQuantity: null })
  const vBdef = await createVariant(pB.id, { value: 'Сталь', isDefault: true, sortOrder: 1 })
  const vBgold = await createVariant(pB.id, { value: 'Позолота', priceDelta: 50000, sku: 'AU-PV-GOLD', sortOrder: 0 })
  const oB = await placeOrder([{ slug: pB.slug, qty: 1 }]) // no variantId
  check('variant product orders without variantId (fallback)', oB.ok)
  const itemB = oB.ok ? await firstItem(oB.orderCode) : null
  check('fallback resolved the isDefault variant', itemB?.variantId === vBdef.id)
  check('fallback snapshots variantName/Value', itemB?.variantName === 'coating' && itemB?.variantValue === 'Сталь')
  check('fallback unitPrice = base (default has no priceDelta)', itemB?.unitPrice === 100000)

  // ── C: valid variantId → snapshot + priceDelta in server price ──
  console.log('valid variantId snapshots variant + applies priceDelta:')
  const oC = await placeOrder([{ slug: pB.slug, variantId: vBgold.id, qty: 1 }])
  check('order with valid variantId succeeds', oC.ok)
  const itemC = oC.ok ? await firstItem(oC.orderCode) : null
  check('snapshots chosen variantId', itemC?.variantId === vBgold.id)
  check('snapshots variantValue = Позолота', itemC?.variantValue === 'Позолота')
  check('unitPrice = base + priceDelta (100000 + 50000)', itemC?.unitPrice === 150000)
  check('variant sku snapshotted onto productSku', itemC?.productSku === 'AU-PV-GOLD')

  // ── D: invalid variantId rejects; foreign-product variantId rejects ──
  console.log('invalid / foreign variantId rejected:')
  const oBad = await placeOrder([{ slug: pB.slug, variantId: 'nonexistent-id', qty: 1 }])
  check('unknown variantId rejected', !oBad.ok)
  const pOther = await createProduct({ price: 120000, stockQuantity: null })
  const vOther = await createVariant(pOther.id, { value: 'Родий', isDefault: true })
  const oForeign = await placeOrder([{ slug: pB.slug, variantId: vOther.id, qty: 1 }])
  check("another product's variantId rejected", !oForeign.ok)

  // ── E: variant stock tracked — > qty, = qty → 0, decrement correctness ──
  console.log('variant stock decrements when tracked:')
  const pE = await createProduct({ price: 90000, stockQuantity: null })
  const vE = await createVariant(pE.id, { value: 'Сталь', isDefault: true, stockQuantity: 5 })
  const oE = await placeOrder([{ slug: pE.slug, variantId: vE.id, qty: 2 }])
  check('variant stock > qty: order ok', oE.ok)
  check('variant stock decremented 5 → 3', (await variantStock(vE.id)) === 3)
  check('product stock untouched (null)', (await productStock(pE.id)) === null)
  const eItem = oE.ok ? await firstItem(oE.orderCode) : null
  check('variant line stockSource = variant', eItem?.stockSource === 'variant')

  const pEq = await createProduct({ price: 90000, stockQuantity: null })
  const vEq = await createVariant(pEq.id, { value: 'Сталь', isDefault: true, stockQuantity: 3 })
  const oEq = await placeOrder([{ slug: pEq.slug, variantId: vEq.id, qty: 3 }])
  check('variant stock = qty: order ok', oEq.ok)
  check('variant stock decremented to exactly 0', (await variantStock(vEq.id)) === 0)

  // ── F: variant stock 0 and < qty reject ──
  console.log('variant out-of-stock rejected:')
  const pZero = await createProduct({ price: 90000, stockQuantity: null })
  const vZero = await createVariant(pZero.id, { value: 'Сталь', isDefault: true, stockQuantity: 0 })
  check('variant stock 0 rejects', !(await placeOrder([{ slug: pZero.slug, variantId: vZero.id, qty: 1 }])).ok)
  check('variant stock 0 stays 0 (no decrement)', (await variantStock(vZero.id)) === 0)
  const pLow = await createProduct({ price: 90000, stockQuantity: null })
  const vLow = await createVariant(pLow.id, { value: 'Сталь', isDefault: true, stockQuantity: 2 })
  check('variant stock < qty rejects', !(await placeOrder([{ slug: pLow.slug, variantId: vLow.id, qty: 5 }])).ok)
  check('variant stock unchanged after reject (still 2)', (await variantStock(vLow.id)) === 2)

  // ── G: variant restock on submitted→cancelled and processing→cancelled ──
  console.log('variant stock restocks on cancel (submitted + processing):')
  if (oE.ok) {
    check('submitted → cancelled restocks variant 3 → 5', (await adminCancel(oE.orderCode, OrderStatus.submitted)) && (await variantStock(vE.id)) === 5)
    // no double restock: a second cancel is rejected by the guard, stock unchanged.
    check('cancelled → cancelled rejected (no double restock)', !(await adminCancel(oE.orderCode, OrderStatus.cancelled)))
    check('variant stock still 5 after rejected re-cancel', (await variantStock(vE.id)) === 5)
  }

  const pProc = await createProduct({ price: 90000, stockQuantity: null })
  const vProc = await createVariant(pProc.id, { value: 'Сталь', isDefault: true, stockQuantity: 8 })
  const oProc = await placeOrder([{ slug: pProc.slug, variantId: vProc.id, qty: 3 }])
  check('variant stock 8 → 5 on create', oProc.ok && (await variantStock(vProc.id)) === 5)
  if (oProc.ok) await prisma.order.update({ where: { orderCode: oProc.orderCode }, data: { status: OrderStatus.processing } })
  check('processing → cancelled restocks variant 5 → 8', oProc.ok && (await adminCancel(oProc.orderCode, OrderStatus.processing)) && (await variantStock(vProc.id)) === 8)

  // ── H: variant stock null → product fallback (decrement + restock product) ──
  console.log('variant stock null → product-stock fallback:')
  const pH = await createProduct({ price: 90000, stockQuantity: 10 })
  const vH = await createVariant(pH.id, { value: 'Сталь', isDefault: true, stockQuantity: null })
  const oH = await placeOrder([{ slug: pH.slug, variantId: vH.id, qty: 2 }])
  check('variant-null line orders ok', oH.ok)
  check('product stock decremented 10 → 8 (fallback)', (await productStock(pH.id)) === 8)
  check('variant stock stays null', (await variantStock(vH.id)) === null)
  const hItem = oH.ok ? await firstItem(oH.orderCode) : null
  check('fallback line stockSource = product', hItem?.stockSource === 'product')
  check('fallback line still snapshots the variant id', hItem?.variantId === vH.id)
  if (oH.ok) check('cancel restocks PRODUCT 8 → 10 (not variant)', (await adminCancel(oH.orderCode, OrderStatus.submitted)) && (await productStock(pH.id)) === 10 && (await variantStock(vH.id)) === null)

  // ── I: product null + variant null = untracked (no decrement / no restock) ──
  console.log('product null + variant null = untracked:')
  const pU = await createProduct({ price: 90000, stockQuantity: null })
  const vU = await createVariant(pU.id, { value: 'Сталь', isDefault: true, stockQuantity: null })
  const oU = await placeOrder([{ slug: pU.slug, variantId: vU.id, qty: 2 }])
  check('untracked variant line orders ok', oU.ok)
  check('variant stock stays null (untracked)', (await variantStock(vU.id)) === null)
  check('product stock stays null (untracked)', (await productStock(pU.id)) === null)
  const uItem = oU.ok ? await firstItem(oU.orderCode) : null
  check('untracked line stockSource = null', uItem?.stockSource === null)
  if (oU.ok) check('cancel of untracked line restocks nothing', (await adminCancel(oU.orderCode, OrderStatus.submitted)) && (await variantStock(vU.id)) === null && (await productStock(pU.id)) === null)

  // ── J: hidden (26M) and coming_soon (28A) products still reject ──
  console.log('hidden / coming_soon variant products still reject:')
  const pHidden = await createProduct({ price: 90000, stockQuantity: null, isPublished: false })
  await createVariant(pHidden.id, { value: 'Сталь', isDefault: true, stockQuantity: 5 })
  check('hidden product rejected', !(await placeOrder([{ slug: pHidden.slug, qty: 1 }])).ok)
  const pSoon = await createProduct({ price: null, stockQuantity: null, status: 'coming_soon' })
  await createVariant(pSoon.id, { value: 'Сталь', isDefault: true, stockQuantity: 5 })
  check('coming_soon product rejected', !(await placeOrder([{ slug: pSoon.slug, qty: 1 }])).ok)

  // ── K: payment/delivery (27B) persist; currency UAH (27A); status submitted (27E) ──
  console.log('27A/27B/27E preserved on a variant order:')
  const pK = await createProduct({ price: 100000, stockQuantity: null })
  const vK = await createVariant(pK.id, { value: 'Сталь', isDefault: true })
  const oK = await placeOrder([{ slug: pK.slug, variantId: vK.id, qty: 1 }], {
    paymentMethod: 'cash_on_delivery',
    deliveryMethod: 'self_pickup',
    deliveryDetails: 'Самовывоз, ТЦ «Дрим»',
  })
  check('variant order with payment/delivery succeeds', oK.ok)
  const orderK = oK.ok ? await prisma.order.findUnique({ where: { orderCode: oK.orderCode }, select: { status: true, currency: true, paymentMethod: true, deliveryMethod: true, deliveryDetails: true } }) : null
  check('new variant order starts submitted (27E)', orderK?.status === OrderStatus.submitted)
  check('currency stays UAH (27A)', orderK?.currency === 'UAH')
  check('payment/delivery persisted (27B)', orderK?.paymentMethod === 'cash_on_delivery' && orderK?.deliveryMethod === 'self_pickup' && orderK?.deliveryDetails === 'Самовывоз, ТЦ «Дрим»')

  // ── L: legacy line (stockSource null, pre-30B) still restocks PRODUCT stock ──
  console.log('legacy pre-30B line (null stockSource) restocks product:')
  const pL = await createProduct({ price: 90000, stockQuantity: 4 })
  // Mirror a pre-30B order created by 28B: product decremented, OrderItem has no
  // variant/stockSource columns set (all null).
  await prisma.product.updateMany({ where: { id: pL.id, stockQuantity: { gte: 2 } }, data: { stockQuantity: { decrement: 2 } } })
  const legacyCode = uniqueOrderCode()
  await prisma.order.create({
    data: {
      orderCode: legacyCode,
      status: 'submitted',
      customerName: 'PV Legacy',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      paymentMethod: 'manual_online',
      subtotalAmount: 180000,
      totalAmount: 180000,
      items: { create: [{ productId: pL.id, productSlug: pL.slug, productName: 'PV legacy', unitPrice: 90000, quantity: 2, lineTotal: 180000 }] },
    },
  })
  check('legacy product decremented 4 → 2', (await productStock(pL.id)) === 2)
  check('legacy submitted → cancelled restocks product 2 → 4', (await adminCancel(legacyCode, OrderStatus.submitted)) && (await productStock(pL.id)) === 4)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: variant resolution, server pricing, variant/product stock decrement + restock, fallback, rejections, and 26M/27A/27B/27E/28A guards all hold.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway rows (unique prefixes). OrderItems
    // cascade with their order; variants cascade with their product. No reset/seed/drop.
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
