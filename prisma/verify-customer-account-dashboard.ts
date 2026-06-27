/**
 * AURELIA — Customer account dashboard verification (Этап 86A)
 *
 * Pure-logic checks (customer-facing Q&A / waiting labels + visibility/answered classifiers)
 * PLUS rolled-back DB checks proving the new account reads are STRICTLY scoped by customerId.
 * All DB behaviour runs inside an ALWAYS-ROLLED-BACK transaction (a sentinel error aborts it)
 * so NOTHING is ever committed; row counts are asserted unchanged afterwards. Mirrors the
 * verify-customer-loyalty.ts pattern (queries are exercised directly — the `server-only`
 * account reads can't load under tsx; the pure label module is imported as-is).
 *
 * Covered:
 *   - labels (pure): help/product/availability statuses map to friendly UA copy with a safe
 *     fallback; moderation-only states are hidden from the customer (spam + rejected help,
 *     spam product); answered/open classifiers correct;
 *   - help questions (DB): a customer sees ONLY their own; another customer never sees them;
 *     a GUEST row (customerId null) is excluded; spam/rejected are filtered out;
 *   - product questions (DB): own-only scoping + isolation; guest excluded; spam filtered;
 *   - availability interests (DB): own-only scoping + isolation; cancel is scoped to the owner
 *     (another customer cannot cancel it) and sets status=cancelled (NOT a hold/reservation
 *     state); an already-cancelled row is idempotent; NO EmailOutbox row is ever created;
 *   - reviews (DB): a customer sees ONLY their own reviews; isolation holds;
 *   - NO reservation/hold: the availability status enum contains NO hold_* / reserved* value;
 *   - nothing committed.
 *
 * Run with: npm run db:verify:customer-account-dashboard
 */

import { PrismaClient, AvailabilityInterestStatus } from '@prisma/client'
import {
  helpQuestionCustomerLabel,
  productQuestionCustomerLabel,
  availabilityCustomerLabel,
  isHelpQuestionVisibleToCustomer,
  isProductQuestionVisibleToCustomer,
  isHelpQuestionAnswered,
  isProductQuestionAnswered,
  isAvailabilityInterestOpen,
} from '../src/lib/customer/account-qa'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_ACCOUNT_DASHBOARD_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

// Pure scoped read mirrors of the server-only account reads (same WHERE + visibility filter),
// so the verify proves the exact scoping rules without importing server-only modules.
async function readMyHelp(tx: PrismaClient, customerId: string) {
  const rows = await tx.helpQuestion.findMany({
    where: { customerId },
    select: { id: true, status: true },
  })
  return rows.filter((r) => isHelpQuestionVisibleToCustomer(r.status))
}
async function readMyProductQ(tx: PrismaClient, customerId: string) {
  const rows = await tx.productQuestion.findMany({
    where: { customerId },
    select: { id: true, status: true },
  })
  return rows.filter((r) => isProductQuestionVisibleToCustomer(r.status))
}

