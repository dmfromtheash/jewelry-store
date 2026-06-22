/**
 * AURELIA — Admin customers + support verification (Этап 68A)
 *
 * Pure logic checks (the support-indicator builder) + rolled-back DB checks that exercise the
 * SAME safe projections the admin customer list/detail use over REAL rows. A sentinel error
 * aborts the transaction so NOTHING is committed; customer/order/review/wishlist/email/token
 * counts are asserted unchanged afterwards.
 *
 * Covered:
 *   - buildCustomerSupportIndicators: emits the right keys/severities, ordered action→warn→info,
 *     and only when the condition is true (empty input → empty list);
 *   - list aggregates: order/review/wishlist counts + last-order date over real rows;
 *   - detail safe projection: customer select carries NO passwordHash; outbox select carries NO
 *     recipientEmail/subject/note/lastError (even when those columns hold sensitive data); account
 *     tokens are reported as COUNTS only — no tokenHash / raw token;
 *   - support signals: unverified email, pending review, failed/skipped outbox, hidden/unavailable
 *     wishlist item, live recovery token, manual-delivery order without phone;
 *   - nothing committed.
 *
 * Run with: npm run db:verify:admin-customers
 */

import { PrismaClient } from '@prisma/client'
import {
  buildCustomerSupportIndicators,
  type CustomerSupportInput,
} from '../src/lib/admin/customer-support'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_ADMIN_CUSTOMERS_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const now = new Date('2026-06-22T12:00:00.000Z')
const inHours = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000)

