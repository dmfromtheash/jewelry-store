/**
 * AURELIA — Admin operations dashboard: data layer (Этап 65A)
 *
 * Server-only Prisma reads for the upgraded /admin/dashboard. Everything is REAL data from
 * PostgreSQL — safe COUNTS / aggregates / minimal recent lists only. It NEVER selects a
 * secret, reset/verification token value, session/cookie, email body, raw provider payload,
 * or customer PII beyond what an order already exposes (and customers are reported as
 * aggregate counts only — no email list).
 *
 * Queries are batched with Promise.all (independent counts + a few groupBys), so the whole
 * dashboard is a small fixed number of round-trips — no per-row N+1. The promo set is read
 * once (≤200 rows) and classified in memory via the pure logic.
 */

import 'server-only'

import {
  OrderStatus,
  ReviewStatus,
  EmailOutboxStatus,
  ProductStatus,
  CustomerInterestStatus,
} from '@prisma/client'
import { prisma } from '../db/prisma'
import { PROVIDER_CONFIGURED } from '../email/outbox'
import {
  buildAttentionQueue,
  buildReadinessWarnings,
  classifyPromo,
  type AttentionItem,
  type ReadinessItem,
} from './operations-dashboard'

const NEW_CUSTOMER_WINDOW_DAYS = 7
const RECENT_LIMIT = 5

export interface OperationsDashboard {
  orders: {
    total: number
    submitted: number
    processing: number
    completed: number
    cancelled: number
    draft: number
    recent: { orderCode: string; status: OrderStatus; totalAmount: number; createdAt: Date }[]
  }
  reviews: {
    pending: number
    approved: number
    rejected: number
    recentPending: { id: string; productName: string; rating: number; createdAt: Date }[]
  }
  promos: {
    total: number
    active: number
    inactive: number
    archived: number
    exhausted: number
    expiringSoon: number
    recent: { code: string; type: string; active: boolean; usedCount: number; usageLimit: number | null }[]
  }
  email: {
    total: number
    queued: number
    skippedNoProvider: number
    failedValidation: number
    failedStub: number
    sentStub: number
    skippedLegacy: number
    providerConfigured: boolean
    recentProblems: { id: string; template: string; status: EmailOutboxStatus; relatedType: string | null; relatedId: string | null; createdAt: Date }[]
  }
  catalog: {
    products: number
    published: number
    hidden: number
    available: number
    comingSoon: number
    withoutPrice: number
    withoutImage: number
    zeroStockPurchasable: number
    categories: number
  }
  customers: {
    total: number
    verified: number
    unverified: number
    newLast7Days: number
    wishlistItems: number
  }
  /** Account engagement foundation (Этап 69A) — counts only, NO money/points/notifications. */
  engagement: {
    savedSearches: number
    activeInterests: number
  }
  attention: AttentionItem[]
  readiness: ReadinessItem[]
}

