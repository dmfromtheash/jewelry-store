/**
 * AURELIA — Catalog DB verification (Этап 15B)
 *
 * Read-only check that the seed landed in PostgreSQL. Connects via Prisma,
 * prints row counts for each catalog model, asserts the expected shape
 * (2 categories, 10 products) and spot-checks several mock slugs.
 *
 * No secrets are printed. No data is mutated (counts + findUnique only).
 * Run with: npm run db:verify
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EXPECTED_CATEGORIES = 2
const EXPECTED_PRODUCTS = 10

// A spread of mock slugs: available w/ variants, gift, no-coating, coming-soon.
const SAMPLE_SLUGS = [
  'serogi-kaplya',
  'koltso-volna',
  'nabor-serogi-kulon',
  'sertifikat-podarochnyj',
  'kulon-gran',
]

async function main() {
  const [categories, products, variants, images] = await Promise.all([
    prisma.category.count(),
    prisma.product.count(),
    prisma.productVariant.count(),
    prisma.productImage.count(),
  ])

  console.log('Catalog counts:')
  console.log(`  categories: ${categories}`)
  console.log(`  products:   ${products}`)
  console.log(`  variants:   ${variants}`)
  console.log(`  images:     ${images}`)

  const problems: string[] = []
  if (categories !== EXPECTED_CATEGORIES) {
    problems.push(`expected ${EXPECTED_CATEGORIES} categories, got ${categories}`)
  }
  if (products !== EXPECTED_PRODUCTS) {
    problems.push(`expected ${EXPECTED_PRODUCTS} products, got ${products}`)
  }

  console.log('Sample slugs:')
  for (const slug of SAMPLE_SLUGS) {
    const p = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: true,
        _count: { select: { variants: true, images: true } },
      },
    })
    if (!p) {
      problems.push(`missing product slug: ${slug}`)
      console.log(`  ✗ ${slug} — NOT FOUND`)
      continue
    }
    console.log(
      `  ✓ ${slug} → "${p.name}" [${p.category.slug}] status=${p.status} ` +
        `price=${p.price ?? 'null'} variants=${p._count.variants} images=${p._count.images}`,
    )
  }

  if (problems.length > 0) {
    console.error('\nVERIFY FAILED:')
    for (const pr of problems) console.error(`  - ${pr}`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: catalog data present and matches expectations.')
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
