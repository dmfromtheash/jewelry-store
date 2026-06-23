/**
 * AURELIA — Product content readiness data layer (Этап 71A) — server-only
 *
 * Server-only Prisma reads for the /admin/readiness route + the product-edit readiness panel +
 * the dashboard readiness KPI. READ-ONLY: it NEVER mutates a product, NEVER gates checkout, and
 * NEVER touches availability logic — it only describes how "card-ready" each product is, using the
 * pure rules in ./rules.
 *
 * Everything is REAL data from PostgreSQL: the existing Product scalar fields + its images,
 * variants, and APPROVED-review counts. No secret / token / cookie / PII is ever selected.
 *
 * Scale: the catalog is demo-scale (a few hundred products). Products are read with their images +
 * variants in ONE bounded query and the approved-review counts come from ONE grouped query — no
 * per-row N+1.
 */

import 'server-only'

import { ReviewStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import {
  evaluateProductReadiness,
  productRowToReadinessInput,
  summarizeReadiness,
  type ProductReadiness,
  type ReadinessIssueCode,
  type ReadinessSummary,
} from './rules'

const PRODUCT_LIMIT = 500

/** Select shared by the overview + single-product reads (kept in sync with the pure mapper). */
const READINESS_SELECT = {
  id: true,
  slug: true,
  name: true,
  categoryLabel: true,
  status: true,
  isPublished: true,
  currency: true,
  price: true,
  stockQuantity: true,
  sku: true,
  description: true,
  specs: true,
  rating: true,
  images: { select: { url: true, alt: true, isPrimary: true, position: true } },
  variants: { select: { isDefault: true } },
} as const

export interface ReadinessProductView {
  id: string
  slug: string
  name: string
  status: 'available' | 'coming_soon'
  isPublished: boolean
  categoryLabel: string
  price: number | null
  currency: string
  stockQuantity: number | null
  variantCount: number
  readiness: ProductReadiness
}

export interface ReadinessOverview {
  summary: ReadinessSummary
  products: ReadinessProductView[]
}

/** Approved-review counts for the given product ids, in ONE grouped query (admin sees all rows). */
async function approvedReviewCounts(productIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (productIds.length === 0) return map
  const groups = await prisma.productReview.groupBy({
    by: ['productId'],
    where: { status: ReviewStatus.approved, productId: { in: productIds } },
    _count: { _all: true },
  })
  for (const g of groups) map.set(g.productId, g._count._all)
  return map
}

/**
 * Builds the full content-readiness overview: every product evaluated against the pure rules, plus
 * a store-wide summary. Admin-only: deliberately UNFILTERED by visibility so hidden products are
 * still inspectable here (an admin can decide whether to publish them).
 */
export async function getReadinessOverview(): Promise<ReadinessOverview> {
  const rows = await prisma.product.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: PRODUCT_LIMIT,
    select: READINESS_SELECT,
  })

  const reviewCounts = await approvedReviewCounts(rows.map((r) => r.id))

  const products: ReadinessProductView[] = rows.map((r) => {
    const input = productRowToReadinessInput({ ...r, approvedReviewCount: reviewCounts.get(r.id) ?? 0 })
    const readiness = evaluateProductReadiness(input)
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      status: r.status,
      isPublished: r.isPublished,
      categoryLabel: r.categoryLabel,
      price: r.price,
      currency: r.currency,
      stockQuantity: r.stockQuantity,
      variantCount: r.variants.length,
      readiness,
    }
  })

  return { summary: summarizeReadiness(products.map((p) => p.readiness)), products }
}

/** Readiness for ONE product (for the admin edit-page panel), or null when it does not exist. */
export async function getProductReadiness(id: string): Promise<ProductReadiness | null> {
  if (!id) return null
  const row = await prisma.product.findUnique({ where: { id }, select: READINESS_SELECT })
  if (!row) return null
  const counts = await approvedReviewCounts([row.id])
  const input = productRowToReadinessInput({ ...row, approvedReviewCount: counts.get(row.id) ?? 0 })
  return evaluateProductReadiness(input)
}

/**
 * Compact readiness counts for the dashboard KPI + attention queue (Этап 71A). Reuses the same
 * bounded read + pure rules as the overview, so the dashboard never disagrees with /admin/readiness.
 */
export interface ReadinessDashboardCounts {
  total: number
  realSaleReady: number
  publicDemoReady: number
  withBlockers: number
  withWarnings: number
  withPhotoGap: number
}

export async function getReadinessDashboardCounts(): Promise<ReadinessDashboardCounts> {
  const { summary } = await getReadinessOverview()
  return {
    total: summary.total,
    realSaleReady: summary.realSaleReady,
    publicDemoReady: summary.publicDemoReady,
    withBlockers: summary.withBlockers,
    withWarnings: summary.withWarnings,
    withPhotoGap: summary.withPhotoGap,
  }
}

/** Filter keys accepted by the /admin/readiness route. */
export type ReadinessFilter =
  | 'all'
  | 'blockers'
  | 'warnings'
  | 'photo-gap'
  | 'no-description'
  | 'not-public-ready'
  | 'not-sale-ready'

/** Pure predicate so the route + verify agree on what each filter means. */
export function matchesReadinessFilter(view: ReadinessProductView, filter: ReadinessFilter): boolean {
  const r = view.readiness
  const hasCode = (code: ReadinessIssueCode) => r.issues.some((i) => i.code === code)
  switch (filter) {
    case 'all':
      return true
    case 'blockers':
      return r.blockerCount > 0
    case 'warnings':
      return r.warningCount > 0
    case 'photo-gap':
      return r.hasPhotoGap
    case 'no-description':
      return hasCode('description-missing') || hasCode('description-placeholder')
    case 'not-public-ready':
      return !r.publicDemoReady
    case 'not-sale-ready':
      return !r.realSaleReady
    default:
      return true
  }
}
