/**
 * AURELIA — Admin customer data layer (Этап 68A)
 *
 * Server-only Prisma reads for the local admin customer + support area. READ-ONLY: it never
 * creates, edits, deletes, or impersonates a customer — it only lists and summarises. This is
 * a support/overview view, NOT a CRM and NOT a customer-management console.
 *
 * Privacy by construction — what is NEVER selected/returned here:
 *   - `passwordHash` (scrypt hash);
 *   - any token value or `tokenHash` (account tokens are reported as COUNTS only);
 *   - cookies / session tokens;
 *   - email BODY / subject / recipient / note / lastError from the outbox (only safe metadata:
 *     template, status, loose related ref, timestamp);
 *   - raw provider payloads.
 * `sessionVersion` / `passwordChangedAt` are surfaced as SAFE technical metadata only.
 *
 * Scale/perf: list + detail are a small fixed number of round-trips (Promise.all over counts +
 * bounded findMany / groupBy). No per-row N+1. Customers/orders are demo-scale (≤ a few hundred).
 */

import 'server-only'

import {
  EmailOutboxStatus,
  ProductStatus,
  ReviewStatus,
  CustomerTokenPurpose,
  CustomerInterestStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '../db/prisma'
import { buildCustomerSupportIndicators, type CustomerSupportInput } from './customer-support'
import { computeEngagement, type EngagementTier } from '../customer/engagement'

const LIST_LIMIT = 200
const RECENT_ORDERS = 10
const RECENT_REVIEWS = 20
const WISHLIST_LIMIT = 50
const RECENT_EMAIL = 20

/** Outbox statuses that count as a "problem" (not delivered) for a support indicator. */
const EMAIL_PROBLEM_STATUSES: EmailOutboxStatus[] = [
  EmailOutboxStatus.failed_validation,
  EmailOutboxStatus.failed_stub,
  EmailOutboxStatus.skipped,
  EmailOutboxStatus.skipped_no_provider,
]

/** A wishlist product the buyer can't actually purchase: hidden OR not in active sale. */
const WISHLIST_UNAVAILABLE_WHERE: Prisma.CustomerWishlistItemWhereInput = {
  OR: [{ product: { isPublished: false } }, { product: { status: { not: ProductStatus.available } } }],
}

export interface AdminCustomersQuery {
  query?: string
  /** 'verified' | 'unverified' — filter by email verification state. */
  verified?: string
  /** '1' to keep only customers with at least one order. */
  hasOrders?: string
  /** '1' to keep only customers with at least one wishlist item. */
  hasWishlist?: string
}

/** Short, display-only id (first 8 chars of the cuid) — mirrors the admin order-code style. */
export function shortCustomerId(id: string): string {
  return id.slice(0, 8)
}

/**
 * Lists customers (newest first) with safe aggregate counts + last-order date for the admin
 * list. Bounded to LIST_LIMIT. Only safe fields are selected — never a hash or token.
 */
export async function getAdminCustomers(opts: AdminCustomersQuery = {}) {
  const where: Prisma.CustomerWhereInput = {}

  const q = opts.query?.trim()
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ]
  }
  if (opts.verified === 'verified') where.emailVerifiedAt = { not: null }
  else if (opts.verified === 'unverified') where.emailVerifiedAt = null
  if (opts.hasOrders === '1') where.orders = { some: {} }
  if (opts.hasWishlist === '1') where.wishlist = { some: {} }

  const rows = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: LIST_LIMIT,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: { select: { orders: true, reviews: true, wishlist: true, savedSearches: true } },
      // Last order date only — bounded to ONE row per customer, so no N+1 blow-up at demo scale.
      orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  // Active product-interest counts for the listed customers in ONE grouped query (no N+1).
  const ids = rows.map((c) => c.id)
  const interestGroups = ids.length
    ? await prisma.customerProductInterest.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: CustomerInterestStatus.active },
        _count: { _all: true },
      })
    : []
  const activeInterestByCustomer = new Map(interestGroups.map((g) => [g.customerId, g._count._all]))

  return rows.map((c) => {
    const activeInterests = activeInterestByCustomer.get(c.id) ?? 0
    const engagement = computeEngagement({
      orders: c._count.orders,
      reviews: c._count.reviews,
      wishlist: c._count.wishlist,
      savedSearches: c._count.savedSearches,
      activeInterests,
    })
    return {
      id: c.id,
      shortId: shortCustomerId(c.id),
      email: c.email,
      name: c.name,
      phone: c.phone,
      emailVerified: c.emailVerifiedAt != null,
      createdAt: c.createdAt,
      orderCount: c._count.orders,
      reviewCount: c._count.reviews,
      wishlistCount: c._count.wishlist,
      savedSearchCount: c._count.savedSearches,
      activeInterestCount: activeInterests,
      engagementTier: engagement.tier as EngagementTier,
      engagementLabel: engagement.labelRu,
      lastOrderAt: c.orders[0]?.createdAt ?? null,
    }
  })
}

