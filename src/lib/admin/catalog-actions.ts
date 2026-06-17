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
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import { parseProductForm } from './catalog-form'
import {
  ProductMediaError,
  deleteProductImageFile,
  saveProductImageFile,
  type SavedImage,
} from './media'

const CATALOG_PATH = '/admin/catalog'

/** True for a Prisma unique-constraint violation (P2002) — here, a duplicate slug. */
function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'
}

/** Revalidate every storefront surface that renders product imagery. */
function revalidateStorefront(productSlug: string) {
  revalidatePath('/')
  revalidatePath('/category/bijouterie')
  revalidatePath('/category/gifts')
  // /search renders the catalog snapshot hydrated from the root layout, so it
  // needs its own revalidation to pick up a newly created/renamed product.
  revalidatePath('/search')
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

const NEW_PATH = `${CATALOG_PATH}/new`
const editPath = (id: string) => `${CATALOG_PATH}/${id}/edit`

/**
 * Resolves the card caption (`categoryLabel`, NOT-null in the schema). The admin
 * may type a specific caption ("Серьги · позолота"); when left blank we fall back
 * to the selected category's display name so a value always exists.
 */
async function resolveCategoryLabel(
  categoryId: string,
  typedLabel: string,
): Promise<string | null> {
  if (typedLabel) return typedLabel
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true },
  })
  return category?.name ?? null
}

/** Create a new catalog product from the admin form. */
export async function createProductAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const parsed = parseProductForm(formData)
  if (!parsed.ok) redirect(`${NEW_PATH}?err=${parsed.error}`)
  const input = parsed.data

  // categoryId must reference a real category (also yields the label fallback).
  const categoryLabel = await resolveCategoryLabel(input.categoryId, input.categoryLabel)
  if (categoryLabel === null) redirect(`${NEW_PATH}?err=category`)

  let created
  try {
    created = await prisma.product.create({
      data: {
        slug: input.slug,
        name: input.name,
        categoryId: input.categoryId,
        categoryLabel,
        status: input.status,
        price: input.price,
        sku: input.sku,
        brand: input.brand,
        description: input.description,
        tag: input.tag,
        tagGold: input.tagGold,
      },
      select: { id: true, slug: true },
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(`${NEW_PATH}?err=duplicate`)
    throw err
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productCreated,
    entityType: 'product',
    entityId: created.slug,
    summary: `Создан товар ${created.slug}.`,
  })

  revalidateStorefront(created.slug)
  redirect(`${CATALOG_PATH}?ok=created`)
}

/** Update the editable scalar fields of an existing product. */
export async function updateProductAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(`${CATALOG_PATH}?err=missing`)

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { id: true, slug: true },
  })
  if (!existing) redirect(`${CATALOG_PATH}?err=notfound`)

  const parsed = parseProductForm(formData)
  if (!parsed.ok) redirect(`${editPath(id)}?err=${parsed.error}`)
  const input = parsed.data

  const categoryLabel = await resolveCategoryLabel(input.categoryId, input.categoryLabel)
  if (categoryLabel === null) redirect(`${editPath(id)}?err=category`)

  try {
    await prisma.product.update({
      where: { id },
      data: {
        slug: input.slug,
        name: input.name,
        categoryId: input.categoryId,
        categoryLabel,
        status: input.status,
        price: input.price,
        sku: input.sku,
        brand: input.brand,
        description: input.description,
        tag: input.tag,
        tagGold: input.tagGold,
      },
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(`${editPath(id)}?err=duplicate`)
    throw err
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productUpdated,
    entityType: 'product',
    entityId: input.slug,
    summary:
      input.slug === existing.slug
        ? `Обновлён товар ${input.slug}.`
        : `Обновлён товар ${existing.slug} → ${input.slug}.`,
  })

  // Revalidate the new slug, plus the old PDP path when the slug changed.
  revalidateStorefront(input.slug)
  if (input.slug !== existing.slug) revalidatePath(`/product/${existing.slug}`)
  redirect(`${CATALOG_PATH}?ok=updated`)
}

/**
 * Toggle a product's storefront visibility (Этап 26L). Soft & reversible: only
 * the `isPublished` flag changes — the row, its variants/images, and all order
 * history stay intact (this is NOT a delete). Hiding removes the product from
 * every public surface; showing returns it with its exact prior status.
 *
 * The desired state is explicit in the form (`publish` = "on" → show, else hide)
 * so a double submit is idempotent rather than flip-flopping.
 */
export async function setProductPublishedAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) redirect(`${CATALOG_PATH}?err=missing`)

  const publish = String(formData.get('publish') ?? '') === 'on'

  const existing = await prisma.product.findUnique({
    where: { id },
    select: { slug: true, isPublished: true },
  })
  if (!existing) redirect(`${CATALOG_PATH}?err=notfound`)

  // Already in the desired state → idempotent no-op (no audit noise).
  if (existing.isPublished === publish) {
    revalidatePath(CATALOG_PATH)
    redirect(`${CATALOG_PATH}?ok=noop`)
  }

  await prisma.product.update({
    where: { id },
    data: { isPublished: publish },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: publish ? AUDIT_ACTIONS.productPublished : AUDIT_ACTIONS.productHidden,
    entityType: 'product',
    entityId: existing.slug,
    summary: publish
      ? `Товар ${existing.slug} возвращён на витрину.`
      : `Товар ${existing.slug} скрыт с витрины.`,
  })

  revalidateStorefront(existing.slug)
  redirect(`${CATALOG_PATH}?ok=${publish ? 'published' : 'hidden'}`)
}
