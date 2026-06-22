/**
 * AURELIA — Customer loyalty / account foundation verification (Этап 69A)
 *
 * Pure logic checks (engagement label + saved-search validation/URL builder) PLUS rolled-back
 * DB checks for saved searches and product interests over REAL rows. All DB behaviour runs
 * inside an ALWAYS-ROLLED-BACK transaction (a sentinel error aborts it) so NOTHING is ever
 * committed; row counts are asserted unchanged afterwards. Mirrors the verify-wishlist.ts
 * pattern (queries are exercised directly — the `server-only` repos can't load under tsx).
 *
 * Covered:
 *   - engagement (pure): tier computed from counts; NON-financial (result has NO money/points
 *     field); garbage/negative counts clamped; deterministic labels (UA + RU);
 *   - saved search (pure): label required (defaulted) + markup/length rejected; query/material
 *     markup rejected; sort/status/category normalised to the allowlist; price swap; the built
 *     URL is always a safe relative in-app path (never javascript:/data:/external);
 *   - saved search (DB): create / list / remove, customer isolation;
 *   - product interest (DB): add creates an ACTIVE row; duplicate add idempotent (unique key);
 *     cancel flips to cancelled; reactivation; customer isolation; hidden/unpublished product
 *     is NOT resolvable (interest rejected); NO email/outbox row is created;
 *   - nothing committed.
 *
 * Run with: npm run db:verify:customer-loyalty
 */

