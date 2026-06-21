/**
 * AURELIA — Admin review data layer (Этап 59A)
 *
 * Server-only Prisma reads + status updates for the local admin review moderation
 * screen. No deletes, no body edits — a review can only be approved or rejected.
 * The product name is joined for context; nothing here exposes the reviewer's
 * account beyond the public author name + the loose customer id link.
 */

import 'server-only'

import { ReviewStatus } from '@prisma/client'
import { prisma } from '../db/prisma'

export const REVIEW_STATUSES = Object.values(ReviewStatus) as ReviewStatus[]

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'На модерации',
  approved: 'Одобрен',
  rejected: 'Отклонён',
}

export function isReviewStatus(value: string): value is ReviewStatus {
  return (REVIEW_STATUSES as string[]).includes(value)
}

/** Count of reviews still awaiting moderation (status = pending). */
export async function getPendingReviewCount(): Promise<number> {
  return prisma.productReview.count({ where: { status: ReviewStatus.pending } })
}

export interface AdminReviewsQuery {
  status?: string
}

/** Recent reviews for the admin list. Pending first by default (most actionable). */
export async function getAdminReviews(opts: AdminReviewsQuery = {}) {
  const where =
    opts.status && isReviewStatus(opts.status) ? { status: opts.status as ReviewStatus } : {}

  return prisma.productReview.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      authorName: true,
      rating: true,
      body: true,
      status: true,
      isDemo: true,
      customerId: true,
      createdAt: true,
      moderatedAt: true,
      product: { select: { name: true, slug: true } },
    },
  })
}

/** Reads just the current status (for the audit summary). */
export async function getAdminReviewStatus(id: string): Promise<ReviewStatus | null> {
  if (!id) return null
  const row = await prisma.productReview.findUnique({ where: { id }, select: { status: true } })
  return row?.status ?? null
}

/** Sets a review's moderation status + stamps moderatedAt. Never edits content. */
export async function setAdminReviewStatus(id: string, status: ReviewStatus) {
  return prisma.productReview.update({
    where: { id },
    data: { status, moderatedAt: new Date() },
    select: { id: true, status: true },
  })
}

export type AdminReviewListItem = Awaited<ReturnType<typeof getAdminReviews>>[number]
