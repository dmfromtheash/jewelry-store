/**
 * AURELIA — Customer account availability-interest reads/cancel (Этап 86A) — server-only
 *
 * Reads back the logged-in customer's OWN email-based availability interests (model
 * ProductAvailabilityInterest, the PDP "Повідомити про наявність" form) and lets them
 * withdraw one. HARD-SCOPED by `customerId` everywhere — a customer can only ever see or
 * cancel their OWN interest.
 *
 * Honest by construction: NOTHING is emailed and NO stock is ever reserved or held — this
 * is only a waiting list. Cancelling just sets the row to `cancelled` (a normal lifecycle
 * state, NOT a hold/reservation state). Privacy: the raw email is NEVER returned — only a
 * masked partial; `emailHash`/`source` internals are never surfaced.
 */

import 'server-only'

import { AvailabilityInterestStatus, ProductStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { maskEmail } from '../support/email-utils'

export interface MyAvailabilityInterest {
  id: string
  status: string
  createdAt: Date
  updatedAt: Date
  productName: string
  productSlug: string
  /** Whether the related product is still published (drives whether we link to the PDP). */
  productPublished: boolean
  /** Honest current availability (mirrors product-level purchasability). */
  productAvailable: boolean
  /** Masked partial of the customer's OWN reply email, e.g. "jo***@x.io". '' when none. */
  emailMasked: string
}

/** The customer's OWN availability interests (newest first), masked + safe to render. */
export async function listMyAvailabilityInterests(
  customerId: string,
): Promise<MyAvailabilityInterest[]> {
  if (!customerId) return []
  const rows = await prisma.productAvailabilityInterest.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      status: true,
      email: true,
      createdAt: true,
      updatedAt: true,
      product: { select: { name: true, slug: true, isPublished: true, status: true, price: true, stockQuantity: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    productName: r.product.name,
    productSlug: r.product.slug,
    productPublished: r.product.isPublished,
    productAvailable:
      r.product.status === ProductStatus.available &&
      r.product.price != null &&
      r.product.stockQuantity !== 0,
    emailMasked: maskEmail(r.email),
  }))
}

/**
 * Withdraws ONE availability interest, HARD-SCOPED to the owner. A scoped `updateMany`
 * means another customer's id can never touch this row; an already cancelled/expired row
 * is left as-is (idempotent). Returns true only when the owner's open row was cancelled.
 * NO inventory is touched and NO email is sent — this only withdraws a no-send record.
 */
export async function cancelMyAvailabilityInterest(
  customerId: string,
  id: string,
): Promise<boolean> {
  if (!customerId || !id) return false
  const res = await prisma.productAvailabilityInterest.updateMany({
    where: {
      id,
      customerId,
      status: {
        notIn: [AvailabilityInterestStatus.cancelled, AvailabilityInterestStatus.expired],
      },
    },
    data: { status: AvailabilityInterestStatus.cancelled },
  })
  return res.count > 0
}