export async function getOperationsDashboard(now: Date = new Date()): Promise<OperationsDashboard> {
  const newCustomerSince = new Date(now.getTime() - NEW_CUSTOMER_WINDOW_DAYS * 24 * 60 * 60 * 1000)

  const [
    orderGroups,
    recentOrders,
    reviewGroups,
    recentPendingReviews,
    promoRows,
    emailGroups,
    recentEmailProblems,
    productsTotal,
    published,
    hidden,
    available,
    comingSoon,
    withoutPrice,
    withoutImage,
    zeroStockPurchasable,
    categories,
    customersTotal,
    customersVerified,
    customersNew,
    wishlistItems,
    savedSearchesTotal,
    activeInterestsTotal,
  ] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      select: { orderCode: true, status: true, totalAmount: true, createdAt: true },
    }),
    prisma.productReview.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.productReview.findMany({
      where: { status: ReviewStatus.pending },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      select: { id: true, rating: true, createdAt: true, product: { select: { name: true } } },
    }),
    prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: { code: true, type: true, isActive: true, archivedAt: true, endsAt: true, usageLimit: true, usedCount: true },
    }),
    prisma.emailOutbox.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.emailOutbox.findMany({
      where: { status: { in: [EmailOutboxStatus.queued, EmailOutboxStatus.failed_validation, EmailOutboxStatus.failed_stub] } },
      orderBy: { createdAt: 'desc' },
      take: RECENT_LIMIT,
      // SAFE subset only — never subject body text, recipient, note, or lastError detail.
      select: { id: true, template: true, status: true, relatedType: true, relatedId: true, createdAt: true },
    }),
    prisma.product.count(),
    prisma.product.count({ where: { isPublished: true } }),
    prisma.product.count({ where: { isPublished: false } }),
    prisma.product.count({ where: { isPublished: true, status: ProductStatus.available } }),
    prisma.product.count({ where: { isPublished: true, status: ProductStatus.coming_soon } }),
    prisma.product.count({ where: { isPublished: true, price: null } }),
    prisma.product.count({ where: { isPublished: true, images: { none: { url: { not: null } } } } }),
    prisma.product.count({ where: { isPublished: true, status: ProductStatus.available, stockQuantity: 0 } }),
    prisma.category.count(),
    prisma.customer.count(),
    prisma.customer.count({ where: { emailVerifiedAt: { not: null } } }),
    prisma.customer.count({ where: { createdAt: { gte: newCustomerSince } } }),
    prisma.customerWishlistItem.count(),
    prisma.customerSavedSearch.count(),
    prisma.customerProductInterest.count({ where: { status: CustomerInterestStatus.active } }),
  ])

  // --- Orders ---
  const orderCount = (s: OrderStatus) => orderGroups.find((g) => g.status === s)?._count._all ?? 0
  const orders = {
    total: orderGroups.reduce((n, g) => n + g._count._all, 0),
    submitted: orderCount(OrderStatus.submitted),
    processing: orderCount(OrderStatus.processing),
    completed: orderCount(OrderStatus.completed),
    cancelled: orderCount(OrderStatus.cancelled),
    draft: orderCount(OrderStatus.draft),
    recent: recentOrders,
  }

  // --- Reviews ---
  const reviewCount = (s: ReviewStatus) => reviewGroups.find((g) => g.status === s)?._count._all ?? 0
  const reviews = {
    pending: reviewCount(ReviewStatus.pending),
    approved: reviewCount(ReviewStatus.approved),
    rejected: reviewCount(ReviewStatus.rejected),
    recentPending: recentPendingReviews.map((r) => ({
      id: r.id,
      productName: r.product.name,
      rating: r.rating,
      createdAt: r.createdAt,
    })),
  }

  // --- Promos (classified in memory) ---
  let active = 0
  let inactive = 0
  let archived = 0
  let exhausted = 0
  let expiringSoon = 0
  for (const p of promoRows) {
    const c = classifyPromo(p, now)
    if (c.archived) archived++
    if (c.exhausted && !c.archived) exhausted++
    if (c.expiringSoon) expiringSoon++
    if (c.active) active++
    else if (!c.archived) inactive++
  }
  const promos = {
    total: promoRows.length,
    active,
    inactive,
    archived,
    exhausted,
    expiringSoon,
    recent: promoRows.slice(0, RECENT_LIMIT).map((p) => ({
      code: p.code,
      type: p.type,
      active: classifyPromo(p, now).active,
      usedCount: p.usedCount,
      usageLimit: p.usageLimit,
    })),
  }

  // --- Email outbox ---
  const emailCount = (s: EmailOutboxStatus) => emailGroups.find((g) => g.status === s)?._count._all ?? 0
  const failedValidation = emailCount(EmailOutboxStatus.failed_validation)
  const failedStub = emailCount(EmailOutboxStatus.failed_stub)
  const queued = emailCount(EmailOutboxStatus.queued)
  const email = {
    total: emailGroups.reduce((n, g) => n + g._count._all, 0),
    queued,
    skippedNoProvider: emailCount(EmailOutboxStatus.skipped_no_provider),
    failedValidation,
    failedStub,
    sentStub: emailCount(EmailOutboxStatus.sent_stub),
    skippedLegacy: emailCount(EmailOutboxStatus.skipped),
    providerConfigured: PROVIDER_CONFIGURED,
    recentProblems: recentEmailProblems,
  }

  const catalog = {
    products: productsTotal,
    published,
    hidden,
    available,
    comingSoon,
    withoutPrice,
    withoutImage,
    zeroStockPurchasable,
    categories,
  }

  const customers = {
    total: customersTotal,
    verified: customersVerified,
    unverified: customersTotal - customersVerified,
    newLast7Days: customersNew,
    wishlistItems,
  }

  const engagement = {
    savedSearches: savedSearchesTotal,
    activeInterests: activeInterestsTotal,
  }

  const attention = buildAttentionQueue({
    orders: { submitted: orders.submitted, processing: orders.processing },
    reviews: { pending: reviews.pending },
    email: { queued, failed: failedValidation + failedStub },
    promos: { exhausted, expiringSoon },
    catalog: { withoutPrice, withoutImage, zeroStockPurchasable },
    customers: { unverified: customers.unverified },
    interests: { active: activeInterestsTotal },
  })

  return {
    orders,
    reviews,
    promos,
    email,
    catalog,
    customers,
    engagement,
    attention,
    readiness: buildReadinessWarnings(PROVIDER_CONFIGURED),
  }
}
