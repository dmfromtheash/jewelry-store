/**
 * AURELIA — Admin product create/edit verification (Этап 26I)
 *
 * Exercises the create/edit invariants end-to-end against the real DB, then
 * cleans up after itself. It does NOT reset/seed/drop anything and never touches
 * existing catalog rows — it works only on a throwaway product whose slug carries
 * a unique `zzz-verify-crud-` prefix, and deletes it in `finally`.
 *
 * Checks:
 *   1. create works (scalar fields persist);
 *   2. a duplicate slug is rejected (Prisma P2002);
 *   3. update works (name/price/status/slug change);
 *   4. the category relation resolves;
 *   5. the storefront mapper reads the created/updated row cleanly;
 *   6. the product is reachable BY SLUG via the same query the runtime PDP uses
 *      (getProductBySlugFromDb) — i.e. an admin-created slug serves at runtime.
 *
 * No secrets printed, no real data mutated. Run with: npm run db:verify:catalog-crud
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { mapDbProductToProduct } from '../src/lib/catalog/map'

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

const PREFIX = 'zzz-verify-crud-'
const stamp = Date.now()
const slugA = `${PREFIX}${stamp}-a`
const slugB = `${PREFIX}${stamp}-b`

// Relations the storefront mapper needs.
const productInclude = {
  category: { select: { slug: true } },
  variants: { select: { name: true, value: true, sortOrder: true } },
  images: { select: { url: true, alt: true, isPrimary: true, position: true } },
}

async function main() {
  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) {
    throw new Error('No category found — seed the catalog before running this check.')
  }

  console.log('Create:')
  const created = await prisma.product.create({
    data: {
      slug: slugA,
      name: 'CRUD verify товар',
      categoryId: category.id,
      categoryLabel: category.name,
      status: 'available',
      price: 249000, // minor units (2490 ₽)
      sku: 'AU-CRUD-TEST',
      tagGold: false,
    },
    select: { id: true, slug: true, price: true, status: true },
  })
  check('product created', !!created.id)
  check('price stored in minor units', created.price === 249000)
  check('status persisted', created.status === 'available')

  console.log('Duplicate slug:')
  let duplicateRejected = false
  try {
    await prisma.product.create({
      data: {
        slug: slugA, // same slug → must violate the unique constraint
        name: 'CRUD verify duplicate',
        categoryId: category.id,
        categoryLabel: category.name,
        status: 'available',
        price: 100000,
      },
      select: { id: true },
    })
  } catch (err) {
    duplicateRejected =
      err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
  }
  check('duplicate slug rejected (P2002)', duplicateRejected)

  console.log('Update:')
  const updated = await prisma.product.update({
    where: { id: created.id },
    data: {
      slug: slugB,
      name: 'CRUD verify товар (обновлён)',
      status: 'coming_soon',
      price: null, // coming-soon may drop the price
    },
    select: { id: true, slug: true, status: true, price: true, name: true },
  })
  check('slug updated', updated.slug === slugB)
  check('status updated to coming_soon', updated.status === 'coming_soon')
  check('price cleared for coming_soon', updated.price === null)

  console.log('Category relation + mapper:')
  const row = await prisma.product.findUnique({
    where: { id: created.id },
    include: productInclude,
  })
  check('row loads with category', !!row && !!row.category?.slug)
  if (row) {
    const mapped = mapDbProductToProduct(row)
    check('mapper status → coming-soon', mapped.status === 'coming-soon')
    check('mapper price null (coming-soon)', mapped.price === null)
    check('mapper categorySlug resolved', mapped.categorySlug === row.category.slug)
    check('no image → placeholder fallback (imageUrl undefined)', mapped.imageUrl === undefined)
  }

  // Runtime PDP path: /product/[slug] resolves a product with the SAME query as
  // getProductBySlugFromDb (findUnique by slug + productInclude + mapper). This is
  // what makes an admin-created slug serve at runtime now that dynamicParams=true.
  console.log('Read by slug (runtime PDP path):')
  const bySlug = await prisma.product.findUnique({
    where: { slug: slugB },
    include: productInclude,
  })
  check('product found by slug', !!bySlug)
  if (bySlug) {
    const mappedBySlug = mapDbProductToProduct(bySlug)
    check('mapped slug matches', mappedBySlug.slug === slugB)
    check('mapped name present', mappedBySlug.name.length > 0)
  }

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: product create/edit invariants hold.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY the throwaway product(s) from this run. The unique
    // prefix guarantees we never touch real catalog rows. Cascades drop any
    // (none created) child images/variants.
    try {
      const removed = await prisma.product.deleteMany({
        where: { slug: { startsWith: PREFIX } },
      })
      console.log(`Cleanup: removed ${removed.count} test product(s).`)
    } catch (err) {
      console.error(
        'Cleanup WARNING:',
        err instanceof Error ? err.message : err,
      )
    } finally {
      await prisma.$disconnect()
    }
  })
