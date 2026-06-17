/**
 * AURELIA — Product gallery management verification (Этап 29A)
 *
 * Proves multi-image gallery management is wired safely end-to-end:
 *   - a product can hold a primary image (position 0) PLUS secondary gallery
 *     images (position > 0);
 *   - the storefront read (mirrors server.ts: published-only + images ordered by
 *     position, then mapped) returns gallery images in a STABLE order
 *     (primary first, then ascending position);
 *   - adding a gallery image lands at the next free position (primary stays 0);
 *   - the delete guard refuses the primary slot (isPrimary / position 0) and
 *     allows secondaries — so deleting a secondary never removes the primary;
 *   - clearing the primary slot keeps a single position-0 row (26F behavior);
 *   - a product with no real image falls back to the placeholder (images
 *     undefined) — the approved empty state is intact;
 *   - hidden/unpublished products stay out of the storefront read.
 *
 * The real admin actions are server-only (can't be imported under tsx), so this
 * MIRRORS their exact DB operations + the pure mapper. Works only on throwaway
 * `zzz-verify-gallery-` products (their images cascade-delete), removed in
 * `finally`. No reset/seed/drop. No secrets printed.
 * Run: npm run db:verify:catalog-gallery
 */

import { PrismaClient } from '@prisma/client'
import { mapDbProductToProduct, type DbProductForMapping } from '../src/lib/catalog/map'

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

const PRODUCT_PREFIX = 'zzz-verify-gallery-'

let seq = 0
function uniqueSlug(): string {
  return `${PRODUCT_PREFIX}${Date.now()}-${seq++}`
}

let categoryId = ''
let categoryName = ''

/** Same relation shape + published filter the storefront read (server.ts) uses. */
const productInclude = {
  category: { select: { slug: true } },
  variants: {
    select: { name: true, value: true, sortOrder: true },
    orderBy: { sortOrder: 'asc' as const },
  },
  images: {
    select: { url: true, alt: true, isPrimary: true, position: true },
    orderBy: { position: 'asc' as const },
  },
}

/** Mirrors getProductBySlugFromDb: published-only findFirst + map. */
async function readStorefrontProduct(slug: string) {
  const row = await prisma.product.findFirst({
    where: { slug, isPublished: true },
    include: productInclude,
  })
  return row ? mapDbProductToProduct(row as unknown as DbProductForMapping) : null
}

async function createProduct(isPublished = true): Promise<{ id: string; slug: string }> {
  const slug = uniqueSlug()
  const p = await prisma.product.create({
    data: {
      slug,
      name: 'Gallery verify товар',
      categoryId,
      categoryLabel: categoryName,
      status: 'available',
      price: 199000,
      sku: 'AU-GALLERY-TEST',
      isPublished,
    },
    select: { id: true, slug: true },
  })
  return p
}

/** Mirrors uploadProductImageAction (26F): create/refresh the position-0 primary slot. */
async function setPrimaryImage(productId: string, url: string | null) {
  await prisma.productImage.create({
    data: { productId, position: 0, url, alt: 'primary', isPrimary: true },
  })
}

/** Mirrors addGalleryImageAction (29A): insert at max(position)+1, isPrimary=false. */
async function addGalleryImage(productId: string, url: string): Promise<number> {
  const top = await prisma.productImage.findFirst({
    where: { productId },
    orderBy: { position: 'desc' },
    select: { position: true },
  })
  const nextPosition = (top?.position ?? -1) + 1
  await prisma.productImage.create({
    data: { productId, position: nextPosition, url, alt: 'gallery', isPrimary: false },
  })
  return nextPosition
}

/** Mirrors deleteGalleryImageAction's guard: secondary-only is deletable. */
function canDeleteGalleryImage(img: { isPrimary: boolean; position: number }): boolean {
  return !img.isPrimary && img.position !== 0
}

