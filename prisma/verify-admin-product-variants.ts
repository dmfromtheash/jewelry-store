/**
 * AURELIA — Admin product variant management verification (Этап 30C)
 *
 * Proves the admin add/edit/delete + default-enforcement + deletion-safety logic
 * that backs the «Варианты» card, WITHOUT a browser:
 *   - the FIRST variant of a product auto-becomes default; a second can be
 *     non-default; setting the second default unsets the first (exactly one);
 *   - editing value/priceDelta/stock/sku persists;
 *   - a duplicate (productId, name, value) is rejected friendly (P2002), not a crash;
 *   - a priceDelta that would drop the product's final price to <= 0 is rejected;
 *   - deleting a non-default works; deleting the default promotes the next stable
 *     variant; deleting the last leaves no default;
 *   - deleting a variant referenced by a submitted/processing order is BLOCKED;
 *     deleting one referenced only by a completed/cancelled (terminal) order is
 *     allowed;
 *   - after all admin mutations, the 30B order-foundation resolver still resolves
 *     the default + applies priceDelta.
 *
 * The real logic lives in 'use server' actions (catalog-actions.ts), so this
 * MIRRORS their exact transactions (`ensureExactlyOneDefault`, the open-order
 * deletion guard, the final-price rule) while importing the SHARED 30B resolver
 * to prove compatibility. Works only on throwaway `zzz-verify-apv-` products and
 * `ZZZ-VERIFY-APV-` orders, deleted in `finally`. No reset/seed/drop. No secrets.
 * Run: npm run db:verify:admin-product-variants
 */

import { PrismaClient, OrderStatus, Prisma } from '@prisma/client'
import { resolveOrderLineVariant } from '../src/lib/orders/variants'

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

