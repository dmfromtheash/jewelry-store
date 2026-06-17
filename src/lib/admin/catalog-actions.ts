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
import { Prisma, OrderStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import { parseProductForm, parseVariantForm } from './catalog-form'
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
        stockQuantity: input.stockQuantity,
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
        stockQuantity: input.stockQuantity,
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

/**
 * Add a SECONDARY gallery image to an existing product (Этап 29A). The primary
 * slot (position 0, managed by uploadProductImageAction in 26F) is never touched
 * here: the new row lands at the next free position (> 0) with isPrimary=false, so
 * the storefront gallery (already multi-image via map.ts/ProductGallery) shows it
 * as an extra thumbnail. Reuses the 26F upload validation + safe storage. The
 * `@@unique([productId, position])` constraint is honoured with a small retry that
 * recomputes the next slot, so a rare race can't wedge on a duplicate position.
 */
export async function addGalleryImageAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  if (!productId) redirect(`${CATALOG_PATH}?err=missing`)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, name: true },
  })
  if (!product) redirect(`${CATALOG_PATH}?err=notfound`)

  let saved: SavedImage | null = null
  try {
    saved = await saveProductImageFile(formData.get('image'))
  } catch (err) {
    if (err instanceof ProductMediaError) redirect(`${editPath(productId)}?gerr=upload`)
    throw err
  }

  // Insert at the next free position after the current max (primary stays at 0).
  // Retry on a unique-position collision (concurrent add) with a fresh max.
  for (let attempt = 0; attempt < 5; attempt++) {
    const top = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { position: 'desc' },
      select: { position: true },
    })
    const nextPosition = (top?.position ?? -1) + 1
    try {
      await prisma.productImage.create({
        data: {
          productId,
          position: nextPosition,
          url: saved.url,
          alt: product.name,
          isPrimary: false,
        },
      })
      break
    } catch (err) {
      if (isUniqueConstraintError(err) && attempt < 4) continue
      // Created the file but couldn't persist the row — clean the orphan file.
      await deleteProductImageFile(saved.url)
      throw err
    }
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productImageUpdated,
    entityType: 'product',
    entityId: product.slug,
    summary: `Добавлено изображение галереи товара ${product.slug}.`,
  })

  revalidateStorefront(product.slug)
  redirect(`${editPath(productId)}?gok=added`)
}

/**
 * Delete a SECONDARY gallery image (Этап 29A). Defensive on two axes: the image
 * must belong to the given product AND must NOT be the primary slot (isPrimary or
 * position 0). The primary image's replace/delete flow from 26F is therefore never
 * reachable here — this only removes gallery extras (row + file).
 */
export async function deleteGalleryImageAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  const imageId = String(formData.get('imageId') ?? '').trim()
  if (!productId || !imageId) redirect(`${CATALOG_PATH}?err=missing`)

  const image = await prisma.productImage.findUnique({
    where: { id: imageId },
    select: {
      id: true,
      productId: true,
      position: true,
      isPrimary: true,
      url: true,
      product: { select: { slug: true } },
    },
  })
  // Unknown image or one that belongs to a different product → safe no-op.
  if (!image || image.productId !== productId) redirect(`${editPath(productId)}?gerr=notfound`)
  // Never delete the primary slot through the gallery action (26F owns it).
  if (image.isPrimary || image.position === 0) redirect(`${editPath(productId)}?gerr=primary`)

  await prisma.productImage.delete({ where: { id: image.id } })
  await deleteProductImageFile(image.url)

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productImageRemoved,
    entityType: 'product',
    entityId: image.product.slug,
    summary: `Удалено изображение галереи товара ${image.product.slug}.`,
  })

  revalidateStorefront(image.product.slug)
  redirect(`${editPath(productId)}?gok=removed`)
}

// ─────────────────────────────────────────────────────────────────────────────
// Этап 30C — Admin product variant management
//
// Create / edit / delete the variant rows that 30B's order foundation already
// resolves, prices, and decrements. Each action re-checks the local admin guard
// AND a valid session, validates with the pure parser, audits, revalidates, and
// redirects with ?vok=/?verr= back to the product edit page. Variant rows carry
// optional priceDelta/stock/sku (30B); the storefront selector/cart is 30D.
// ─────────────────────────────────────────────────────────────────────────────

/** Open-order statuses where a cancellation+restock against a variant may still
 *  happen — deleting such a variant would orphan its restock target (Этап 30C). */
const OPEN_ORDER_STATUSES: readonly OrderStatus[] = [OrderStatus.submitted, OrderStatus.processing]

/**
 * Guarantees a product has EXACTLY ONE default variant when it has any (Этап 30C),
 * so 30B's default fallback always resolves deterministically. If zero variants
 * are default, the stable first (sortOrder, value, id) is promoted; if several
 * are, only that stable one is kept. A product with no variants keeps no default.
 * Runs inside the caller's transaction. NOTE: when a specific variant was just set
 * default (siblings already unset), this is a no-op (exactly one default already).
 */
async function ensureExactlyOneDefault(tx: Prisma.TransactionClient, productId: string): Promise<void> {
  const variants = await tx.productVariant.findMany({
    where: { productId },
    select: { id: true, isDefault: true, sortOrder: true, value: true },
  })
  if (variants.length === 0) return
  const defaults = variants.filter((v) => v.isDefault)
  if (defaults.length === 1) return
  const stable = [...variants].sort(
    (a, b) =>
      a.sortOrder - b.sortOrder || a.value.localeCompare(b.value) || a.id.localeCompare(b.id),
  )[0]
  await tx.productVariant.updateMany({
    where: { productId, isDefault: true },
    data: { isDefault: false },
  })
  await tx.productVariant.update({ where: { id: stable.id }, data: { isDefault: true } })
}