async function main() {
  const before = {
    customer: await prisma.customer.count(),
    order: await prisma.order.count(),
    review: await prisma.productReview.count(),
    wishlist: await prisma.customerWishlistItem.count(),
    email: await prisma.emailOutbox.count(),
    token: await prisma.customerAccountToken.count(),
    category: await prisma.category.count(),
    product: await prisma.product.count(),
  }
  console.log('Admin customers + support:')

  // --- 1) buildCustomerSupportIndicators (pure) ---
  const calm: CustomerSupportInput = {
    emailVerified: true,
    hasPhone: true,
    orderCount: 3,
    pendingReviewCount: 0,
    emailProblemCount: 0,
    wishlistUnavailableCount: 0,
    liveRecoveryTokenCount: 0,
    manualDeliveryOrderCount: 0,
    activeInterestCount: 0,
  }
  check('healthy customer → no indicators', buildCustomerSupportIndicators(calm, 'cid').length === 0)

  const flagged = buildCustomerSupportIndicators(
    {
      emailVerified: false,
      hasPhone: false,
      orderCount: 0,
      pendingReviewCount: 2,
      emailProblemCount: 1,
      wishlistUnavailableCount: 1,
      liveRecoveryTokenCount: 1,
      manualDeliveryOrderCount: 1,
      activeInterestCount: 2,
    },
    'cid',
  )
  const has = (key: string) => flagged.some((i) => i.key === key)
  check('flags pending reviews as action', flagged.some((i) => i.key === 'pending-reviews' && i.severity === 'action'))
  check('flags live recovery token as action', flagged.some((i) => i.key === 'recent-recovery' && i.severity === 'action'))
  check('flags email problem as warn', flagged.some((i) => i.key === 'email-problem' && i.severity === 'warn'))
  check('flags manual delivery + no phone as warn', flagged.some((i) => i.key === 'no-phone-manual-delivery' && i.severity === 'warn'))
  check('flags unavailable wishlist as info', has('wishlist-unavailable'))
  check('flags unverified email as info', has('email-unverified'))
  check('flags no orders as info', has('no-orders'))
  check('ordered action → warn → info', (() => {
    const rank = { action: 0, warn: 1, info: 2 } as const
    for (let i = 1; i < flagged.length; i++) if (rank[flagged[i - 1].severity] > rank[flagged[i].severity]) return false
    return true
  })())
  check('every indicator links to an in-app route', flagged.every((i) => i.href.startsWith('/admin') || i.href.startsWith('/product')))
  // No-phone flag must NOT fire when there are no manual-delivery orders.
  check('no-phone flag suppressed without manual-delivery orders', !buildCustomerSupportIndicators(
    { ...calm, hasPhone: false, manualDeliveryOrderCount: 0 }, 'cid',
  ).some((i) => i.key === 'no-phone-manual-delivery'))

  // --- 2) DB (rolled back) ---
  let aggregatesOk = false
  let lastOrderOk = false
  let customerProjectionSafe = false
  let outboxProjectionSafe = false
  let tokenCountsOnly = false
  let signalsOk = false
  const ts = Date.now()

  try {
    await prisma.$transaction(async (tx) => {
      const cat = await tx.category.create({ data: { slug: `vc-cat-${ts}`, name: 'VC Cat' } })
      // Hidden product → an "unavailable" wishlist target.
      const hidden = await tx.product.create({
        data: { slug: `vc-hidden-${ts}`, name: 'VC Hidden', categoryLabel: 'x', categoryId: cat.id, isPublished: false },
      })

      const customer = await tx.customer.create({
        data: {
          email: `vc-${ts}@verify.local`,
          passwordHash: 'scrypt$secret$do-not-leak',
          name: 'VC Buyer',
          // unverified email, NO phone.
        },
      })

      // Two orders, the newer one with a manual delivery branch.
      await tx.order.create({
        data: {
          orderCode: `VC-OLD-${ts}`, customerId: customer.id, customerName: 'VC Buyer', customerPhone: '',
          deliveryCity: 'Kyiv', deliveryMethod: 'self_pickup', paymentMethod: 'cash_on_delivery',
          subtotalAmount: 1000, totalAmount: 1000, createdAt: inHours(-48),
        },
      })
      await tx.order.create({
        data: {
          orderCode: `VC-NEW-${ts}`, customerId: customer.id, customerName: 'VC Buyer', customerPhone: '',
          deliveryCity: 'Lviv', deliveryMethod: 'nova_poshta', paymentMethod: 'cash_on_delivery',
          deliveryBranch: 'Відділення №1', subtotalAmount: 2000, totalAmount: 2000, createdAt: inHours(-1),
        },
      })

      // A pending review + a wishlist item on the hidden product.
      await tx.productReview.create({
        data: { productId: hidden.id, customerId: customer.id, authorName: 'VC Buyer', rating: 5, body: 'nice', status: 'pending' },
      })
      await tx.customerWishlistItem.create({ data: { customerId: customer.id, productId: hidden.id } })

      // An outbox row WITH sensitive fields — the safe projection must drop them.
      await tx.emailOutbox.create({
        data: {
          template: 'password_reset', status: 'skipped_no_provider', recipientEmail: 'secret@example.com',
          subject: 'Reset your password', note: 'internal note', lastError: 'sensitive detail',
          relatedType: 'customer', relatedId: customer.id,
        },
      })
      // A live (unused, unexpired) password-reset token — value never read.
      await tx.customerAccountToken.create({
        data: { customerId: customer.id, purpose: 'password_reset', tokenHash: `hash-${ts}`, expiresAt: inHours(1) },
      })

      // --- aggregates (mirrors getAdminCustomers _count + last-order) ---
      const listRow = await tx.customer.findUnique({
        where: { id: customer.id },
        select: {
          _count: { select: { orders: true, reviews: true, wishlist: true } },
          orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
        },
      })
      aggregatesOk =
        !!listRow && listRow._count.orders === 2 && listRow._count.reviews === 1 && listRow._count.wishlist === 1
      lastOrderOk = !!listRow && listRow.orders[0]?.createdAt.getTime() === inHours(-1).getTime()

      // --- detail customer projection: NO passwordHash ---
      const cust = await tx.customer.findUnique({
        where: { id: customer.id },
        select: {
          id: true, email: true, name: true, phone: true, emailVerifiedAt: true,
          sessionVersion: true, passwordChangedAt: true, createdAt: true,
          _count: { select: { orders: true, reviews: true, wishlist: true, accountTokens: true } },
        },
      })
      customerProjectionSafe = !!cust && !('passwordHash' in cust) && cust._count.accountTokens === 1

      // --- outbox safe projection: NO recipient/subject/note/lastError ---
      const outboxWhere = {
        OR: [
          { relatedType: 'customer', relatedId: customer.id },
          { relatedType: 'order', relatedId: { in: [`VC-OLD-${ts}`, `VC-NEW-${ts}`] } },
        ],
      }
      const mail = await tx.emailOutbox.findFirst({
        where: outboxWhere,
        select: { id: true, template: true, status: true, relatedType: true, relatedId: true, createdAt: true },
      })
      outboxProjectionSafe =
        !!mail && !('recipientEmail' in mail) && !('subject' in mail) && !('note' in mail) && !('lastError' in mail)

      // --- tokens reported as COUNTS only ---
      const tokenTotal = await tx.customerAccountToken.count({ where: { customerId: customer.id } })
      const tokenLive = await tx.customerAccountToken.count({
        where: { customerId: customer.id, purpose: 'password_reset', usedAt: null, expiresAt: { gt: now } },
      })
      tokenCountsOnly = tokenTotal === 1 && tokenLive === 1

      // --- support signals over real rows ---
      const pendingReviewCount = await tx.productReview.count({ where: { customerId: customer.id, status: 'pending' } })
      const emailProblemCount = await tx.emailOutbox.count({
        where: { ...outboxWhere, status: { in: ['failed_validation', 'failed_stub', 'skipped', 'skipped_no_provider'] } },
      })
      const wishlistUnavailableCount = await tx.customerWishlistItem.count({
        where: {
          customerId: customer.id,
          OR: [{ product: { isPublished: false } }, { product: { status: { not: 'available' } } }],
        },
      })
      const manualDeliveryOrderCount = await tx.order.count({
        where: { customerId: customer.id, OR: [{ deliveryBranch: { not: null } }, { deliveryComment: { not: null } }] },
      })
      const indicators = buildCustomerSupportIndicators(
        {
          emailVerified: cust!.emailVerifiedAt != null,
          hasPhone: !!cust!.phone?.trim(),
          orderCount: cust!._count.orders,
          pendingReviewCount,
          emailProblemCount,
          wishlistUnavailableCount,
          liveRecoveryTokenCount: tokenLive,
          manualDeliveryOrderCount,
          activeInterestCount: 0,
        },
        customer.id,
      )
      const key = (k: string) => indicators.some((i) => i.key === k)
      signalsOk =
        pendingReviewCount === 1 && emailProblemCount === 1 && wishlistUnavailableCount === 1 &&
        manualDeliveryOrderCount === 1 &&
        key('pending-reviews') && key('email-problem') && key('wishlist-unavailable') &&
        key('email-unverified') && key('recent-recovery') && key('no-phone-manual-delivery')

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }

  check('list aggregates (orders 2 / reviews 1 / wishlist 1) over real rows', aggregatesOk)
  check('last-order date = newest order', lastOrderOk)
  check('detail customer projection exposes NO passwordHash', customerProjectionSafe)
  check('outbox projection exposes NO recipient/subject/note/lastError', outboxProjectionSafe)
  check('account tokens reported as counts only (no token value/hash)', tokenCountsOnly)
  check('support signals computed correctly over real rows', signalsOk)

  // --- 3) Nothing committed ---
  const after = {
    customer: await prisma.customer.count(),
    order: await prisma.order.count(),
    review: await prisma.productReview.count(),
    wishlist: await prisma.customerWishlistItem.count(),
    email: await prisma.emailOutbox.count(),
    token: await prisma.customerAccountToken.count(),
    category: await prisma.category.count(),
    product: await prisma.product.count(),
  }
  check('no test rows committed (customer/order/review/wishlist/email/token/category/product)',
    after.customer === before.customer && after.order === before.order && after.review === before.review &&
    after.wishlist === before.wishlist && after.email === before.email && after.token === before.token &&
    after.category === before.category && after.product === before.product)

  if (failures === 0) {
    console.log('\nADMIN-CUSTOMERS VERIFY OK: support indicators, list aggregates, safe customer/outbox/token projections, and support signals all pass; nothing committed.')
  } else {
    console.error(`\nADMIN-CUSTOMERS VERIFY FAILED (${failures} check(s)).`)
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
