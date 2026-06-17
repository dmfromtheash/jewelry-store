/**
 * AURELIA — Catalog image pipeline verification (Этап 26F)
 *
 * Read-only checks that the product-image feature is wired safely:
 *   1. the DB→frontend mapper carries real ProductImage URLs into Product and
 *      hides null slots (placeholder fallback stays intact);
 *   2. the upload path helpers refuse traversal / external / unsafe names and
 *      only resolve files strictly inside public/uploads/products;
 *   3. the live catalog query maps cleanly (no mutation — findMany only).
 *
 * No secrets printed, no data mutated. Run with: npm run db:verify:catalog-images
 */

import path from 'path'
import { PrismaClient } from '@prisma/client'
import { mapDbProductToProduct, type DbProductForMapping } from '../src/lib/catalog/map'
import {
  isManagedUploadUrl,
  isSafeStoredFilename,
  resolveManagedUploadAbsPath,
  uploadDirAbs,
} from '../src/lib/admin/media-path'

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

function baseRow(): DbProductForMapping {
  return {
    slug: 'test-slug',
    name: 'Test',
    categoryLabel: 'Тест',
    status: 'available',
    price: 1000,
    sku: 'AU-TEST',
    brand: 'AURELIA',
    description: null,
    tag: null,
    tagGold: false,
    rating: 0,
    reviewsCount: 0,
    specs: null,
    category: { slug: 'bijouterie' },
    variants: [],
  }
}

async function main() {
  console.log('Mapping:')
  const mapped = mapDbProductToProduct({
    ...baseRow(),
    images: [
      { url: null, alt: 'empty', isPrimary: false, position: 2 },
      { url: '/uploads/products/b.webp', alt: 'second', isPrimary: false, position: 1 },
      { url: '/uploads/products/a.jpg', alt: 'primary', isPrimary: true, position: 0 },
    ],
  })
  check('primary image becomes imageUrl', mapped.imageUrl === '/uploads/products/a.jpg')
  check('null slots are filtered out', (mapped.images?.length ?? 0) === 2)
  check('images ordered primary-first', mapped.images?.[0].url === '/uploads/products/a.jpg')

  const empty = mapDbProductToProduct({
    ...baseRow(),
    images: [{ url: null, alt: null, isPrimary: true, position: 0 }],
  })
  check('no real image → imageUrl undefined (placeholder fallback)', empty.imageUrl === undefined)
  check('no real image → images undefined', empty.images === undefined)

  const noKey = mapDbProductToProduct(baseRow())
  check('missing images relation is safe', noKey.imageUrl === undefined)

  console.log('Upload path safety:')
  check('valid managed url accepted', isManagedUploadUrl('/uploads/products/abc-123.webp'))
  check('traversal url rejected', !isManagedUploadUrl('/uploads/products/../../etc/passwd'))
  check('external url rejected', !isManagedUploadUrl('https://evil.example/x.png'))
  check('nested path rejected', !isManagedUploadUrl('/uploads/products/sub/x.png'))
  check('disallowed extension rejected', !isSafeStoredFilename('payload.exe'))
  check('slash in name rejected', !isSafeStoredFilename('a/b.png'))
  check('dotdot name rejected', !isSafeStoredFilename('..png'))

  const safeAbs = resolveManagedUploadAbsPath('/uploads/products/ok.png')
  check(
    'safe url resolves inside upload dir',
    safeAbs === path.join(uploadDirAbs(), 'ok.png'),
  )
  check('traversal url resolves to null', resolveManagedUploadAbsPath('/uploads/products/../x') === null)
  check('external url resolves to null', resolveManagedUploadAbsPath('/etc/passwd') === null)

  console.log('Live catalog query:')
  const rows = await prisma.product.findMany({
    include: {
      category: { select: { slug: true } },
      variants: { select: { name: true, value: true, sortOrder: true } },
      images: {
        select: { url: true, alt: true, isPrimary: true, position: true },
        orderBy: { position: 'asc' },
      },
    },
    orderBy: { sku: 'asc' },
  })
  const products = rows.map(mapDbProductToProduct)
  const withImage = products.filter((p) => !!p.imageUrl).length
  check('catalog maps without throwing', products.length > 0)
  console.log(`  · products: ${products.length}, with real image: ${withImage}`)

  if (failures > 0) {
    console.error(`\nVERIFY FAILED: ${failures} check(s) failed.`)
    process.exitCode = 1
  } else {
    console.log('\nVERIFY OK: catalog image pipeline + upload path guards are sound.')
  }
}

main()
  .catch((err) => {
    console.error('VERIFY ERROR:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