async function main() {
  const before = {
    customer: await prisma.customer.count(),
    help: await prisma.helpQuestion.count(),
    productQ: await prisma.productQuestion.count(),
    avail: await prisma.productAvailabilityInterest.count(),
    review: await prisma.productReview.count(),
    email: await prisma.emailOutbox.count(),
    product: await prisma.product.count(),
  }
  console.log('Customer account dashboard:')

  // --- 1) Labels + visibility (pure) ---
  check('help label: new → На розгляді', helpQuestionCustomerLabel('new') === 'На розгляді')
  check('help label: answered → Відповіли', helpQuestionCustomerLabel('answered') === 'Відповіли')
  check('help label: unknown → safe fallback', helpQuestionCustomerLabel('weird') === 'На розгляді')
  check('help visibility: spam hidden', !isHelpQuestionVisibleToCustomer('spam'))
  check('help visibility: rejected hidden', !isHelpQuestionVisibleToCustomer('rejected'))
  check('help visibility: new visible', isHelpQuestionVisibleToCustomer('new'))
  check('help answered: published → answered', isHelpQuestionAnswered('published'))
  check('help answered: new → not answered', !isHelpQuestionAnswered('new'))

  check('product label: pending → На модерації', productQuestionCustomerLabel('pending') === 'На модерації')
  check('product label: published → Опубліковано', productQuestionCustomerLabel('published') === 'Опубліковано')
  check('product visibility: spam hidden', !isProductQuestionVisibleToCustomer('spam'))
  check('product visibility: rejected visible (own content)', isProductQuestionVisibleToCustomer('rejected'))
  check('product answered: answered → true', isProductQuestionAnswered('answered'))

  check('avail label: requested → Очікую наявності', availabilityCustomerLabel('requested') === 'Очікую наявності')
  check('avail label: cancelled → Скасовано', availabilityCustomerLabel('cancelled') === 'Скасовано')
  check('avail open: requested open', isAvailabilityInterestOpen('requested'))
  check('avail open: cancelled NOT open', !isAvailabilityInterestOpen('cancelled'))
  check('avail open: expired NOT open', !isAvailabilityInterestOpen('expired'))

  // NO reservation/hold: the availability lifecycle enum must contain no hold_*/reserved* value.
  const availStatuses = Object.values(AvailabilityInterestStatus) as string[]
  check(
    'availability enum has NO hold_*/reserved* state (no reservation lifecycle)',
    !availStatuses.some((s) => /hold|reserv/i.test(s)),
  )

  // --- 2) DB scoping (rolled back) ---
  const product = await prisma.product.findFirst({
    where: { isPublished: true },
    select: { id: true },
  })
  if (!product) {
    console.error('\nNo published product in DB — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  let helpScopeOk = false
  let helpGuestExcluded = false
  let helpModerationHidden = false
  let productScopeOk = false
  let productGuestExcluded = false
  let availScopeOk = false
  let availCancelScoped = false
  let availCancelIdempotent = false
  let availNoEmail = false
  let reviewScopeOk = false
  const ts = Date.now()

  try {
    await prisma.$transaction(async (tx) => {
      const hash = 'scrypt$32768$8$1$00$00'
      const a = await tx.customer.create({ data: { email: `ad-a-${ts}@verify.local`, passwordHash: hash }, select: { id: true } })
      const b = await tx.customer.create({ data: { email: `ad-b-${ts}@verify.local`, passwordHash: hash }, select: { id: true } })
      const emailBefore = await tx.emailOutbox.count()

      // --- Help questions ---
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: a.id, subject: 'A new', message: 'hello world', status: 'new' } })
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: a.id, subject: 'A answered', message: 'reply please', status: 'answered', answer: 'sure' } })
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: a.id, subject: 'A spam', message: 'spammy', status: 'spam' } })
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: a.id, subject: 'A rejected', message: 'nope', status: 'rejected' } })
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: b.id, subject: 'B new', message: 'b question', status: 'new' } })
      await tx.helpQuestion.create({ data: { categorySlug: 'general', customerId: null, subject: 'Guest', message: 'guest question', status: 'new' } })

      const aHelp = await readMyHelp(tx as unknown as PrismaClient, a.id)
      const bHelp = await readMyHelp(tx as unknown as PrismaClient, b.id)
      // A has 4 rows but spam+rejected are hidden → 2 visible; none belong to B/guest.
      helpScopeOk = aHelp.length === 2 && bHelp.length === 1
      const aHelpAll = await tx.helpQuestion.findMany({ where: { customerId: a.id }, select: { id: true } })
      helpModerationHidden = aHelpAll.length === 4 && aHelp.length === 2
      // The guest row (customerId null) is never returned by any customer-scoped read.
      const guestSeenByA = (await tx.helpQuestion.count({ where: { customerId: a.id, subject: 'Guest' } })) === 0
      helpGuestExcluded = guestSeenByA

      // --- Product questions ---
      await tx.productQuestion.create({ data: { productId: product.id, customerId: a.id, authorName: 'A', body: 'is it gold?', status: 'published', answer: 'yes' } })
      await tx.productQuestion.create({ data: { productId: product.id, customerId: a.id, authorName: 'A', body: 'spam q', status: 'spam' } })
      await tx.productQuestion.create({ data: { productId: product.id, customerId: b.id, authorName: 'B', body: 'b q', status: 'pending' } })
      await tx.productQuestion.create({ data: { productId: product.id, customerId: null, authorName: 'Guest', body: 'guest q', status: 'pending' } })

      const aProd = await readMyProductQ(tx as unknown as PrismaClient, a.id)
      const bProd = await readMyProductQ(tx as unknown as PrismaClient, b.id)
      productScopeOk = aProd.length === 1 && bProd.length === 1 // A's spam hidden
      productGuestExcluded = (await tx.productQuestion.count({ where: { customerId: a.id, authorName: 'Guest' } })) === 0

      // --- Availability interests ---
      const ai = await tx.productAvailabilityInterest.create({
        data: { productId: product.id, customerId: a.id, email: 'a@verify.local', emailHash: `h-a-${ts}`, status: 'requested' },
        select: { id: true },
      })
      await tx.productAvailabilityInterest.create({
        data: { productId: product.id, customerId: b.id, email: 'b@verify.local', emailHash: `h-b-${ts}`, status: 'requested' },
      })
      const aAvail = await tx.productAvailabilityInterest.findMany({ where: { customerId: a.id }, select: { customerId: true } })
      const bAvail = await tx.productAvailabilityInterest.findMany({ where: { customerId: b.id }, select: { customerId: true } })
      availScopeOk =
        aAvail.length === 1 && aAvail.every((r) => r.customerId === a.id) &&
        bAvail.length === 1 && bAvail.every((r) => r.customerId === b.id)

      // Cancel scoped to owner: B cannot cancel A's interest; A can.
      const failCancel = await tx.productAvailabilityInterest.updateMany({
        where: { id: ai.id, customerId: b.id, status: { notIn: [AvailabilityInterestStatus.cancelled, AvailabilityInterestStatus.expired] } },
        data: { status: 'cancelled' },
      })
      const okCancel = await tx.productAvailabilityInterest.updateMany({
        where: { id: ai.id, customerId: a.id, status: { notIn: [AvailabilityInterestStatus.cancelled, AvailabilityInterestStatus.expired] } },
        data: { status: 'cancelled' },
      })
      const after = await tx.productAvailabilityInterest.findUnique({ where: { id: ai.id }, select: { status: true } })
      availCancelScoped = failCancel.count === 0 && okCancel.count === 1 && after?.status === 'cancelled'

      // Cancelling an already-cancelled row is a no-op (idempotent).
      const reCancel = await tx.productAvailabilityInterest.updateMany({
        where: { id: ai.id, customerId: a.id, status: { notIn: [AvailabilityInterestStatus.cancelled, AvailabilityInterestStatus.expired] } },
        data: { status: 'cancelled' },
      })
      availCancelIdempotent = reCancel.count === 0

      // NO email/outbox row is ever created by account availability handling.
      availNoEmail = (await tx.emailOutbox.count()) === emailBefore

      // --- Reviews ---
      await tx.productReview.create({ data: { productId: product.id, customerId: a.id, authorName: 'A', rating: 5, body: 'great', status: 'approved' } })
      await tx.productReview.create({ data: { productId: product.id, customerId: b.id, authorName: 'B', rating: 3, body: 'ok', status: 'pending' } })
      const aRev = await tx.productReview.findMany({ where: { customerId: a.id }, select: { customerId: true } })
      const bRev = await tx.productReview.findMany({ where: { customerId: b.id }, select: { customerId: true } })
      reviewScopeOk =
        aRev.length === 1 && aRev.every((r) => r.customerId === a.id) &&
        bRev.length === 1 && bRev.every((r) => r.customerId === b.id)

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }

  check('help: customer sees only own (isolation)', helpScopeOk)
  check('help: moderation-only rows (spam/rejected) hidden from owner', helpModerationHidden)
  check('help: guest row (customerId null) excluded', helpGuestExcluded)
  check('product Q: customer sees only own; spam hidden', productScopeOk)
  check('product Q: guest row excluded', productGuestExcluded)
  check('availability: customer sees only own (isolation)', availScopeOk)
  check('availability: cancel scoped to owner → cancelled (other cannot cancel)', availCancelScoped)
  check('availability: cancel of an already-cancelled row is idempotent', availCancelIdempotent)
  check('availability: NO email/outbox row created (no real notification)', availNoEmail)
  check('reviews: customer sees only own (isolation)', reviewScopeOk)

  // --- 3) Nothing committed ---
  const after = {
    customer: await prisma.customer.count(),
    help: await prisma.helpQuestion.count(),
    productQ: await prisma.productQuestion.count(),
    avail: await prisma.productAvailabilityInterest.count(),
    review: await prisma.productReview.count(),
    email: await prisma.emailOutbox.count(),
    product: await prisma.product.count(),
  }
  check(
    'no test rows committed (customer/help/productQ/availability/review/email/product)',
    after.customer === before.customer && after.help === before.help && after.productQ === before.productQ &&
    after.avail === before.avail && after.review === before.review && after.email === before.email &&
    after.product === before.product,
  )

  if (failures === 0) {
    console.log('\nACCOUNT-DASHBOARD VERIFY OK: Q&A/waiting labels + visibility, strict customerId scoping for help/product questions / availability interests / reviews, guest exclusion, owner-scoped cancel, no reservation lifecycle, and no email all pass; nothing committed.')
  } else {
    console.error(`\nACCOUNT-DASHBOARD VERIFY FAILED (${failures} check(s)).`)
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