/** Rejects a priceDelta that would push the product's final price to <= 0 (Этап
 *  30C). Only enforced when the product carries a base price (coming_soon has
 *  none — the order foundation rejects an unpriced order anyway). */
function finalPriceIsValid(basePrice: number | null, priceDelta: number | null): boolean {
  if (basePrice == null) return true
  return basePrice + (priceDelta ?? 0) > 0
}

/** Add a variant to a product. The first variant becomes default automatically. */
export async function addVariantAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  if (!productId) redirect(`${CATALOG_PATH}?err=missing`)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, price: true },
  })
  if (!product) redirect(`${CATALOG_PATH}?err=notfound`)

  const parsed = parseVariantForm(formData)
  if (!parsed.ok) redirect(`${editPath(productId)}?verr=${parsed.error}`)
  const input = parsed.data

  if (!finalPriceIsValid(product.price, input.priceDelta)) {
    redirect(`${editPath(productId)}?verr=pricetotal`)
  }

  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.productVariant.count({ where: { productId } })
      // First variant is always default; otherwise honour the checkbox.
      const makeDefault = input.isDefault || count === 0
      if (makeDefault) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true },
          data: { isDefault: false },
        })
      }
      await tx.productVariant.create({
        data: {
          productId,
          name: input.name,
          value: input.value,
          sortOrder: input.sortOrder,
          isDefault: makeDefault,
          priceDelta: input.priceDelta,
          stockQuantity: input.stockQuantity,
          sku: input.sku,
        },
      })
      await ensureExactlyOneDefault(tx, productId)
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(`${editPath(productId)}?verr=duplicate`)
    throw err
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productVariantAdded,
    entityType: 'product',
    entityId: product.slug,
    summary: `Добавлен вариант «${input.value}» товара ${product.slug}.`,
  })

  revalidateStorefront(product.slug)
  redirect(`${editPath(productId)}?vok=added`)
}

/** Update one variant's fields. Setting isDefault unsets the product's siblings. */
export async function updateVariantAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  const variantId = String(formData.get('variantId') ?? '').trim()
  if (!productId || !variantId) redirect(`${CATALOG_PATH}?err=missing`)

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, slug: true, price: true },
  })
  if (!product) redirect(`${CATALOG_PATH}?err=notfound`)

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true },
  })
  // Unknown variant, or one belonging to a different product → reject.
  if (!variant || variant.productId !== productId) redirect(`${editPath(productId)}?verr=notfound`)

  const parsed = parseVariantForm(formData)
  if (!parsed.ok) redirect(`${editPath(productId)}?verr=${parsed.error}`)
  const input = parsed.data

  if (!finalPriceIsValid(product.price, input.priceDelta)) {
    redirect(`${editPath(productId)}?verr=pricetotal`)
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.productVariant.updateMany({
          where: { productId, isDefault: true, id: { not: variantId } },
          data: { isDefault: false },
        })
      }
      await tx.productVariant.update({
        where: { id: variantId },
        data: {
          name: input.name,
          value: input.value,
          sortOrder: input.sortOrder,
          isDefault: input.isDefault,
          priceDelta: input.priceDelta,
          stockQuantity: input.stockQuantity,
          sku: input.sku,
        },
      })
      // If the admin unchecked the LAST default, re-promote a stable one — a
      // variant product never ends up with zero defaults.
      await ensureExactlyOneDefault(tx, productId)
    })
  } catch (err) {
    if (isUniqueConstraintError(err)) redirect(`${editPath(productId)}?verr=duplicate`)
    throw err
  }

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productVariantUpdated,
    entityType: 'product',
    entityId: product.slug,
    summary: `Обновлён вариант «${input.value}» товара ${product.slug}.`,
  })

  revalidateStorefront(product.slug)
  redirect(`${editPath(productId)}?vok=updated`)
}

/**
 * Delete a variant. Blocked when the variant is referenced by an OPEN order
 * (submitted/processing) whose cancellation could still need to restock it —
 * removing it would orphan that restock target. Completed/cancelled (terminal)
 * orders keep their immutable snapshot, so deleting a variant they reference is
 * safe. Deleting the default promotes the next stable variant; deleting the last
 * leaves no default. Order history is never cascaded (loose snapshot id, 30B).
 */
export async function deleteVariantAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const productId = String(formData.get('productId') ?? '').trim()
  const variantId = String(formData.get('variantId') ?? '').trim()
  if (!productId || !variantId) redirect(`${CATALOG_PATH}?err=missing`)

  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true, value: true, product: { select: { slug: true } } },
  })
  if (!variant || variant.productId !== productId) redirect(`${editPath(productId)}?verr=notfound`)

  // Safety: never delete a variant an open order may still restock on cancel.
  const openRefs = await prisma.orderItem.count({
    where: { variantId, order: { status: { in: [...OPEN_ORDER_STATUSES] } } },
  })
  if (openRefs > 0) redirect(`${editPath(productId)}?verr=inuse`)

  await prisma.$transaction(async (tx) => {
    await tx.productVariant.delete({ where: { id: variantId } })
    await ensureExactlyOneDefault(tx, productId)
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productVariantRemoved,
    entityType: 'product',
    entityId: variant.product.slug,
    summary: `Удалён вариант «${variant.value}» товара ${variant.product.slug}.`,
  })

  revalidateStorefront(variant.product.slug)
  redirect(`${editPath(productId)}?vok=removed`)
}
