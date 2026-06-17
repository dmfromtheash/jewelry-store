/**
 * AURELIA — Prisma seed (Этап 15A)
 *
 * Imports the current mock catalog (src/data/products.ts) into the DB:
 *   Category ← derived from categorySlug + hardcoded labels
 *   Product  ← one row per mock product (price converted to minor units)
 *   ProductVariant ← one row per coating (Позолота / Родирование / Сталь)
 *   ProductImage   ← one placeholder slot (position 0, url=null) per product
 *
 * Idempotent: every write is an upsert keyed by a unique field
 *   (Category.slug, Product.slug, [productId,name,value], [productId,position]),
 *   so re-running does NOT create duplicates.
 *
 * Requires a reachable PostgreSQL via DATABASE_URL. Run with:
 *   npm run db:seed
 */

import { Prisma, PrismaClient, ProductStatus } from '@prisma/client'
import { products } from '../src/data/products'
import type { CategorySlug } from '../src/lib/catalog/types'

const prisma = new PrismaClient()

/** Top-level category display names (today only these two exist). */
const CATEGORY_NAMES: Record<CategorySlug, string> = {
  bijouterie: 'Бижутерия',
  gifts: 'Подарки',
}

const CATEGORY_SORT_ORDER: Record<CategorySlug, number> = {
  bijouterie: 0,
  gifts: 1,
}

/** Mock prices are whole UAH; the DB stores integer minor units. */
function toMinorUnits(price: number | null | undefined): number | null {
  if (price === null || price === undefined) return null
  return Math.round(price * 100)
}

function toStatus(status: string): ProductStatus {
  return status === 'coming-soon'
    ? ProductStatus.coming_soon
    : ProductStatus.available
}

async function main() {
  console.log('▶ Seeding AURELIA catalog from mock data…')

  // 1) Categories — derive the distinct set used by the mock products.
  const usedCategorySlugs = Array.from(
    new Set(products.map((p) => p.categorySlug)),
  ) as CategorySlug[]

  const categoryIdBySlug = new Map<string, string>()

  for (const slug of usedCategorySlugs) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: {
        name: CATEGORY_NAMES[slug],
        sortOrder: CATEGORY_SORT_ORDER[slug],
      },
      create: {
        slug,
        name: CATEGORY_NAMES[slug],
        sortOrder: CATEGORY_SORT_ORDER[slug],
      },
    })
    categoryIdBySlug.set(slug, category.id)
  }
  console.log(`  ✓ ${categoryIdBySlug.size} categories`)

  // 2) Products (+ variants, + placeholder image).
  let variantCount = 0
  for (const p of products) {
    const categoryId = categoryIdBySlug.get(p.categorySlug)
    if (!categoryId) {
      throw new Error(`No category for slug "${p.categorySlug}" (product ${p.slug})`)
    }

    const data = {
      name: p.name,
      categoryLabel: p.category,
      status: toStatus(p.status),
      price: toMinorUnits(p.price),
      sku: p.sku ?? null,
      brand: p.brand ?? null,
      description: p.description ?? null,
      tag: p.tag ?? null,
      tagGold: p.tagGold ?? false,
      rating: p.rating ?? 0,
      reviewsCount: p.reviewsCount ?? 0,
      // Cast: ProductSpec[] (an interface) lacks the index signature Prisma's
      // Json input type wants; the value is plain serializable data.
      specs: (p.specs ?? undefined) as Prisma.InputJsonValue | undefined,
      category: { connect: { id: categoryId } },
    }

    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: data,
      create: { slug: p.slug, ...data },
    })

    // Variants from the flat `coatings` list (no pricing yet).
    const coatings = p.coatings ?? []
    for (let i = 0; i < coatings.length; i++) {
      await prisma.productVariant.upsert({
        where: {
          productId_name_value: {
            productId: product.id,
            name: 'coating',
            value: coatings[i],
          },
        },
        update: { sortOrder: i, isDefault: i === 0 },
        create: {
          productId: product.id,
          name: 'coating',
          value: coatings[i],
          sortOrder: i,
          isDefault: i === 0,
        },
      })
      variantCount++
    }

    // One placeholder image slot (no real asset yet).
    await prisma.productImage.upsert({
      where: { productId_position: { productId: product.id, position: 0 } },
      update: { isPrimary: true },
      create: {
        productId: product.id,
        position: 0,
        url: null,
        alt: p.name,
        isPrimary: true,
      },
    })
  }

  console.log(`  ✓ ${products.length} products, ${variantCount} variants, ${products.length} placeholder images`)
  console.log('✓ Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
