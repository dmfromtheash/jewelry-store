'use server'

/**
 * AURELIA — Admin product image actions (Этап 26F)
 *
 * Upload / replace / delete the primary image of a catalog product. Every action
 * re-checks the local admin guard (cannot run in production) AND requires a valid
 * admin session (an unauthenticated POST is redirected to login, never mutating).
 *
 * Storage: files live under public/uploads/products via ./media; the DB stores
 * only the relative URL on the product's primary ProductImage slot (position 0).
 * "Delete" nulls the slot's url (keeping the row) and removes the file from disk,
 * so the catalog still has one image slot per product.
 *
 * Feedback is passed back via a redirect query param (?ok=/?err=) so the admin
 * page can show a short notice without any client JS.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import {
  ProductMediaError,
  deleteProductImageFile,
  saveProductImageFile,
  type SavedImage,
} from './media'

const CATALOG_PATH = '/admin/catalog'

/** Revalidate every storefront surface that renders product imagery. */
function revalidateStorefront(productSlug: string) {
  revalidatePath('/')
  revalidatePath('/category/bijouterie')
  revalidatePath('/category/gifts')
  revalidatePath(`/product/${productSlug}`)
  revalidatePath(CATALOG_PATH)
}

export async function uploadProductImageAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  if (!productId) redirect(`${CATALOG_PATH}?err=missing`)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      slug: true,
      name: true,
      images: { where: { position: 0 }, select: { id: true, url: true } },
    },
  })
  if (!product) redirect(`${CATALOG_PATH}?err=notfound`)

  let saved: SavedImage | null = null
  try {
    saved = await saveProductImageFile(formData.get('image'))
  } catch (err) {
    if (err instanceof ProductMediaError) redirect(`${CATALOG_PATH}?err=upload`)
    throw err
  }

  const existing = product.images[0]
  if (existing) {
    await prisma.productImage.update({
      where: { id: existing.id },
      data: { url: saved.url, alt: product.name, isPrimary: true },
    })
  } else {
    await prisma.productImage.create({
      data: { productId, position: 0, url: saved.url, alt: product.name, isPrimary: true },
    })
  }

  // Remove the replaced file only after the DB points at the new one.
  if (existing?.url && existing.url !== saved.url) {
    await deleteProductImageFile(existing.url)
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productImageUpdated,
    entityType: 'product',
    entityId: product.slug,
    summary: `Изображение товара ${product.slug} ${existing?.url ? 'заменено' : 'загружено'}.`,
  })

  revalidateStorefront(product.slug)
  redirect(`${CATALOG_PATH}?ok=uploaded`)
}

export async function deleteProductImageAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  if (!productId) redirect(`${CATALOG_PATH}?err=missing`)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      slug: true,
      images: { where: { position: 0 }, select: { id: true, url: true } },
    },
  })
  if (!product) redirect(`${CATALOG_PATH}?err=notfound`)

  const existing = product.images[0]
  // Nothing to remove → idempotent no-op.
  if (!existing?.url) {
    revalidatePath(CATALOG_PATH)
    redirect(`${CATALOG_PATH}?ok=noop`)
  }

  // Keep the slot row (catalog has one image slot per product); just clear it.
  await prisma.productImage.update({
    where: { id: existing.id },
    data: { url: null },
  })
  await deleteProductImageFile(existing.url)

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productImageRemoved,
    entityType: 'product',
    entityId: product.slug,
    summary: `Изображение товара ${product.slug} удалено.`,
  })

  revalidateStorefront(product.slug)
  redirect(`${CATALOG_PATH}?ok=removed`)
}
