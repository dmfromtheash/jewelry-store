/**
 * AURELIA — Admin dashboard data layer (Этап 24A)
 *
 * Server-only Prisma reads for the /admin/dashboard overview. Everything here is
 * REAL data from PostgreSQL — no fake/demo/random metrics. Only counts /
 * aggregates / minimal recent lists; never selects PII, raw payloads, or secrets.
 *
 * Money is stored in integer MINOR units (kopecks). Totals are returned in minor
 * units; the page formats them via the shared formatPrice (which expects major
 * units), consistent with the admin orders screens.
 */

import 'server-only'

import { OrderStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { getRecentAuditEvents } from './audit'

/** A single status bucket of the orders breakdown. */
export interface OrderStatusBucket {
  status: OrderStatus
  count: number
  /** Sum of totalAmount for this status, in MINOR units (kopecks). */
  totalMinor: number
}

/** Recent analytics row — safe-by-construction subset (no payload/session/PII). */
export interface RecentAnalyticsRow {
  id: string
  createdAt: Date
  eventName: string
  pagePath: string | null
  deviceType: string | null
  referrerDomain: string | null
}

export async function getAdminDashboardData() {
  const [
    orderGroups,
    productCount,
    categoryCount,
    analyticsCount,
    auditCount,
    recentAudit,
    recentAnalytics,
  ] = await Promise.all([
    // One pass over orders: per-status count + summed total (minor units).
    prisma.order.groupBy({
      by: ['status'],
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
    prisma.product.count(),
    prisma.category.count(),
    prisma.analyticsEvent.count(),
    prisma.adminAuditLog.count(),
    getRecentAuditEvents(8),
    prisma.analyticsEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      // Safe subset only — never payload, anonymousSessionId, or loose ids.
      select: {
        id: true,
        createdAt: true,
        eventName: true,
        pagePath: true,
        deviceType: true,
        referrerDomain: true,
      },
    }),
  ])

  // Normalise the orders breakdown so every known status is present (zero-safe).
  const byStatus = new Map<OrderStatus, OrderStatusBucket>()
  for (const status of Object.values(OrderStatus)) {
    byStatus.set(status, { status, count: 0, totalMinor: 0 })
  }
  for (const g of orderGroups) {
    byStatus.set(g.status, {
      status: g.status,
      count: g._count._all,
      totalMinor: g._sum.totalAmount ?? 0,
    })
  }
  const statusBuckets = Array.from(byStatus.values())

  const totalOrders = statusBuckets.reduce((n, b) => n + b.count, 0)
  const draft = byStatus.get(OrderStatus.draft)!
  // Этап 27D — orders still awaiting owner action (new checkout orders are
  // `submitted`). Derived from the same single groupBy — no extra query.
  const needsAttention = byStatus.get(OrderStatus.submitted)!.count
  // Useful, honest total: value of everything that is not cancelled.
  const activeOrderValueMinor = statusBuckets
    .filter((b) => b.status !== OrderStatus.cancelled)
    .reduce((n, b) => n + b.totalMinor, 0)

  return {
    orders: {
      total: totalOrders,
      needsAttention,
      draftCount: draft.count,
      draftValueMinor: draft.totalMinor,
      activeValueMinor: activeOrderValueMinor,
      byStatus: statusBuckets,
    },
    catalog: {
      products: productCount,
      categories: categoryCount,
    },
    activity: {
      analyticsEvents: analyticsCount,
      auditEvents: auditCount,
    },
    recentAudit,
    recentAnalytics: recentAnalytics as RecentAnalyticsRow[],
  }
}

export type AdminDashboardData = Awaited<ReturnType<typeof getAdminDashboardData>>
