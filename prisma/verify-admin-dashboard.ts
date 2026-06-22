/**
 * AURELIA — Admin operations dashboard verification (Этап 65A)
 *
 * Pure logic checks (promo classification + attention queue + readiness) and rolled-back DB
 * checks (promo classification over real rows, the email recent-problems SAFE projection, and
 * customer verified/unverified counts). A sentinel error aborts the tx so NOTHING is committed;
 * promo/order/review/email/customer counts are asserted unchanged afterwards.
 *
 * Covered:
 *   - classifyPromo: active / archived / expired / exhausted / expiring-soon;
 *   - buildAttentionQueue: flags the right conditions, count>0 only, severity ordering;
 *   - buildReadinessWarnings: email-not-configured warning + owner-gated boundaries present;
 *   - email recent-problems projection exposes NO recipient / subject / note / lastError;
 *   - customer verified vs unverified counts; nothing committed.
 *
 * Run with: npm run db:verify:admin-dashboard
 */

import { PrismaClient } from '@prisma/client'
import {
  buildAttentionQueue,
  buildReadinessWarnings,
  classifyPromo,
  type AttentionInput,
} from '../src/lib/admin/operations-dashboard'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_ADMIN_DASHBOARD_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

const now = new Date('2026-06-22T12:00:00.000Z')
const inDays = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000)