async function main() {
  const category = await prisma.category.findFirst({
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true },
  })
  if (!category) throw new Error('No category found — seed the catalog first.')
  categoryId = category.id
  categoryName = category.name

  // ── Primary + secondary images, stable storefront order ──
  console.log('Primary + secondary gallery images map in stable order:')
  const a = await createProduct()
  await setPrimaryImage(a.id, '/uploads/products/a.jpg')
  const pos1 = await addGalleryImage(a.id, '/uploads/products/b.webp')
  const pos2 = await addGalleryImage(a.id, '/uploads/products/c.png')
  check('gallery image 1 lands at position 1', pos1 === 1)
  check('gallery image 2 lands at position 2 (primary stays 0)', pos2 === 2)

  let read = await readStorefrontProduct(a.slug)
  check('storefront read returns the product', !!read)
  check('three real images surfaced', (read?.images?.length ?? 0) === 3)
  check('primary becomes imageUrl', read?.imageUrl === '/uploads/products/a.jpg')
  check('stable order: primary, then by position',
    read?.images?.[0].url === '/uploads/products/a.jpg' &&
    read?.images?.[1].url === '/uploads/products/b.webp' &&
    read?.images?.[2].url === '/uploads/products/c.png')

  // ── Delete a secondary: primary survives ──
  console.log('Deleting a secondary image keeps the primary:')
  const imgs = await prisma.productImage.findMany({
    where: { productId: a.id },
    select: { id: true, position: true, isPrimary: true, url: true },
    orderBy: { position: 'asc' },
  })
  const primaryRow = imgs.find((i) => i.position === 0)!
  const secondaryRow = imgs.find((i) => i.position === 1)!
  check('guard ALLOWS deleting a secondary', canDeleteGalleryImage(secondaryRow))
  check('guard REFUSES deleting the primary', !canDeleteGalleryImage(primaryRow))

  await prisma.productImage.delete({ where: { id: secondaryRow.id } })
  read = await readStorefrontProduct(a.slug)
  check('two images remain after secondary delete', (read?.images?.length ?? 0) === 2)
  check('primary still present after secondary delete', read?.imageUrl === '/uploads/products/a.jpg')
  const stillHasPrimary = await prisma.productImage.findUnique({ where: { id: primaryRow.id } })
  check('primary row untouched by secondary delete', !!stillHasPrimary && stillHasPrimary.isPrimary)

  // ── 26F primary clear keeps a single position-0 row ──
  console.log('Clearing the primary slot keeps one position-0 row (26F intact):')
  await prisma.productImage.update({ where: { id: primaryRow.id }, data: { url: null } })
  const primarySlots = await prisma.productImage.findMany({
    where: { productId: a.id, position: 0 },
    select: { id: true, isPrimary: true },
  })
  check('exactly one primary slot row remains', primarySlots.length === 1)
  check('primary slot still flagged isPrimary', primarySlots[0]?.isPrimary === true)

  // ── No-image placeholder fallback intact ──
  console.log('No-image product falls back to placeholder:')
  const empty = await createProduct()
  await setPrimaryImage(empty.id, null) // primary slot exists but empty
  const emptyRead = await readStorefrontProduct(empty.slug)
  check('no real image → imageUrl undefined (placeholder)', emptyRead?.imageUrl === undefined)
  check('no real image → images undefined (placeholder)', emptyRead?.images === undefined)

  // ── Hidden product stays out of the storefront read ──
  console.log('Hidden product with gallery stays out of storefront:')
  const hidden = await createProduct(false)
  await setPrimaryImage(hidden.id, '/uploads/products/h.jpg')
  await addGalleryImage(hidden.id, '/uploads/products/h2.jpg')
  const hiddenRead = await readStorefrontProduct(hidden.slug)
  check('hidden product not returned by storefront read', hiddenRead === null)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: multi-image gallery adds/orders/deletes safely; primary + placeholder + visibility intact.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    // Cleanup: remove ONLY this run's throwaway products (images cascade). No reset/seed/drop.
    try {
      const products = await prisma.product.deleteMany({ where: { slug: { startsWith: PRODUCT_PREFIX } } })
      console.log(`Cleanup: removed ${products.count} test product(s) (images cascaded).`)
    } catch (err) {
      console.error('Cleanup WARNING:', err instanceof Error ? err.message : err)
    } finally {
      await prisma.$disconnect()
    }
  })
