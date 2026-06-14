/**
 * AURELIA — Runtime catalog verification (Этап 15D)
 *
 * Verifies the DB-backed catalog AS THE STOREFRONT SEES IT: it reads products
 * via Prisma and runs them through the SAME pure mapper (src/lib/catalog/map)
 * the server layer uses, then asserts the mapped, UI-facing shape:
 *   - 10 products, 2 categories
 *   - key slugs present (serogi-kaplya, koltso-volna, kulon-gran)
 *   - price conversion: 249000 kopecks in DB → 2490 RUB in the UI layer
 *   - status mapping: coming_soon → 'coming-soon'
 *
 * Uses the mapper (not src/lib/catalog/server, which is `server-only`) so it can
 * run under tsx in plain Node. No secrets printed. Read-only.
 *
 * Run with: npm run db:verify:runtime
 */

import { PrismaClient } from '@prisma/client'
import { mapDbProductToProduct } from '../src/lib/catalog/map'

const prisma = new PrismaClient()

const productInclude = {
  category: { select: { slug: true } },
  variants: {
    select: { name: true, value: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
}

async function main() {
  const rows = await prisma.product.findMany({
    include: productInclude,
    orderBy: { sku: 'asc' },
  })
  const products = rows.map(mapDbProductToProduct)

  const categoryCount = await prisma.category.count()

  const problems: string[] = []
  const check = (ok: boolean, msg: string) => {
    if (!ok) problems.push(msg)
  }

  console.log('Runtime catalog (DB → UI mapping):')
  console.log(`  products:   ${products.length}`)
  console.log(`  categories: ${categoryCount}`)

  check(products.length === 10, `expected 10 products, got ${products.length}`)
  check(categoryCount === 2, `expected 2 categories, got ${categoryCount}`)

  const bySlug = new Map(products.map((p) => [p.slug, p]))

  // Price conversion: DB stores 249000 kopecks for serogi-kaplya → 2490 RUB.
  const serogi = bySlug.get('serogi-kaplya')
  check(!!serogi, 'missing slug serogi-kaplya')
  if (serogi) {
    check(serogi.price === 2490, `serogi-kaplya price expected 2490, got ${serogi.price}`)
    check(
      Array.isArray(serogi.specs) && serogi.specs.length > 0,
      'serogi-kaplya specs missing (parity with mock)',
    )
    check(
      Array.isArray(serogi.coatings) && serogi.coatings.length === 3,
      `serogi-kaplya coatings expected 3, got ${serogi.coatings?.length ?? 0}`,
    )
    console.log(
      `  ✓ serogi-kaplya price=${serogi.price} status=${serogi.status} ` +
        `coatings=${serogi.coatings?.length ?? 0} specs=${serogi.specs?.length ?? 0}`,
    )
  }

  const koltso = bySlug.get('koltso-volna')
  check(!!koltso, 'missing slug koltso-volna')
  if (koltso) {
    check(koltso.price === 1890, `koltso-volna price expected 1890, got ${koltso.price}`)
    console.log(`  ✓ koltso-volna price=${koltso.price} status=${koltso.status}`)
  }

  // Status mapping: coming_soon → 'coming-soon', price null.
  const kulon = bySlug.get('kulon-gran')
  check(!!kulon, 'missing slug kulon-gran')
  if (kulon) {
    check(kulon.status === 'coming-soon', `kulon-gran status expected coming-soon, got ${kulon.status}`)
    check(kulon.price === null, `kulon-gran price expected null, got ${kulon.price}`)
    console.log(`  ✓ kulon-gran status=${kulon.status} price=${kulon.price}`)
  }

  if (problems.length > 0) {
    console.error('\nRUNTIME VERIFY FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exitCode = 1
  } else {
    console.log('\nRUNTIME VERIFY OK: DB-backed catalog matches the storefront contract.')
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
