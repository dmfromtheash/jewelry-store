/**
 * AURELIA — Admin catalog reads (Этап 26F) — server-only
 *
 * Read helpers for the admin product-image manager. Returns each product with
 * its primary image slot (position 0) so the admin can upload / replace / delete
 * the main photo. Scoped deliberately small — this is image management, not full
 * product CRUD.
 */

import 'server-only'

import { prisma } from '../db/prisma'

export interface AdminProductImageRow {
  id: string
  slug: string
  name: string
  sku: string | null
  status: 'available' | 'coming_soon'
  /** Primary image URL, or null when the slot has no uploaded asset yet. */
  imageUrl: string | null
}

/** All products with their primary (position 0) image, ordered like the catalog. */
export async function getAdminProductsForImages(): Promise<AdminProductImageRow[]> {
  const rows = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      status: true,
      images: {
        where: { position: 0 },
        select: { url: true },
        take: 1,
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    sku: r.sku,
    status: r.status,
    imageUrl: r.images[0]?.url ?? null,
  }))
}