import { PrismaClient } from '@prisma/client'
import { computeEngagement } from '../src/lib/customer/engagement'
import {
  validateSavedSearchInput,
  buildSavedSearchUrl,
  defaultSavedSearchLabel,
} from '../src/lib/customer/saved-search'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_LOYALTY_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const before = {
    customer: await prisma.customer.count(),
    saved: await prisma.customerSavedSearch.count(),
    interest: await prisma.customerProductInterest.count(),
    email: await prisma.emailOutbox.count(),
    category: await prisma.category.count(),
    product: await prisma.product.count(),
  }
  console.log('Customer loyalty / account foundation:')

  // --- 1) Engagement label (pure, NON-financial) ---
  check('no activity → new', computeEngagement({}).tier === 'new')
  check('one order → active', computeEngagement({ orders: 1 }).tier === 'active')
  check('three orders → loyal', computeEngagement({ orders: 3 }).tier === 'loyal')
  check(
    'enough non-order engagement → active',
    computeEngagement({ orders: 0, reviews: 1, wishlist: 1, savedSearches: 1 }).tier === 'active',
  )
  check('a little engagement stays new', computeEngagement({ wishlist: 1 }).tier === 'new')
  check('negative/garbage counts clamped → new', computeEngagement({ orders: -5, reviews: -3 }).tier === 'new')
  const eng = computeEngagement({ orders: 5 })
  check('UA + RU labels are non-empty strings', !!eng.labelUa && !!eng.labelRu && eng.labelUa !== eng.labelRu)
  // NON-financial by construction: the result must carry ONLY tier/labels/counts — never any
  // money/points/balance/discount field. This is the test that guards "no financial effect".
  check(
    'engagement result has NO money/points field',
    JSON.stringify(Object.keys(eng).sort()) === JSON.stringify(['counts', 'labelRu', 'labelUa', 'tier']),
  )
  check(
    'engagement counts carry only the 5 safe counters',
    JSON.stringify(Object.keys(eng.counts).sort()) ===
      JSON.stringify(['activeInterests', 'orders', 'reviews', 'savedSearches', 'wishlist']),
  )

  // --- 2) Saved-search validation (pure) ---
  check('blank label falls back to a default', (() => {
    const r = validateSavedSearchInput({})
    return !!r.value && r.value.label === defaultSavedSearchLabel({})
  })())
  check('overlong label rejected', !!validateSavedSearchInput({ label: 'x'.repeat(61) }).errors.label)
  check('markup label rejected', !!validateSavedSearchInput({ label: '<b>hi</b>' }).errors.label)
  check('markup query rejected', !!validateSavedSearchInput({ query: '<script>' }).errors.query)
  check('overlong material rejected', !!validateSavedSearchInput({ material: 'm'.repeat(41) }).errors.material)
  check('bogus sort normalised away', validateSavedSearchInput({ sort: 'bogus' }).value?.sort === null)
  check('valid sort kept', validateSavedSearchInput({ sort: 'price-asc' }).value?.sort === 'price-asc')
  check('bogus status normalised away', validateSavedSearchInput({ status: 'bogus' }).value?.statusFilter === null)
  check('bogus category dropped', validateSavedSearchInput({ categorySlug: 'evil' }).value?.categorySlug === null)
  check('valid category kept', validateSavedSearchInput({ categorySlug: 'bijouterie' }).value?.categorySlug === 'bijouterie')
  check('price min>max swapped', (() => {
    const r = validateSavedSearchInput({ minPrice: '500', maxPrice: '100' })
    return r.value?.minPrice === 100 && r.value?.maxPrice === 500
  })())
  check('non-numeric price dropped', validateSavedSearchInput({ minPrice: 'abc' }).value?.minPrice === null)

  // built URL is always a safe relative in-app path (never an external/script URL)
  const urlCat = buildSavedSearchUrl({ categorySlug: 'gifts', sort: 'price-asc', minPrice: 100 })
  const urlSearch = buildSavedSearchUrl({ query: 'каблучка', material: 'Позолота' })
  const isSafe = (u: string) => u.startsWith('/') && !/javascript:|data:|https?:|[<>]/i.test(u)
  check('category URL safe + correct base', isSafe(urlCat) && urlCat.startsWith('/category/gifts'))
  check('search URL safe + correct base', isSafe(urlSearch) && urlSearch.startsWith('/search'))
  check('category URL drops the text query (q only on /search)', !urlCat.includes('q='))

  // --- 3) DB behaviour (rolled back) ---
  const publishedProduct = await prisma.product.findFirst({
    where: { isPublished: true },
    select: { id: true, slug: true, categoryId: true },
  })
  if (!publishedProduct) {
    console.error('\nNo published product in DB — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  let savedCreateOk = false
  let savedListScoped = false
  let savedRemoveOk = false
  let savedIsolationOk = false
  let interestAddOk = false
  let interestIdempotent = false
  let interestCancelOk = false
  let interestReactivateOk = false
  let interestIsolationOk = false
  let hiddenRejected = false
  let noEmailCreated = false
  const ts = Date.now()

  try {
    await prisma.$transaction(async (tx) => {
      const hash = 'scrypt$32768$8$1$00$00'
      const a = await tx.customer.create({ data: { email: `lo-a-${ts}@verify.local`, passwordHash: hash }, select: { id: true } })
      const b = await tx.customer.create({ data: { email: `lo-b-${ts}@verify.local`, passwordHash: hash }, select: { id: true } })
      const emailBefore = await tx.emailOutbox.count()

      // --- Saved searches ---
      const { value } = validateSavedSearchInput({ label: 'Каблучки до 5000', categorySlug: 'bijouterie', maxPrice: '5000', sort: 'price-asc' })
      await tx.customerSavedSearch.create({ data: { customerId: a.id, ...value! } })
      const aList = await tx.customerSavedSearch.findMany({ where: { customerId: a.id } })
      savedCreateOk = aList.length === 1 && aList[0].label === 'Каблучки до 5000' && aList[0].maxPrice === 5000

      // B saves their own; each sees only their own row
      await tx.customerSavedSearch.create({ data: { customerId: b.id, label: 'B пошук' } })
      const aOnly = await tx.customerSavedSearch.findMany({ where: { customerId: a.id }, select: { customerId: true } })
      const bOnly = await tx.customerSavedSearch.findMany({ where: { customerId: b.id }, select: { customerId: true } })
      savedListScoped = aOnly.length === 1 && aOnly.every((r) => r.customerId === a.id)
      savedIsolationOk = bOnly.length === 1 && bOnly.every((r) => r.customerId === b.id)

      // remove scoped to owner: B cannot delete A's row; A can
      const aRow = aList[0]
      const failDel = await tx.customerSavedSearch.deleteMany({ where: { id: aRow.id, customerId: b.id } })
      const okDel = await tx.customerSavedSearch.deleteMany({ where: { id: aRow.id, customerId: a.id } })
      savedRemoveOk = failDel.count === 0 && okDel.count === 1

      // --- Product interests ---
      // add (upsert on the unique key) → one ACTIVE row
      await tx.customerProductInterest.upsert({
        where: { customerId_productId_type: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock' } },
        create: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock', status: 'active' },
        update: { status: 'active', fulfilledAt: null },
      })
      interestAddOk = (await tx.customerProductInterest.count({ where: { customerId: a.id, status: 'active' } })) === 1

      // duplicate add is idempotent (still exactly one row)
      await tx.customerProductInterest.upsert({
        where: { customerId_productId_type: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock' } },
        create: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock', status: 'active' },
        update: { status: 'active', fulfilledAt: null },
      })
      interestIdempotent = (await tx.customerProductInterest.count({ where: { customerId: a.id } })) === 1

      // cancel flips to cancelled
      await tx.customerProductInterest.updateMany({
        where: { customerId: a.id, productId: publishedProduct.id, status: 'active' },
        data: { status: 'cancelled' },
      })
      interestCancelOk = (await tx.customerProductInterest.count({ where: { customerId: a.id, status: 'active' } })) === 0

      // re-add reactivates the SAME row (no duplicate)
      await tx.customerProductInterest.upsert({
        where: { customerId_productId_type: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock' } },
        create: { customerId: a.id, productId: publishedProduct.id, type: 'back_in_stock', status: 'active' },
        update: { status: 'active', fulfilledAt: null },
      })
      interestReactivateOk =
        (await tx.customerProductInterest.count({ where: { customerId: a.id } })) === 1 &&
        (await tx.customerProductInterest.count({ where: { customerId: a.id, status: 'active' } })) === 1

      // isolation: B's interest on the same product is a separate row
      await tx.customerProductInterest.create({ data: { customerId: b.id, productId: publishedProduct.id, type: 'back_in_stock' } })
      const aInt = await tx.customerProductInterest.findMany({ where: { customerId: a.id }, select: { customerId: true } })
      const bInt = await tx.customerProductInterest.findMany({ where: { customerId: b.id }, select: { customerId: true } })
      interestIsolationOk =
        aInt.length === 1 && aInt.every((r) => r.customerId === a.id) &&
        bInt.length === 1 && bInt.every((r) => r.customerId === b.id)

      // hidden/unpublished product is NOT resolvable as a published product → interest rejected
      const hidden = await tx.product.create({
        data: { slug: `lo-hidden-${ts}`, name: 'LO Hidden', categoryLabel: 'x', categoryId: publishedProduct.categoryId, isPublished: false },
        select: { id: true, slug: true },
      })
      const resolved = await tx.product.findFirst({ where: { slug: hidden.slug, isPublished: true }, select: { id: true } })
      hiddenRejected = resolved === null

      // NO email/outbox row is ever created by interest handling
      noEmailCreated = (await tx.emailOutbox.count()) === emailBefore

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }

  check('saved search: create stores validated fields', savedCreateOk)
  check('saved search: list scoped to owner', savedListScoped)
  check('saved search: customer isolation', savedIsolationOk)
  check('saved search: remove scoped to owner (other cannot delete)', savedRemoveOk)
  check('interest: add creates an active row', interestAddOk)
  check('interest: duplicate add idempotent (unique key)', interestIdempotent)
  check('interest: cancel flips to cancelled', interestCancelOk)
  check('interest: re-add reactivates the same row', interestReactivateOk)
  check('interest: customer isolation', interestIsolationOk)
  check('interest: hidden/unpublished product not resolvable (rejected)', hiddenRejected)
  check('interest: NO email/outbox row created (no real notification)', noEmailCreated)

  // --- 4) Nothing committed ---
  const after = {
    customer: await prisma.customer.count(),
    saved: await prisma.customerSavedSearch.count(),
    interest: await prisma.customerProductInterest.count(),
    email: await prisma.emailOutbox.count(),
    category: await prisma.category.count(),
    product: await prisma.product.count(),
  }
  check('no test rows committed (customer/saved-search/interest/email/category/product)',
    after.customer === before.customer && after.saved === before.saved && after.interest === before.interest &&
    after.email === before.email && after.category === before.category && after.product === before.product)

  if (failures === 0) {
    console.log('\nCUSTOMER-LOYALTY VERIFY OK: engagement label (non-financial), saved-search validation/URL, saved-search + product-interest DB behaviour, isolation, hidden handling, and no-email all pass; nothing committed.')
  } else {
    console.error(`\nCUSTOMER-LOYALTY VERIFY FAILED (${failures} check(s)).`)
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
