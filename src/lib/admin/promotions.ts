/**
 * AURELIA — Admin promo data layer (Этап 63A)
 *
 * Server-only Prisma reads/writes for the local admin promo screen. No hard deletes — a
 * promo is soft-archived (`archivedAt`) so order history that references its code stays
 * auditable. `usedCount` is never edited here (it is owned by the order commit path).
 *
 * `import 'server-only'` keeps Prisma out of the client bundle.
 */

import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import type { NormalizedPromoForm } from './promotion-form'

const PROMO_LIST_SELECT = {
  id: true,
  code: true,
  internalName: true,
  type: true,
  percentValue: true,
  amountMinor: true,
  currency: true,
  isActive: true,
  startsAt: true,
  endsAt: true,
  minSubtotalMinor: true,
  maxDiscountMinor: true,
  usageLimit: true,
  usedCount: true,
  notes: true,
  archivedAt: true,
  createdAt: true,
} as const

/** All promos for the admin list (newest first). Includes archived ones (shown muted). */
export async function getAdminPromos() {
  return prisma.promoCode.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: PROMO_LIST_SELECT,
  })
}

export type AdminPromoListItem = Awaited<ReturnType<typeof getAdminPromos>>[number]

export async function getAdminPromoById(id: string) {
  if (!id) return null
  return prisma.promoCode.findUnique({ where: { id }, select: PROMO_LIST_SELECT })
}

/** Maps the normalised form to the columns shared by create + update. */
function toData(v: NormalizedPromoForm) {
  return {
    internalName: v.internalName,
    type: v.type,
    percentValue: v.type === 'percent' ? v.percentValue : null,
    amountMinor: v.type === 'fixed_amount' ? v.amountMinor : null,
    minSubtotalMinor: v.minSubtotalMinor,
    maxDiscountMinor: v.maxDiscountMinor,
    usageLimit: v.usageLimit,
    startsAt: v.startsAt,
    endsAt: v.endsAt,
    notes: v.notes,
  }
}

export class DuplicatePromoCodeError extends Error {
  constructor() {
    super('duplicate_promo_code')
    this.name = 'DuplicatePromoCodeError'
  }
}

/** Creates a promo. Throws DuplicatePromoCodeError on the unique-code constraint. */
export async function createPromo(v: NormalizedPromoForm): Promise<{ id: string }> {
  try {
    return await prisma.promoCode.create({
      data: { code: v.code, currency: 'UAH', isActive: true, ...toData(v) },
      select: { id: true },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicatePromoCodeError()
    }
    throw e
  }
}

/** Updates an existing promo's safe fields (NOT usedCount, NOT the code identity).
 *  Throws DuplicatePromoCodeError if the (re)entered code collides with another promo. */
export async function updatePromo(id: string, v: NormalizedPromoForm): Promise<void> {
  try {
    await prisma.promoCode.update({
      where: { id },
      data: { code: v.code, ...toData(v) },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicatePromoCodeError()
    }
    throw e
  }
}

/** Activates / deactivates a promo. Never touches usedCount or the discount values. */
export async function setPromoActive(id: string, isActive: boolean): Promise<void> {
  await prisma.promoCode.update({ where: { id }, data: { isActive } })
}

/** Soft-delete: stamps archivedAt and deactivates. No hard delete. Idempotent. */
export async function archivePromo(id: string): Promise<void> {
  await prisma.promoCode.update({
    where: { id },
    data: { archivedAt: new Date(), isActive: false },
  })
}
