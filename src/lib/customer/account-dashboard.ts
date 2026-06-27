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

import { prisma } from '../db/prisma'
import { getCustomerOrders, getCustomerReviews, type CustomerOrderListItem, type CustomerReviewItem } from './repo'
import { getWishlistProducts } from './wishlist-repo'
import { listSavedSearches, type SavedSearchListItem } from './saved-search-repo'
import { listActiveInterests, type ActiveInterestItem } from './product-interest-repo'
import { computeEngagement, type Engagement } from './engagement'
import { listMyHelpQuestions, type MyHelpQuestion } from '../help/question-account'
import { listMyProductQuestions, type MyProductQuestion } from '../product-qa/account'
import { listMyAvailabilityInterests, type MyAvailabilityInterest } from '../availability/account'
import {
  isHelpQuestionAnswered,
  isProductQuestionAnswered,
  isAvailabilityInterestOpen,
} from './account-qa'
import type { Product } from '../catalog/types'

const RECENT_ORDERS = 4
const RECENT_WISHLIST = 4

export interface AccountReviewCounts {
  pending: number
  approved: number
  rejected: number
  total: number
}

/** Derived Q&A summary for the overview cards (counts both Help + product questions). */
export interface AccountQuestionSummary {
  total: number
  answered: number
}

export interface AccountDashboard {
  orders: { total: number; recent: CustomerOrderListItem[]; all: CustomerOrderListItem[] }
  wishlist: { total: number; recent: Product[] }
  reviews: AccountReviewCounts
  reviewsList: CustomerReviewItem[]
  savedSearches: SavedSearchListItem[]
  interests: ActiveInterestItem[]
  /** Email-based availability interests (the PDP "Повідомити про наявність" list, Этап 86A). */
  availability: MyAvailabilityInterest[]
  /** The customer's OWN general Help questions (Этап 86A). */
  helpQuestions: MyHelpQuestion[]
  /** The customer's OWN product questions (Этап 86A). */
  productQuestions: MyProductQuestion[]
  questions: AccountQuestionSummary
  /** Unified "waiting" count: active login interests + open email availability interests. */
  waitingTotal: number
  engagement: Engagement
}

export async function getAccountDashboard(customerId: string): Promise<AccountDashboard> {
  const [
    orders,
    wishlist,
    reviewsList,
    reviewGroups,
    savedSearches,
    interests,
    availability,
    helpQuestions,
    productQuestions,
  ] = await Promise.all([
    getCustomerOrders(customerId),
    getWishlistProducts(customerId),
    getCustomerReviews(customerId),
    prisma.productReview.groupBy({
      by: ['status'],
      where: { customerId },
      _count: { _all: true },
    }),
    listSavedSearches(customerId),
    listActiveInterests(customerId),
    listMyAvailabilityInterests(customerId),
    listMyHelpQuestions(customerId),
    listMyProductQuestions(customerId),
  ])

  const reviewCount = (s: string) => reviewGroups.find((g) => g.status === s)?._count._all ?? 0
  const reviews: AccountReviewCounts = {
    pending: reviewCount('pending'),
    approved: reviewCount('approved'),
    rejected: reviewCount('rejected'),
    total: reviewGroups.reduce((n, g) => n + g._count._all, 0),
  }

  const answered =
    helpQuestions.filter((q) => isHelpQuestionAnswered(q.status)).length +
    productQuestions.filter((q) => isProductQuestionAnswered(q.status)).length
  const questions: AccountQuestionSummary = {
    total: helpQuestions.length + productQuestions.length,
    answered,
  }

  const openAvailability = availability.filter((a) => isAvailabilityInterestOpen(a.status)).length
  const waitingTotal = interests.length + openAvailability

  const engagement = computeEngagement({
    orders: orders.length,
    reviews: reviews.total,
    wishlist: wishlist.length,
    savedSearches: savedSearches.length,
    activeInterests: interests.length,
  })

  return {
    orders: { total: orders.length, recent: orders.slice(0, RECENT_ORDERS), all: orders },
    wishlist: { total: wishlist.length, recent: wishlist.slice(0, RECENT_WISHLIST) },
    reviews,
    reviewsList,
    savedSearches,
    interests,
    availability,
    helpQuestions,
    productQuestions,
    questions,
    waitingTotal,
    engagement,
  }
}