export type AdminCustomerListItem = Awaited<ReturnType<typeof getAdminCustomers>>[number]

/** Aggregate header counts for the customer list (over the SAME filter as the rows). */
export async function getAdminCustomersSummary() {
  const [total, verified] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { emailVerifiedAt: { not: null } } }),
  ])
  return { total, verified, unverified: total - verified }
}

/**
 * Full safe support summary for one customer: profile projection, counts, recent orders,
 * reviews, wishlist, outbox (safe metadata only), token COUNTS, and the derived support
 * indicators. Returns null for an unknown id. NEVER selects a hash/token/cookie/email body.
 */
export async function getAdminCustomerDetail(customerId: string, now: Date = new Date()) {
  if (!customerId) return null

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      emailVerifiedAt: true,
      // SAFE technical metadata only — NOT secrets. Never passwordHash.
      sessionVersion: true,
      passwordChangedAt: true,
      createdAt: true,
      _count: {
        select: { orders: true, reviews: true, wishlist: true, accountTokens: true, savedSearches: true },
      },
    },
  })
  if (!customer) return null

  // All of this customer's order codes (loose ids) so we can also surface order-related emails.
  const orderCodeRows = await prisma.order.findMany({
    where: { customerId },
    select: { orderCode: true },
  })
  const orderCodes = orderCodeRows.map((o) => o.orderCode)

  // Outbox rows tied to this customer directly OR to one of their orders. SAFE projection only.
  const outboxWhere: Prisma.EmailOutboxWhereInput = {
    OR: [
      { relatedType: 'customer', relatedId: customerId },
      ...(orderCodes.length ? [{ relatedType: 'order', relatedId: { in: orderCodes } }] : []),
    ],
  }

  const [
    recentOrders,
    reviews,
    wishlist,
    recentEmail,
    emailEventsTotal,
    pendingReviewCount,
    emailProblemCount,
    wishlistUnavailableCount,
    manualDeliveryOrderCount,
    tokensTotal,
    tokensLiveReset,
    tokensLiveVerify,
    activeInterestCount,
    activeInterests,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: RECENT_ORDERS,
      select: {
        orderCode: true,
        status: true,
        subtotalAmount: true,
        discountMinor: true,
        promoCode: true,
        totalAmount: true,
        deliveryCity: true,
        deliveryMethod: true,
        deliveryBranch: true,
        deliveryComment: true,
        createdAt: true,
      },
    }),
    prisma.productReview.findMany({
      where: { customerId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: RECENT_REVIEWS,
      select: {
        id: true,
        rating: true,
        status: true,
        createdAt: true,
        product: { select: { name: true, slug: true } },
      },
    }),
    prisma.customerWishlistItem.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: WISHLIST_LIMIT,
      select: {
        createdAt: true,
        product: { select: { name: true, slug: true, isPublished: true, status: true } },
      },
    }),
    prisma.emailOutbox.findMany({
      where: outboxWhere,
      orderBy: { createdAt: 'desc' },
      take: RECENT_EMAIL,
      // SAFE subset — never recipientEmail / subject / note / lastError / body.
      select: { id: true, template: true, status: true, relatedType: true, relatedId: true, createdAt: true },
    }),
    prisma.emailOutbox.count({ where: outboxWhere }),
    prisma.productReview.count({ where: { customerId, status: ReviewStatus.pending } }),
    prisma.emailOutbox.count({ where: { ...outboxWhere, status: { in: EMAIL_PROBLEM_STATUSES } } }),
    prisma.customerWishlistItem.count({ where: { customerId, ...WISHLIST_UNAVAILABLE_WHERE } }),
    prisma.order.count({
      where: { customerId, OR: [{ deliveryBranch: { not: null } }, { deliveryComment: { not: null } }] },
    }),
    prisma.customerAccountToken.count({ where: { customerId } }),
    prisma.customerAccountToken.count({
      where: { customerId, purpose: CustomerTokenPurpose.password_reset, usedAt: null, expiresAt: { gt: now } },
    }),
    prisma.customerAccountToken.count({
      where: { customerId, purpose: CustomerTokenPurpose.email_verification, usedAt: null, expiresAt: { gt: now } },
    }),
    prisma.customerProductInterest.count({
      where: { customerId, status: CustomerInterestStatus.active },
    }),
    prisma.customerProductInterest.findMany({
      where: { customerId, status: CustomerInterestStatus.active, product: { isPublished: true } },
      orderBy: { createdAt: 'desc' },
      take: WISHLIST_LIMIT,
      select: {
        id: true,
        createdAt: true,
        product: { select: { name: true, slug: true, isPublished: true, status: true } },
      },
    }),
  ])

  const indicatorInput: CustomerSupportInput = {
    emailVerified: customer.emailVerifiedAt != null,
    hasPhone: !!customer.phone?.trim(),
    orderCount: customer._count.orders,
    pendingReviewCount,
    emailProblemCount,
    wishlistUnavailableCount,
    liveRecoveryTokenCount: tokensLiveReset,
    manualDeliveryOrderCount,
    activeInterestCount,
  }

  // Non-financial engagement label (Этап 69A) — informational only, no money/points effect.
  const engagement = computeEngagement({
    orders: customer._count.orders,
    reviews: customer._count.reviews,
    wishlist: customer._count.wishlist,
    savedSearches: customer._count.savedSearches,
    activeInterests: activeInterestCount,
  })

  return {
    profile: {
      id: customer.id,
      shortId: shortCustomerId(customer.id),
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      emailVerified: customer.emailVerifiedAt != null,
      emailVerifiedAt: customer.emailVerifiedAt,
      sessionVersion: customer.sessionVersion,
      passwordChangedAt: customer.passwordChangedAt,
      createdAt: customer.createdAt,
    },
    engagement: { tier: engagement.tier, label: engagement.labelRu },
    counts: {
      orders: customer._count.orders,
      reviews: customer._count.reviews,
      wishlist: customer._count.wishlist,
      savedSearches: customer._count.savedSearches,
      activeInterests: activeInterestCount,
      emailEvents: emailEventsTotal,
      tokensTotal,
      tokensLiveReset,
      tokensLiveVerify,
    },
    recentOrders,
    reviews,
    wishlist: wishlist.map((w) => ({
      name: w.product.name,
      slug: w.product.slug,
      available: w.product.isPublished && w.product.status === ProductStatus.available,
      createdAt: w.createdAt,
    })),
    interests: activeInterests.map((i) => ({
      id: i.id,
      name: i.product.name,
      slug: i.product.slug,
      available: i.product.isPublished && i.product.status === ProductStatus.available,
      createdAt: i.createdAt,
    })),
    recentEmail,
    indicators: buildCustomerSupportIndicators(indicatorInput, customer.id),
  }
}

export type AdminCustomerDetail = NonNullable<Awaited<ReturnType<typeof getAdminCustomerDetail>>>
