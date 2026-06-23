'use server'

/**
 * AURELIA — Manual stock adjustment action (Этап 70A)
 *
 * The ONE mutation of the inventory operations area: an admin sets or changes the stock of a
 * single product OR variant level. Every adjustment is:
 *   - guarded (ensureLocalAdmin — 404 in prod/non-local — AND a valid admin session);
 *   - validated server-side (pure parseAdjustment: integer-only, no NaN, no negative final stock,
 *     no delta against an untracked level, safe length-capped + markup-free note);
 *   - applied RACE-SAFELY (a conditional `updateMany` guarded on the exact pre-value, so a
 *     concurrent order decrement / another admin edit can never silently clobber it), and
 *   - recorded as an append-only InventoryStockMovement row IN THE SAME TRANSACTION, then audited.
 *
 * It NEVER deletes a product/variant, never sets a level back to "untracked" (that stays in the
 * catalog edit form), and never bypasses the stock-source rules — it only edits the same
 * `stockQuantity` field the catalog form already edits, with history + validation on top.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from '../admin/guard'
import { requireAdminSession } from '../admin/auth'
import { AUDIT_ACTIONS, recordAuditEvent } from '../admin/audit'
import { parseAdjustment } from './stock-health'
import { buildMovementInput, type MovementLevel } from './movements'
import { getAdjustableLevel } from './inventory-data'

const INVENTORY_PATH = '/admin/inventory'

/** Revalidate the inventory + catalog admin views and every storefront surface stock can gate. */
function revalidateAll(productSlug: string) {
  revalidatePath(INVENTORY_PATH)
  revalidatePath('/admin/catalog')
  revalidatePath('/admin/dashboard')
  revalidatePath('/')
  revalidatePath('/category/bijouterie')
  revalidatePath('/category/gifts')
  revalidatePath('/search')
  revalidatePath(`/product/${productSlug}`)
}

function parseLevel(raw: string): MovementLevel | null {
  return raw === 'product' || raw === 'variant' ? raw : null
}

export async function adjustStockAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const level = parseLevel(String(formData.get('level') ?? '').trim())
  const targetId = String(formData.get('targetId') ?? '').trim()
  if (!level || !targetId) redirect(`${INVENTORY_PATH}?err=target`)

  const current = await getAdjustableLevel(level, targetId)
  if (!current) redirect(`${INVENTORY_PATH}?err=target`)

  const parsed = parseAdjustment({
    mode: String(formData.get('mode') ?? '').trim(),
    rawValue: String(formData.get('value') ?? ''),
    current: current.stockQuantity,
    rawNote: String(formData.get('note') ?? ''),
  })
  if (!parsed.ok) redirect(`${INVENTORY_PATH}?err=${parsed.error}`)

  const { delta, newValue, note } = parsed.data
  const before = current.stockQuantity

  // Apply + record atomically. The conditional WHERE guards on the EXACT pre-value (or null for
  // an untracked level), so a concurrent change makes count === 0 → we abort without clobbering.
  let applied = false
  await prisma.$transaction(async (tx) => {
    const res =
      level === 'product'
        ? await tx.product.updateMany({
            where: { id: targetId, stockQuantity: before },
            data: { stockQuantity: newValue },
          })
        : await tx.productVariant.updateMany({
            where: { id: targetId, stockQuantity: before },
            data: { stockQuantity: newValue },
          })
    if (res.count !== 1) return // stale read — leave applied = false, no movement recorded
    applied = true

    await tx.inventoryStockMovement.create({
      data: buildMovementInput({
        level,
        delta,
        reason: 'manual_adjustment',
        productId: current.productId,
        variantId: level === 'variant' ? targetId : null,
        quantityBefore: before,
        quantityAfter: newValue,
        actorLabel: session.sub,
        note,
      }),
    })
  })

  if (!applied) redirect(`${INVENTORY_PATH}?err=stale`)

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.stockAdjusted,
    entityType: level,
    entityId: current.productSlug,
    summary: `Остаток (${level === 'variant' ? 'вариант' : 'товар'}) ${current.label}: ${
      before ?? '—'
    } → ${newValue} (${delta > 0 ? '+' : ''}${delta}).`,
    metadata: { level, delta, before, after: newValue },
  })

  revalidateAll(current.productSlug)
  redirect(`${INVENTORY_PATH}?ok=adjusted`)
}
