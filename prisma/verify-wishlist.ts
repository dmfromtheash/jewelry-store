/**
 * AURELIA — Server-side wishlist verification (Этап 62A)
 *
 * Non-destructive checks for the persistent account wishlist (CustomerWishlistItem). All
 * DB behaviour runs inside an ALWAYS-ROLLED-BACK transaction (a sentinel error aborts it)
 * so NOTHING is ever committed; the row count is asserted unchanged afterwards. Mirrors the
 * established verify-reviews.ts pattern (the script exercises the queries directly rather
 * than importing the `server-only` repo, which cannot load under tsx).
 *
 * Covered:
 *   - slug guard (pure): latin slug accepted, empty / markup / overly-long rejected;
 *   - add creates a row; duplicate add is idempotent (upsert on the unique key → still 1);
 *   - customer isolation: each customer sees ONLY their own rows for the same product;
 *   - hidden/unpublished product is EXCLUDED from the published-only storefront read;
 *   - remove deletes the row (and a remove of an absent row is a safe no-op);
 *   - nothing is committed.
 *
 * Run with: npm run db:verify:wishlist
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_WISHLIST_ROLLBACK__'

// Same slug guard the repo applies (kept in sync intentionally — the repo's copy carries
// `import 'server-only'` and cannot be imported here under tsx).
const SLUG_RE = /^[a-z0-9-]{1,128}$/i

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const countBefore = await prisma.customerWishlistItem.count()
  console.log('Wishlist:')
  console.log(`  wishlist rows in DB: ${countBefore}`)

  // --- 1) Slug guard (pure) ---
  check('valid latin slug accepted', SLUG_RE.test('serogi-kaplya'))
  check('empty slug rejected', !SLUG_RE.test(''))
  check('slug with markup rejected', !SLUG_RE.test('<script>'))
  check('slug with spaces rejected', !SLUG_RE.test('two words'))
  check('overly long slug rejected', !SLUG_RE.test('a'.repeat(129)))

  // Need a published product + a category to attach test rows to (read-only).
  const publishedProduct = await prisma.product.findFirst({
    where: { isPublished: true },
    select: { id: true, slug: true, categoryId: true },
  })
  if (!publishedProduct) {
    console.error('\nNo published product in DB — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  // --- 2) DB behaviour (rolled back) ---
  let addCreatesRow = false
  let duplicateIdempotent = false
  let isolationOk = false
  let hiddenExcluded = false
  let removeDeletes = false
  let removeAbsentNoop = false
  try {
    await prisma.$transaction(async (tx) => {
      const hash = 'scrypt$32768$8$1$00$00'
      const a = await tx.customer.create({ data: { email: `wl-a-${Date.now()}@verify.local`, passwordHash: hash }, select: { id: true } })
      const b = await tx.customer.create({ data: { email: `wl-b-${Date.now()}@verify.local`, passwordHash: hash }, select: { id: true } })

      // add creates a row
      await tx.customerWishlistItem.upsert({
        where: { customerId_productId: { customerId: a.id, productId: publishedProduct.id } },
        create: { customerId: a.id, productId: publishedProduct.id },
        update: {},
      })
      addCreatesRow = (await tx.customerWishlistItem.count({ where: { customerId: a.id } })) === 1

      // duplicate add is idempotent (still exactly one row)
      await tx.customerWishlistItem.upsert({
        where: { customerId_productId: { customerId: a.id, productId: publishedProduct.id } },
        create: { customerId: a.id, productId: publishedProduct.id },
        update: {},
      })
      duplicateIdempotent = (await tx.customerWishlistItem.count({ where: { customerId: a.id } })) === 1

      // isolation: B adds the SAME product; each sees only their own row
      await tx.customerWishlistItem.create({ data: { customerId: b.id, productId: publishedProduct.id } })
      const aRows = await tx.customerWishlistItem.findMany({ where: { customerId: a.id }, select: { customerId: true } })
      const bRows = await tx.customerWishlistItem.findMany({ where: { customerId: b.id }, select: { customerId: true } })
      isolationOk =
        aRows.length === 1 && aRows.every((r) => r.customerId === a.id) &&
        bRows.length === 1 && bRows.every((r) => r.customerId === b.id)

      // hidden product is excluded from the published-only storefront read
      const hidden = await tx.product.create({
        data: {
          slug: `wl-hidden-${Date.now()}`,
          name: 'Hidden verify product',
          categoryLabel: 'Verify',
          categoryId: publishedProduct.categoryId,
          isPublished: false,
          price: 1000,
        },
        select: { id: true },
      })
      await tx.customerWishlistItem.create({ data: { customerId: a.id, productId: hidden.id } })
      const visible = await tx.customerWishlistItem.findMany({
        where: { customerId: a.id, product: { isPublished: true } },
        select: { productId: true },
      })
      hiddenExcluded =
        visible.length === 1 && visible.every((r) => r.productId !== hidden.id)

      // remove deletes the row
      await tx.customerWishlistItem.deleteMany({ where: { customerId: a.id, productId: publishedProduct.id } })
      removeDeletes = (await tx.customerWishlistItem.count({ where: { customerId: a.id, productId: publishedProduct.id } })) === 0

      // removing an absent row is a safe no-op (deleteMany returns count 0, never throws)
      const del = await tx.customerWishlistItem.deleteMany({ where: { customerId: a.id, productId: publishedProduct.id } })
      removeAbsentNoop = del.count === 0

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }

  check('add creates a wishlist row', addCreatesRow)
  check('duplicate add is idempotent (unique key)', duplicateIdempotent)
  check('customer isolation: each sees only their own rows', isolationOk)
  check('hidden product excluded from published-only read', hiddenExcluded)
  check('remove deletes the row', removeDeletes)
  check('remove of absent row is a safe no-op', removeAbsentNoop)

  // --- 3) Nothing committed ---
  const countAfter = await prisma.customerWishlistItem.count()
  check('no test wishlist rows committed', countAfter === countBefore)

  if (failures === 0) {
    console.log('\nWISHLIST VERIFY OK: slug guard, add/idempotent/remove, isolation + hidden handling all pass; nothing committed.')
  } else {
    console.error(`\nWISHLIST VERIFY FAILED (${failures} check(s)).`)
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
