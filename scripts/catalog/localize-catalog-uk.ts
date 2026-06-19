/**
 * AURELIA — One-off guarded catalog localization (Этап 39C)
 *
 * Updates the EXISTING local PostgreSQL demo catalog to Ukrainian IN PLACE, using
 * the already-translated seed source (src/data/products.ts) as the single source
 * of truth for display fields. This is deliberately NOT `db:seed`: the variant
 * upsert key includes `value`, so a fresh seed would DUPLICATE renamed coating
 * variants. Here we rename variant values in place instead.
 *
 * What it changes (display-only):
 *   - Category.name        (bijouterie → Біжутерія, gifts → Подарунки)
 *   - Product.name / categoryLabel / description / specs / tag   (by slug)
 *   - ProductVariant.value  coating «Родирование» → «Родіювання» (in place)
 *     (Позолота / Сталь are identical in RU/UA — no rename needed.)
 *
 * What it NEVER touches: slug, sku, price, stockQuantity, variant ids,
 * priceDelta, isDefault, sortOrder, ProductVariant.name ("coating"), images,
 * and any OrderItem snapshot (frozen at order time). No deletes. No creates
 * (variant rename is an updateMany on existing rows). No reset/seed/drop.
 *
 * Idempotent: re-running updates to the same target values and renames 0 rows the
 * second time. All writes run in a single transaction. Safe summary only.
 *
 * Run: npx tsx scripts/catalog/localize-catalog-uk.ts
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { products } from '../../src/data/products'
import type { CategorySlug } from '../../src/lib/catalog/types'

const prisma = new PrismaClient()

const CATEGORY_NAMES: Record<CategorySlug, string> = {
  bijouterie: 'Біжутерія',
  gifts: 'Подарунки',
}

// Only coating value that actually differs RU→UA. Strict match on name+value.
const COATING_RENAMES: { from: string; to: string }[] = [
  { from: 'Родирование', to: 'Родіювання' },
]

async function main() {
  console.log('▶ Localizing demo catalog to uk-UA (in place, no seed)…')

  // ── Pre-flight: every seed slug must already exist (abort otherwise) ──
  const dbProducts = await prisma.product.findMany({ select: { slug: true } })
  const dbSlugs = new Set(dbProducts.map((p) => p.slug))
  const missing = products.filter((p) => !dbSlugs.has(p.slug)).map((p) => p.slug)
  if (missing.length > 0) {
    console.error('ABORT: expected product slugs not found in DB:', missing.join(', '))
    process.exitCode = 1
    return
  }

  // Integrity baselines to compare after the write.
  const variantCountBefore = await prisma.productVariant.count()
  const coatingCountBefore = await prisma.productVariant.count({ where: { name: 'coating' } })

  // ── Build the atomic update set ──
  const ops: Prisma.PrismaPromise<unknown>[] = []

  // Categories (by slug).
  for (const slug of Object.keys(CATEGORY_NAMES) as CategorySlug[]) {
    ops.push(
      prisma.category.updateMany({ where: { slug }, data: { name: CATEGORY_NAMES[slug] } }),
    )
  }

  // Products (display fields only, by slug).
  for (const p of products) {
    ops.push(
      prisma.product.update({
        where: { slug: p.slug },
        data: {
          name: p.name,
          categoryLabel: p.category,
          description: p.description ?? null,
          specs: (p.specs ?? undefined) as Prisma.InputJsonValue | undefined,
          tag: p.tag ?? null,
        },
      }),
    )
  }

  // Coating variant value rename in place (strict where: name + old value).
  for (const r of COATING_RENAMES) {
    ops.push(
      prisma.productVariant.updateMany({
        where: { name: 'coating', value: r.from },
        data: { value: r.to },
      }),
    )
  }

  const results = await prisma.$transaction(ops)

  // ── Post-write integrity checks ──
  const variantCountAfter = await prisma.productVariant.count()
  const coatingCountAfter = await prisma.productVariant.count({ where: { name: 'coating' } })
  const renamedCount = results
    .slice(-COATING_RENAMES.length)
    .reduce<number>((n, r) => n + ((r as Prisma.BatchPayload)?.count ?? 0), 0)

  // No duplicate coating variants per product (the unique [productId,name,value]
  // constraint guarantees it, but assert the totals stayed put).
  const noDup = variantCountAfter === variantCountBefore && coatingCountAfter === coatingCountBefore

  console.log('— summary —')
  console.log(`  categories renamed:   ${Object.keys(CATEGORY_NAMES).length}`)
  console.log(`  products updated:      ${products.length}`)
  console.log(`  slugs processed:      ${products.map((p) => p.slug).join(', ')}`)
  console.log(`  coating values renamed (Родирование→Родіювання): ${renamedCount}`)
  console.log(`  variant count: before=${variantCountBefore} after=${variantCountAfter}`)
  console.log(`  coating count: before=${coatingCountBefore} after=${coatingCountAfter}`)
  console.log(`  no duplicate variants created: ${noDup ? 'OK' : 'FAIL'}`)

  if (!noDup) {
    console.error('\nLOCALIZE FAILED: variant counts changed unexpectedly.')
    process.exitCode = 1
  } else {
    console.log('\nLOCALIZE OK: demo catalog localized in place; counts/ids preserved.')
  }
}

main()
  .catch((e) => {
    console.error('LOCALIZE ERROR:', e instanceof Error ? e.message : e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
