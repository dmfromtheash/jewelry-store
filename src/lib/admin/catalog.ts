/**
 * AURELIA — Admin catalog reads (Этап 26F; create/edit added 26I) — server-only
 *
 * Read helpers for the admin product-image manager AND the product create/edit
 * forms. Image reads return each product with its primary image slot (position
 * 0); the create/edit helpers expose the editable scalar fields + the category
 * list for the <select>. Mutations live in ./catalog-actions.
 */

import 'server-only'

import { prisma } from '../db/prisma'

export interface AdminProductImageRow {
  id: string
  slug: string
  name: string
  sku: string | null
  status: 'available' | 'coming_soon'
  /** Storefront visibility (Этап 26L). Admin sees BOTH published and hidden rows. */
  isPublished: boolean
  /** Product-level stock (Этап 28B/28C). null = NOT tracked; 0 = out of stock; >0 = on hand. */
  stockQuantity: number | null
  /** Primary image URL, or null when the slot has no uploaded asset yet. */
  imageUrl: string | null
}

/**
 * All products with their primary (position 0) image, ordered like the catalog.
 * Admin-only: deliberately UNFILTERED by visibility so hidden products remain
 * manageable (and restorable) here.
 */
export async function getAdminProductsForImages(): Promise<AdminProductImageRow[]> {
  const rows = await prisma.product.findMany({
    orderBy: { sku: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      status: true,
      isPublished: true,
      stockQuantity: true,
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
    isPublished: r.isPublished,
    stockQuantity: r.stockQuantity,
    imageUrl: r.images[0]?.url ?? null,
  }))
}

/** A category option for the product form <select>, ordered like the storefront. */
export interface AdminCategoryOption {
  id: string
  name: string
}

/** All categories for the create/edit category <select>. */
export async function getAdminCategoriesForSelect(): Promise<AdminCategoryOption[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true },
  })
  return rows.map((r) => ({ id: r.id, name: r.name }))
}

/** Editable scalar fields of one product, for the edit form. Price stays in minor units. */
export interface AdminProductForEdit {
  id: string
  name: string
  slug: string
  categoryId: string
  categoryLabel: string
  status: 'available' | 'coming_soon'
  /** Integer MINOR units (kopecks); null for coming-soon without a price. */
  price: number | null
  /** Product-level stock (Этап 28B); null = not tracked. */
  stockQuantity: number | null
  sku: string | null
  brand: string | null
  description: string | null
  tag: string | null
  tagGold: boolean
}

/** One product image row for the admin gallery manager (Этап 29A). */
export interface AdminProductGalleryImage {
  id: string
  /** Ordered slot; 0 is the primary slot from 26F. */
  position: number
  /** Public URL, or null for an empty slot (primary slot may exist but be empty). */
  url: string | null
  alt: string | null
  /** True for the primary image — managed on the «Каталог · изображения» page. */
  isPrimary: boolean
}

/**
 * All image rows of a product, ordered by position (Этап 29A). The primary slot
 * (position 0 / isPrimary) is included so the gallery UI can show it read-only;
 * secondary rows (position > 0) are the gallery images the admin can add/remove.
 */
export async function getAdminProductGalleryImages(
  productId: string,
): Promise<AdminProductGalleryImage[]> {
  return prisma.productImage.findMany({
    where: { productId },
    orderBy: { position: 'asc' },
    select: { id: true, position: true, url: true, alt: true, isPrimary: true },
  })
}

/** Loads one product's editable scalar fields, or null when it does not exist. */
export async function getAdminProductForEdit(
  id: string,
): Promise<AdminProductForEdit | null> {
  const row = await prisma.product.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      categoryId: true,
      categoryLabel: true,
      status: true,
      price: true,
      stockQuantity: true,
      sku: true,
      brand: true,
      description: true,
      tag: true,
      tagGold: true,
    },
  })
  return row ?? null
}
