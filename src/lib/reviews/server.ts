/**
 * AURELIA — Server review layer (Этап 59A)
 *
 * DB-backed review reads for the storefront PDP. PUBLIC by construction: only
 * `approved` reviews of a `published` product are ever returned, so a pending or
 * rejected review (or a review of a hidden product) is never publicly visible.
 *
 * `import 'server-only'` keeps Prisma out of the client bundle — client components
 * receive the already-shaped `PublicReview[]` / `ReviewSummary` as props.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { summarizeRatings } from './validate'
import type { PublicReview, ReviewSummary } from './types'

const APPROVED = 'approved' as const

/**
 * Approved reviews for a product, newest first, resolved by SLUG (so callers that
 * only hold the storefront `Product` — which has no DB id — can use it). A hidden
 * product resolves to no reviews. Demo/sample reviews are included but carry the
 * `isDemo` flag so the UI can label them honestly.
 */
export async function getApprovedReviewsBySlug(slug: string, take = 20): Promise<PublicReview[]> {
  if (!slug) return []
  const rows = await prisma.productReview.findMany({
    where: { status: APPROVED, product: { slug, isPublished: true } },
    orderBy: { createdAt: 'desc' },
    take,
    select: { id: true, authorName: true, rating: true, body: true, createdAt: true, isDemo: true },
  })
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    isDemo: r.isDemo,
  }))
}

/** Aggregate rating summary (approved reviews only) for a product slug. */
export async function getReviewSummaryBySlug(slug: string): Promise<ReviewSummary> {
  if (!slug) return { average: 0, count: 0 }
  const rows = await prisma.productReview.findMany({
    where: { status: APPROVED, product: { slug, isPublished: true } },
    select: { rating: true },
  })
  return summarizeRatings(rows.map((r) => r.rating))
}

/**
 * Approved-review aggregates for many products at once (Этап 64A — catalog rating sort).
 * One grouped query over APPROVED reviews only (pending/rejected excluded), keyed by
 * productId. Products with no approved reviews are simply absent from the map → the caller
 * treats them as 0/0 (never a faked rating). For the current small catalog this is a single
 * cheap groupBy; at large scale this would move to a denormalised counter (documented).
 */
export async function getApprovedReviewAggregatesByProductIds(
  productIds: string[],
): Promise<Map<string, ReviewSummary>> {
  const map = new Map<string, ReviewSummary>()
  if (productIds.length === 0) return map
  const groups = await prisma.productReview.groupBy({
    by: ['productId'],
    where: { status: APPROVED, productId: { in: productIds }, product: { isPublished: true } },
    _count: { rating: true },
    _avg: { rating: true },
  })
  for (const g of groups) {
    const count = g._count.rating
    const avg = g._avg.rating ?? 0
    // Round to one decimal to match summarizeRatings / the PDP display.
    map.set(g.productId, { count, average: Math.round(avg * 10) / 10 })
  }
  return map
}
