/**
 * AURELIA — Admin availability-interest data layer (Этап 79A) — server-only
 *
 * Prisma reads for the local admin back-in-stock queue. Privacy by construction: the list
 * NEVER returns the raw email — only a masked partial. Exposes safe counts + per-row status,
 * the product (name/slug/current availability) so an admin can decide whether to "prepare"
 * a NO-SEND notification. No token/secret/cookie is ever selected.
 */

import 'server-only'

import { AvailabilityInterestStatus, ProductStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { maskEmail } from '../support/email-utils'

export const AVAILABILITY_STATUSES = Object.values(AvailabilityInterestStatus) as AvailabilityInterestStatus[]

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityInterestStatus, string> = {
  requested: 'Запрошено',
  pending_availability: 'Ожидает наличия',
  queued_notification: 'В очереди на уведомление',
  notification_prepared: 'Уведомление подготовлено (без отправки)',
  cancelled: 'Отменено',
  expired: 'Истекло',
}

export function isAvailabilityStatus(value: string): value is AvailabilityInterestStatus {
  return (AVAILABILITY_STATUSES as string[]).includes(value)
}

/** Count of OPEN availability interests (requested / pending / queued). */
export async function getOpenAvailabilityInterestCount(): Promise<number> {
  return prisma.productAvailabilityInterest.count({
    where: {
      status: {
        in: [
          AvailabilityInterestStatus.requested,
          AvailabilityInterestStatus.pending_availability,
          AvailabilityInterestStatus.queued_notification,
        ],
      },
    },
  })
}

/** Aggregate counts by status, for the admin summary tiles. */
export async function getAvailabilityStatusCounts(): Promise<Record<string, number>> {
  const groups = await prisma.productAvailabilityInterest.groupBy({
    by: ['status'],
    _count: { _all: true },
  })
  const out: Record<string, number> = {}
  for (const g of groups) out[g.status] = g._count._all
  return out
}

export interface AdminAvailabilityQuery {
  status?: string
}

/** Recent availability interests for the admin list. Open ones first by default. */
export async function getAdminAvailabilityInterests(opts: AdminAvailabilityQuery = {}) {
  const where =
    opts.status && isAvailabilityStatus(opts.status)
      ? { status: opts.status as AvailabilityInterestStatus }
      : {}

  const rows = await prisma.productAvailabilityInterest.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      variantId: true,
      email: true,
      status: true,
      source: true,
      customerId: true,
      createdAt: true,
      notifiedAt: true,
      product: { select: { name: true, slug: true, status: true, price: true, stockQuantity: true } },
    },
  })

  return rows.map(({ email, product, ...rest }) => ({
    ...rest,
    productName: product.name,
    productSlug: product.slug,
    // Honest current availability (mirrors isProductPurchasable at product level).
    productAvailable:
      product.status === ProductStatus.available &&
      product.price != null &&
      product.stockQuantity !== 0,
    emailMasked: maskEmail(email),
    hasEmail: !!email,
  }))
}

export type AdminAvailabilityItem = Awaited<ReturnType<typeof getAdminAvailabilityInterests>>[number]