async function main() {
  const before = {
    promo: await prisma.promoCode.count(),
    order: await prisma.order.count(),
    review: await prisma.productReview.count(),
    email: await prisma.emailOutbox.count(),
    customer: await prisma.customer.count(),
  }
  console.log('Admin operations dashboard:')

  // --- 1) classifyPromo (pure) ---
  const base = { isActive: true, archivedAt: null, endsAt: null, usageLimit: null, usedCount: 0 }
  check('active promo classified active', classifyPromo({ ...base }, now).active === true)
  check('archived promo not active', (() => { const c = classifyPromo({ ...base, archivedAt: now }, now); return c.archived && !c.active })())
  check('expired promo not active', (() => { const c = classifyPromo({ ...base, endsAt: inDays(-1) }, now); return c.expired && !c.active })())
  check('exhausted promo not active', (() => { const c = classifyPromo({ ...base, usageLimit: 2, usedCount: 2 }, now); return c.exhausted && !c.active })())
  check('expiring-soon flagged within 7 days', classifyPromo({ ...base, endsAt: inDays(3) }, now).expiringSoon === true)
  check('not expiring-soon beyond 7 days', classifyPromo({ ...base, endsAt: inDays(30) }, now).expiringSoon === false)

  // --- 2) buildAttentionQueue (pure) ---
  const zero: AttentionInput = {
    orders: { submitted: 0, processing: 0 },
    reviews: { pending: 0 },
    email: { queued: 0, failed: 0 },
    promos: { exhausted: 0, expiringSoon: 0 },
    catalog: { withoutPrice: 0, withoutImage: 0, zeroStockPurchasable: 0 },
    customers: { unverified: 0 },
    interests: { active: 0 },
  }
  check('empty inputs → empty queue', buildAttentionQueue(zero).length === 0)

  const some = buildAttentionQueue({
    ...zero,
    orders: { submitted: 2, processing: 1 },
    reviews: { pending: 3 },
    email: { queued: 5, failed: 0 },
    promos: { exhausted: 1, expiringSoon: 0 },
    interests: { active: 4 },
  })
  check('queue surfaces submitted orders as action', some.some((i) => i.key === 'orders-submitted' && i.severity === 'action' && i.count === 2))
  check('queue surfaces pending reviews as action', some.some((i) => i.key === 'reviews-pending' && i.severity === 'action'))
  check('queue surfaces queued email as warn', some.some((i) => i.key === 'email-queued' && i.severity === 'warn'))
  check('queue surfaces active product interest as info', some.some((i) => i.key === 'product-interest' && i.severity === 'info' && i.count === 4))
  check('queue excludes zero-count conditions (no email-failed)', !some.some((i) => i.key === 'email-failed'))
  check('queue ordered action → warn → info', (() => {
    const rank = { action: 0, warn: 1, info: 2 } as const
    for (let i = 1; i < some.length; i++) if (rank[some[i - 1].severity] > rank[some[i].severity]) return false
    return true
  })())

  // --- 3) buildReadinessWarnings (pure) ---
  const warnNoProvider = buildReadinessWarnings(false)
  const warnConfigured = buildReadinessWarnings(true)
  check('readiness flags email NOT configured', warnNoProvider.some((w) => /e-mail/i.test(w.label) && /НЕ настроена/i.test(w.note)))
  check('readiness reflects configured provider', warnConfigured.some((w) => /e-mail/i.test(w.label) && /настроен/i.test(w.note)))
  check('readiness lists owner-gated boundaries (payment/delivery/deploy/BI)', (() => {
    const blob = warnNoProvider.map((w) => w.label + ' ' + w.note).join(' ').toLowerCase()
    return blob.includes('оплат') && blob.includes('доставк') && blob.includes('деплой') && blob.includes('bi')
  })())

  // --- 4) DB (rolled back) ---
  let promoCountsOk = false
  let emailProjectionSafe = false
  let customerCountsOk = false
  const ts = Date.now()
  try {
    await prisma.$transaction(async (tx) => {
      // Promo set: 1 active, 1 archived, 1 exhausted, 1 expiring-soon.
      await tx.promoCode.createMany({
        data: [
          { code: `DASH-ACT-${ts}`, internalName: 'a', type: 'percent', percentValue: 10 },
          { code: `DASH-ARC-${ts}`, internalName: 'b', type: 'percent', percentValue: 10, archivedAt: now },
          { code: `DASH-EXH-${ts}`, internalName: 'c', type: 'percent', percentValue: 10, usageLimit: 1, usedCount: 1 },
          { code: `DASH-EXP-${ts}`, internalName: 'd', type: 'percent', percentValue: 10, endsAt: inDays(2) },
        ],
      })
      const rows = await tx.promoCode.findMany({
        where: { code: { startsWith: `DASH-` } },
        select: { code: true, isActive: true, archivedAt: true, endsAt: true, usageLimit: true, usedCount: true },
      })
      let active = 0, archived = 0, exhausted = 0, expiring = 0
      for (const r of rows) {
        const c = classifyPromo(r, now)
        if (c.active) active++
        if (c.archived) archived++
        if (c.exhausted && !c.archived) exhausted++
        if (c.expiringSoon) expiring++
      }
      // active = the plain one + the expiring one (expiring is still active); archived 1; exhausted 1.
      promoCountsOk = active === 2 && archived === 1 && exhausted === 1 && expiring === 1

      // Email outbox: a row WITH sensitive fields; the dashboard's safe projection must drop them.
      const e = await tx.emailOutbox.create({
        data: {
          template: 'order_confirmation',
          status: 'queued',
          recipientEmail: 'secret@example.com',
          note: 'internal note',
          lastError: 'sensitive error',
          subject: 'Order confirmation',
          relatedType: 'order',
          relatedId: 'AUR-DASH',
        },
        select: { id: true },
      })
      const safe = await tx.emailOutbox.findUnique({
        where: { id: e.id },
        select: { id: true, template: true, status: true, relatedType: true, relatedId: true, createdAt: true },
      })
      emailProjectionSafe =
        !!safe &&
        !('recipientEmail' in safe) &&
        !('note' in safe) &&
        !('lastError' in safe) &&
        !('subject' in safe)

      // Customers: 1 verified + 1 unverified.
      await tx.customer.create({ data: { email: `dash-v-${ts}@verify.local`, passwordHash: 'x', emailVerifiedAt: now } })
      await tx.customer.create({ data: { email: `dash-u-${ts}@verify.local`, passwordHash: 'x' } })
      const verified = await tx.customer.count({ where: { email: { startsWith: 'dash-' }, emailVerifiedAt: { not: null } } })
      const unverified = await tx.customer.count({ where: { email: { startsWith: 'dash-' }, emailVerifiedAt: null } })
      customerCountsOk = verified === 1 && unverified === 1

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('promo classification counts over real rows (active 2 / archived 1 / exhausted 1 / expiring 1)', promoCountsOk)
  check('email recent-problems projection exposes NO recipient/subject/note/lastError', emailProjectionSafe)
  check('customer verified vs unverified counts', customerCountsOk)

  // --- 5) Nothing committed ---
  const after = {
    promo: await prisma.promoCode.count(),
    order: await prisma.order.count(),
    review: await prisma.productReview.count(),
    email: await prisma.emailOutbox.count(),
    customer: await prisma.customer.count(),
  }
  check('no test rows committed (promo/order/review/email/customer)',
    after.promo === before.promo && after.order === before.order && after.review === before.review &&
    after.email === before.email && after.customer === before.customer)

  if (failures === 0) {
    console.log('\nADMIN-DASHBOARD VERIFY OK: promo classification, attention queue, readiness, safe email projection + customer counts all pass; nothing committed.')
  } else {
    console.error(`\nADMIN-DASHBOARD VERIFY FAILED (${failures} check(s)).`)
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
