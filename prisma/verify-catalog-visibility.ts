/**
 * AURELIA — Admin product visibility verification (Этап 26L)
 *
 * Exercises the storefront-visibility invariant end-to-end against the real DB,
 * then cleans up after itself. It does NOT reset/seed/drop anything and never
 * touches existing catalog rows — it works only on a throwaway product whose slug
 * carries a unique `zzz-verify-visibility-` prefix, and deletes it in `finally`.
 *
 * The public storefront helpers in src/lib/catalog/server.ts are `server-only`
 * and cannot be imported under tsx, so this script reproduces their EXACT query
 * shape (a `where: { isPublished: true }` filter) to prove the contract:
 *
 *   1. a published product is visible by slug (public PDP path) and in the public
 *      catalog list;
 *   2. after hiding (isPublished = false) the public-by-slug query returns null
 *      → the public PDP would 404, and it drops out of the public list;
 *   3. the admin read (UNFILTERED, the same query getAdminProductsForImages uses)
 *      still sees the product in BOTH states;
 *   4. after restoring, it is visible again with its original status preserved;
 *   5. the catalog count returns to its starting value after cleanup.
 *
 * No secrets printed, no real data mutated. Run with: npm run db:verify:catalog-visibility
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

const PREFIX = 'zzz-verify-visibility-'
const slug = `${PREFIX}${Date.now()}`

// Mirrors src/lib/catalog/server.ts — the PUBLIC storefront filter.
const publishedOnly = { isPublished: true } as const

/** Public-by-slug, exactly like getProductBySlugFromDb (findFirst + published filter). */
function findPublicBySlug(target: string) {
  return prisma.product.findFirst({ where: { slug: target, ...publishedOnly } })
}

/** Public list membership, exactly like getAllProductsFromDb (published filter). */
async function isInPublicList(target: string): Promise<boolean> {
  const row = await prisma.product.findFirst({
    where: { slug: target, ...publishedOnly },
    select: { id: true },
  })
  return !!row
}

/** Admin read is UNFILTERED — like getAdminProductsForImages / getAdminProductForEdit. */
function findAsAdmin(target: string) {
  return prisma.product.findUnique({ where: { slug: target } })
}

// Captured before any mutation; checked again after cleanup (in finally).
let baselineCount: number | null = null

async function main() {
  baselineCount = await prisma.product.count()

  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) {
    throw new Error('No category found — seed the catalog before running this check.')
  }

  console.log('Create (published by default):')
  const created = await prisma.product.create({
    data: {
      slug,
      name: 'Visibility verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 199000, // minor units (1990 ₽)
      sku: 'AU-VIS-TEST',
    },
    select: { id: true, slug: true, status: true, isPublished: true },
  })
  check('product created', !!created.id)
  check('isPublished defaults to true', created.isPublished === true)

  console.log('Published → visible on the storefront:')
  check('public-by-slug resolves', (await findPublicBySlug(slug)) !== null)
  check('present in public list', await isInPublicList(slug))
  check('admin sees it', (await findAsAdmin(slug)) !== null)

  console.log('Hide (isPublished = false):')
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: false } })
  check('public-by-slug returns null (PDP would 404)', (await findPublicBySlug(slug)) === null)
  check('absent from public list', !(await isInPublicList(slug)))
  const adminHidden = await findAsAdmin(slug)
  check('admin still sees hidden product', adminHidden !== null)
  check('hidden product keeps its status', adminHidden?.status === 'available')

  console.log('Restore (isPublished = true):')
  await prisma.product.update({ where: { id: created.id }, data: { isPublished: true } })
  const restored = await findPublicBySlug(slug)
  check('public-by-slug resolves again', restored !== null)
  check('status preserved through hide/restore', restored?.status === 'available')
  check('present in public list again', await isInPublicList(slug))

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: storefront visibility invariants hold.')
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
      const removed = await prisma.product.deleteMany({
        where: { slug: { startsWith: PREFIX } },
      })
      console.log(`Cleanup: removed ${removed.count} test product(s).`)
      const endCount = await prisma.product.count()
      if (baselineCount !== null) {
        check('catalog count restored after cleanup', endCount === baselineCount)
        if (failures > 0) process.exitCode = 1
      }
      console.log(`Catalog count: ${endCount}`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