const PRODUCT_PREFIX = 'zzz-verify-apv-'
const ORDER_PREFIX = 'ZZZ-VERIFY-APV-'
let seq = 0
const uniqueProductSlug = () => `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
const uniqueOrderCode = () => `${ORDER_PREFIX}${Date.now()}-${seq++}`

let categoryId = ''
let categoryName = ''

const isP2002 = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

// ── Mirrors of catalog-actions.ts helpers ───────────────────────────────────
const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.submitted, OrderStatus.processing]

function finalPriceIsValid(basePrice: number | null, priceDelta: number | null): boolean {
  if (basePrice == null) return true
  return basePrice + (priceDelta ?? 0) > 0
}

async function ensureExactlyOneDefault(tx: Prisma.TransactionClient, productId: string) {
  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, isDefault: true, sortOrder: true, value: true },
  })
  if (variants.length === 0) return
  const defaults = variants.filter((v) => v.isDefault)
  if (defaults.length === 1) return
  const stable = [...variants].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value) || a.id.localeCompare(b.id),
  )[0]
  await tx.productVariant.updateMany({ where: { productId, isDefault: true }, data: { isDefault: false } })
  await tx.productVariant.update({ where: { id: stable.id }, data: { isDefault: true } })
}

type VarInput = {
  name?: string
  value: string
  sortOrder?: number
  isDefault?: boolean
  priceDelta?: number | null
  stockQuantity?: number | null
  sku?: string | null
}
type ActionResult = { ok: true; id: string } | { ok: false; error: string }

async function simAdd(productId: string, basePrice: number | null, input: VarInput): Promise<ActionResult> {
  if (!finalPriceIsValid(basePrice, input.priceDelta ?? null)) return { ok: false, error: 'pricetotal' }
  try {
    let id = ''
    await prisma.$transaction(async (tx) => {
      const count = await tx.productVariant.count({ where: { productId } })
      const makeDefault = (input.isDefault ?? false) || count === 0
      if (makeDefault) {
        await tx.productVariant.updateMany({ where: { productId, isDefault: true }, data: { isDefault: false } })
      }
      const v = await tx.productVariant.create({
        data: {
          productId,
          name: input.name ?? 'coating',
          value: input.value,
          sortOrder: input.sortOrder ?? 0,
          isDefault: makeDefault,
          priceDelta: input.priceDelta ?? null,
          stockQuantity: input.stockQuantity ?? null,
          sku: input.sku ?? null,
        },
        select: { id: true },
      })
      id = v.id
      await ensureExactlyOneDefault(tx, productId)
    })
    return { ok: true, id }
  } catch (e) {
    if (isP2002(e)) return { ok: false, error: 'duplicate' }
    throw e
  }
}

async function simUpdate(
  productId: string,
  basePrice: number | null,
  variantId: string,
  input: VarInput,
): Promise<ActionResult> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } })
  if (!variant || variant.productId !== productId) return { ok: false, error: 'notfound' }
  if (!finalPriceIsValid(basePrice, input.priceDelta ?? null)) return { ok: false, error: 'pricetotal' }
  try {
    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true, id: { not: variantId } },
          data: { isDefault: false },
        })
      }
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          name: input.name ?? 'coating',
          value: input.value,
          sortOrder: input.sortOrder ?? 0,
          isDefault: input.isDefault ?? false,
          priceDelta: input.priceDelta ?? null,
          stockQuantity: input.stockQuantity ?? null,
          sku: input.sku ?? null,
        },
      })
      await ensureExactlyOneDefault(tx, productId)
    })
    return { ok: true, id: variantId }
  } catch (e) {
    if (isP2002(e)) return { ok: false, error: 'duplicate' }
    throw e
  }
}

async function simDelete(productId: string, variantId: string): Promise<ActionResult> {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { productId: true } })
  if (!variant || variant.productId !== productId) return { ok: false, error: 'notfound' }
  const openRefs = await prisma.orderItem.count({
    where: { variantId, order: { status: { in: [...OPEN_ORDER_STATUSES] } } },
  })
  if (openRefs > 0) return { ok: false, error: 'inuse' }
  await prisma.$transaction(async (tx) => {
    await tx.productVariant.delete({ where: { id: variantId } })
    await ensureExactlyOneDefault(tx, productId)
  })
  return { ok: true, id: variantId }
}

// ── Test fixtures ────────────────────────────────────────────────────────────
async function createProduct(price: number | null): Promise<{ id: string; slug: string }> {
  return prisma.product.create({
    data: {
      slug: uniqueProductSlug(),
      name: 'APV verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: price == null ? 'coming_soon' : 'available',
      price,
      isPublished: true,
    },
    select: { id: true, slug: true },
  })
}

/** Creates an order with one OrderItem referencing the given variant + status. */
async function createOrderRef(variantId: string, productId: string, status: OrderStatus): Promise<string> {
  const orderCode = uniqueOrderCode()
  await prisma.order.create({
    data: {
      orderCode,
      status,
      customerName: 'APV Verify',
      customerPhone: '+380501234567',
      deliveryCity: 'Киев',
      deliveryMethod: 'nova_poshta',
      paymentMethod: 'manual_online',
      subtotalAmount: 100000,
      totalAmount: 100000,
      items: {
        create: [
          {
            productId,
            productSlug: 'apv-snapshot',
            productName: 'APV verify товар',
            variantId,
            variantName: 'coating',
            variantValue: 'snapshot',
            stockSource: 'variant',
            unitPrice: 100000,
            quantity: 1,
            lineTotal: 100000,
          },
        ],
      },
    },
  })
  return orderCode
}

const getVariant = (id: string) =>
  prisma.productVariant.findUnique({
    where: { id },
    select: { isDefault: true, value: true, priceDelta: true, stockQuantity: true, sku: true },
  })
const defaultCount = (productId: string) =>
  prisma.productVariant.count({ where: { productId, isDefault: true } })
const variantCount = (productId: string) => prisma.productVariant.count({ where: { productId } })

async function main() {
  const category = await prisma.category.findFirst({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true } })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // ── A: default enforcement on create + set-default ──
  console.log('default enforcement (first auto-default; set-default unsets sibling):')
  const pA = await createProduct(100000)
  const a1 = await simAdd(pA.id, 100000, { value: 'Сталь', sortOrder: 0 })
  check('first variant added', a1.ok)
  check('first variant is auto-default', a1.ok ? (await getVariant(a1.id))!.isDefault : false)
  const a2 = await simAdd(pA.id, 100000, { value: 'Позолота', sortOrder: 1, priceDelta: 50000, isDefault: false })
  check('second variant added non-default', a2.ok)
  check('second variant is NOT default', a2.ok ? !(await getVariant(a2.id))!.isDefault : false)
  check('exactly one default after two adds', (await defaultCount(pA.id)) === 1)
  if (a1.ok && a2.ok) {
    const setDef = await simUpdate(pA.id, 100000, a2.id, { value: 'Позолота', sortOrder: 1, priceDelta: 50000, isDefault: true })
    check('set second as default succeeds', setDef.ok)
    check('second is now default', (await getVariant(a2.id))!.isDefault)
    check('first is no longer default', !(await getVariant(a1.id))!.isDefault)
    check('still exactly one default', (await defaultCount(pA.id)) === 1)
  }

  // ── B: edit persists value/priceDelta/stock/sku ──
  console.log('edit persists fields:')
  if (a1.ok) {
    const upd = await simUpdate(pA.id, 100000, a1.id, { value: 'Сталь+', sortOrder: 0, priceDelta: -10000, stockQuantity: 7, sku: 'AU-APV-STEEL' })
    check('update succeeds', upd.ok)
    const row = await getVariant(a1.id)
    check('value persisted', row?.value === 'Сталь+')
    check('priceDelta persisted (-10000)', row?.priceDelta === -10000)
    check('stockQuantity persisted (7)', row?.stockQuantity === 7)
    check('sku persisted', row?.sku === 'AU-APV-STEEL')
  }

  // ── C: duplicate (name,value) rejected friendly ──
  console.log('duplicate (name,value) rejected:')
  const dup = await simAdd(pA.id, 100000, { value: 'Позолота' }) // same name 'coating' + value as a2
  check('duplicate variant rejected (not a crash)', !dup.ok && dup.error === 'duplicate')

  // ── D: priceDelta making final price <= 0 rejected ──
  console.log('priceDelta pushing final price <= 0 rejected:')
  const pD = await createProduct(100000)
  check('priceDelta = -100000 (final 0) rejected', !(await simAdd(pD.id, 100000, { value: 'Free', priceDelta: -100000 })).ok)
  check('priceDelta = -150000 (final < 0) rejected', !(await simAdd(pD.id, 100000, { value: 'Neg', priceDelta: -150000 })).ok)
  check('priceDelta = -99999 (final > 0) allowed', (await simAdd(pD.id, 100000, { value: 'Cheap', priceDelta: -99999 })).ok)
  // coming_soon product (null base price): delta allowed (order foundation guards price).
  const pSoon = await createProduct(null)
  check('negative delta allowed on unpriced product', (await simAdd(pSoon.id, null, { value: 'X', priceDelta: -5000 })).ok)

  // ── E: delete non-default; delete default promotes next; delete last → none ──
  console.log('deletion + default promotion:')
  const pE = await createProduct(100000)
  const e1 = await simAdd(pE.id, 100000, { value: 'A', sortOrder: 0 }) // auto-default
  const e2 = await simAdd(pE.id, 100000, { value: 'B', sortOrder: 1 })
  const e3 = await simAdd(pE.id, 100000, { value: 'C', sortOrder: 2 })
  if (e1.ok && e2.ok && e3.ok) {
    check('delete non-default (B) works', (await simDelete(pE.id, e2.id)).ok)
    check('2 variants remain', (await variantCount(pE.id)) === 2)
    check('default still A (untouched)', (await getVariant(e1.id))!.isDefault)
    // delete the default A → promote next stable (C, the lowest remaining sortOrder).
    check('delete default (A) works', (await simDelete(pE.id, e1.id)).ok)
    check('default promoted to C', (await getVariant(e3.id))!.isDefault)
    check('exactly one default after promotion', (await defaultCount(pE.id)) === 1)
    // delete the last variant → no default remains.
    check('delete last variant works', (await simDelete(pE.id, e3.id)).ok)
    check('no variants remain', (await variantCount(pE.id)) === 0)
    check('no default remains', (await defaultCount(pE.id)) === 0)
  }

  // ── F: deletion safety vs open / terminal orders ──
  console.log('deletion blocked by open orders, allowed for terminal:')
  const pF = await createProduct(100000)
  const fSubmitted = await simAdd(pF.id, 100000, { value: 'Sub', sortOrder: 0 })
  const fProcessing = await simAdd(pF.id, 100000, { value: 'Proc', sortOrder: 1 })
  const fDone = await simAdd(pF.id, 100000, { value: 'Done', sortOrder: 2 })
  const fCancelled = await simAdd(pF.id, 100000, { value: 'Canc', sortOrder: 3 })
  if (fSubmitted.ok && fProcessing.ok && fDone.ok && fCancelled.ok) {
    await createOrderRef(fSubmitted.id, pF.id, OrderStatus.submitted)
    await createOrderRef(fProcessing.id, pF.id, OrderStatus.processing)
    await createOrderRef(fDone.id, pF.id, OrderStatus.completed)
    await createOrderRef(fCancelled.id, pF.id, OrderStatus.cancelled)
    check('delete blocked: variant in submitted order', !(await simDelete(pF.id, fSubmitted.id)).ok)
    check('delete blocked: variant in processing order', !(await simDelete(pF.id, fProcessing.id)).ok)
    check('submitted-ref variant still exists', (await getVariant(fSubmitted.id)) != null)
    check('delete allowed: variant only in completed order', (await simDelete(pF.id, fDone.id)).ok)
    check('delete allowed: variant only in cancelled order', (await simDelete(pF.id, fCancelled.id)).ok)
  }

  // ── G: 30B foundation still resolves after admin mutations ──
  console.log('30B order-foundation resolver still works post-mutation:')
  const variantsA = await prisma.productVariant.findMany({
    where: { productId: pA.id },
    select: { id: true, name: true, value: true, sortOrder: true, isDefault: true, priceDelta: true, stockQuantity: true, sku: true },
  })
  const resDefault = resolveOrderLineVariant({ productPrice: 100000, productStock: null, variants: variantsA })
  check('resolver picks a default (no variantId)', resDefault.ok && resDefault.variant != null && resDefault.variant.isDefault)
  if (a2.ok) {
    const resGold = resolveOrderLineVariant({ productPrice: 100000, productStock: null, variants: variantsA, variantId: a2.id })
    check('resolver applies priceDelta for chosen variant (150000)', resGold.ok && resGold.unitPrice === 150000)
  }

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: admin variant create/edit/delete, default enforcement, duplicate + price guards, and open-order deletion safety all hold; 30B resolver intact.')
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
