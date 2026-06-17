/**
 * AURELIA — Hidden-product cart/checkout safety verification (Этап 26M)
 *
 * Proves that a product hidden by the admin (isPublished = false, Этап 26L) can
 * never be ordered, and that the cart/favorites/recently-viewed resolve path
 * degrades safely when a stored slug is no longer purchasable.
 *
 * It works only on a throwaway product whose slug carries a unique
 * `zzz-verify-cart-hidden-` prefix and deletes it in `finally`. It does NOT
 * reset/seed/drop anything and never touches real catalog rows. No order is ever
 * committed — it only reproduces the server-side LOOKUP queries (the server
 * action `createOrderDraft` is `'use server'` and can't be imported under tsx),
 * mirroring their EXACT `where` shape:
 *
 *   1. Orderable lookup — `findMany({ where: { slug in [...], isPublished: true } })`
 *      — the gate added in createOrderDraft (step 3). A published product is
 *      returned; a hidden one is NOT → the action's "no longer available"
 *      rejection fires → it can never reach Order/OrderItem.
 *   2. Public catalog snapshot — `findFirst({ where: { slug, isPublished: true } })`
 *      — what feeds CatalogProvider.getBySlug on the client. A hidden slug
 *      resolves to null → the cart/favorites/recently-viewed treat it as
 *      `unavailable` instead of crashing.
 *
 * No secrets printed, no real data mutated. Run with: npm run db:verify:cart-hidden
 */

import { PrismaClient } from '@prisma/client'

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

const PREFIX = 'zzz-verify-cart-hidden-'
const slug = `${PREFIX}${Date.now()}`

/**
 * Mirrors createOrderDraft step 3: the AUTHORITATIVE orderability lookup. A slug
 * is purchasable ONLY if it comes back from this query. Returns the matched set.
 */
async function orderableLookup(slugs: string[]): Promise<Set<string>> {
  const rows = await prisma.product.findMany({
    where: { slug: { in: slugs }, isPublished: true },
    select: { slug: true },
  })
  return new Set(rows.map((r) => r.slug))
}

/** Mirrors getProductBySlugFromDb / the client snapshot: published-only by slug. */
function publicSnapshotBySlug(target: string) {
  return prisma.product.findFirst({ where: { slug: target, isPublished: true } })
}

let baselineOrderCount: number | null = null

async function main() {
  baselineOrderCount = await prisma.order.count()

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) {
    throw new Error('No category found — seed the catalog before running this check.')
  }

  console.log('Create (published, status=available → fully orderable):')
  const created = await prisma.product.create({
    data: {
      slug,
      name: 'Cart-hidden verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000, // minor units (1990 ₽)
      sku: 'AU-CART-HIDDEN-TEST',
    },
    select: { id: true, isPublished: true },
  })
  check('product created', !!created.id)
  check('isPublished defaults to true', created.isPublished === true)

  console.log('Published → purchasable:')
  check('orderable lookup INCLUDES published slug', (await orderableLookup([slug])).has(slug))
  check('public snapshot resolves published slug', (await publicSnapshotBySlug(slug)) !== null)

  console.log('Hide (isPublished = false) — note: status stays "available":')
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: false } })

  // The core guarantee: even though status is still 'available', the orderable
  // lookup must NOT return the slug — so checkout rejects it as "unavailable".
  const orderableAfterHide = await orderableLookup([slug])
  check('orderable lookup EXCLUDES hidden slug (checkout would reject)', !orderableAfterHide.has(slug))
  check(
    'hidden slug resolves to null in public snapshot (cart shows it unavailable, no crash)',
    (await publicSnapshotBySlug(slug)) === null,
  )

  // A non-existent slug (e.g. a deleted product still in localStorage) behaves
  // the same way — never purchasable, never crashes the resolve path.
  const missingSlug = `${PREFIX}does-not-exist`
  check('orderable lookup EXCLUDES a missing slug', !(await orderableLookup([missingSlug])).has(missingSlug))
  check('missing slug resolves to null in public snapshot', (await publicSnapshotBySlug(missingSlug)) === null)

  console.log('Restore (isPublished = true) → purchasable again:')
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: true } })
  check('orderable lookup INCLUDES restored slug', (await orderableLookup([slug])).has(slug))
  check('public snapshot resolves restored slug', (await publicSnapshotBySlug(slug)) !== null)

  const orderCountUnchanged = (await prisma.order.count()) === baselineOrderCount
  check('no orders were created by this check', orderCountUnchanged)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: hidden products are never orderable; cart resolve degrades safely.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY the throwaway product(s) from this run. The unique
    // prefix guarantees we never touch real catalog rows. No reset/seed/drop.
    try {
      const removed = await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } })
      console.log(`Cleanup: removed ${removed.count} test product(s).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
