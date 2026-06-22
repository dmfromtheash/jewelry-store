/**
 * AURELIA — Customer account dashboard data layer (Этап 69A)
 *
 * Server-only aggregator for the /account overview. Batches the customer's OWN safe data
 * (orders / wishlist / review-status counts / saved searches / active product interests) into
 * one fixed set of round-trips and derives the non-financial engagement label. Everything is
 * HARD-SCOPED by `customerId` (re-derived from the verified session by the caller), so a
 * customer can only ever see their own account. No secrets, hashes, tokens, or other
 * customers' data are ever touched here.
 */

import 'server-only'

import { ReviewStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { getCustomerOrders, type CustomerOrderListItem } from './repo'
import { getWishlistProducts } from './wishlist-repo'
import { listSavedSearches, type SavedSearchListItem } from './saved-search-repo'
import { listActiveInterests, type ActiveInterestItem } from './product-interest-repo'
import { computeEngagement, type Engagement } from './engagement'
import type { Product } from '../catalog/types'

const RECENT_ORDERS = 4
const RECENT_WISHLIST = 4

export interface AccountReviewCounts {
  pending: number
  approved: number
  rejected: number
  total: number
}

export interface AccountDashboard {
  orders: { total: number; recent: CustomerOrderListItem[] }
  wishlist: { total: number; recent: Product[] }
  reviews: AccountReviewCounts
  savedSearches: SavedSearchListItem[]
  interests: ActiveInterestItem[]
  engagement: Engagement
}

export async function getAccountDashboard(customerId: string): Promise<AccountDashboard> {
  const [orders, wishlist, reviewGroups, savedSearches, interests] = await Promise.all([
    getCustomerOrders(customerId),
    getWishlistProducts(customerId),
    prisma.productReview.groupBy({
      by: ['status'],
      where: { customerId },
      _count: { _all: true },
    }),
    listSavedSearches(customerId),
    listActiveInterests(customerId),
  ])

  const reviewCount = (s: ReviewStatus) => reviewGroups.find((g) => g.status === s)?._count._all ?? 0
  const reviews: AccountReviewCounts = {
    pending: reviewCount(ReviewStatus.pending),
    approved: reviewCount(ReviewStatus.approved),
    rejected: reviewCount(ReviewStatus.rejected),
    total: reviewGroups.reduce((n, g) => n + g._count._all, 0),
  }

  const engagement = computeEngagement({
    orders: orders.length,
    reviews: reviews.total,
    wishlist: wishlist.length,
    savedSearches: savedSearches.length,
    activeInterests: interests.length,
  })

  return {
    orders: { total: orders.length, recent: orders.slice(0, RECENT_ORDERS) },
    wishlist: { total: wishlist.length, recent: wishlist.slice(0, RECENT_WISHLIST) },
    reviews,
    savedSearches,
    interests,
    engagement,
  }
}
