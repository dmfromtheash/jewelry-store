/**
 * AURELIA — Customer engagement label (Этап 69A) — NON-FINANCIAL, informational only
 *
 * Pure, dependency-free helper that derives a simple engagement TIER + display label from
 * a customer's already-safe activity counts (orders / reviews / wishlist / saved searches /
 * active product interests). No Prisma, no `server-only`, no React — so the SAME logic is
 * shared by the account page, the admin support view, and the verify script (under tsx).
 *
 * IMPORTANT — this is a NON-financial engagement label, NOT a loyalty programme:
 *   - it carries NO points, cashback, store credit, balance, or tier-based pricing;
 *   - it NEVER changes an order total, a price, or a discount, and is NOT connected to the
 *     promo engine in any way;
 *   - it is purely an informational badge ("Новий / Активний / Постійний покупець").
 * Changing the thresholds here can never affect money — only which label is shown.
 */

export type EngagementTier = 'new' | 'active' | 'loyal'

/** Safe activity counts — all non-negative integers, never money. */
export interface EngagementCounts {
  orders: number
  reviews: number
  wishlist: number
  savedSearches: number
  activeInterests: number
}

/** Customer-facing Ukrainian labels (storefront /account). */
export const ENGAGEMENT_LABELS_UA: Record<EngagementTier, string> = {
  new: 'Новий покупець',
  active: 'Активний покупець',
  loyal: 'Постійний покупець',
}

/** Admin-facing Russian labels (admin support view). Same tier, localised. */
export const ENGAGEMENT_LABELS_RU: Record<EngagementTier, string> = {
  new: 'Новый покупатель',
  active: 'Активный покупатель',
  loyal: 'Постоянный покупатель',
}

/** Orders at/above this count → "loyal" (a repeat buyer). */
export const LOYAL_MIN_ORDERS = 3
/** Any single order, OR this much non-order engagement → "active". */
export const ACTIVE_MIN_ORDERS = 1
export const ACTIVE_MIN_ENGAGEMENT = 3

function clampCount(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export interface Engagement {
  tier: EngagementTier
  labelUa: string
  labelRu: string
  /** The normalised counts used for the decision (defensive, never negative). */
  counts: EngagementCounts
}

/**
 * Derives the engagement tier (pure, deterministic). Repeat buyers (≥ LOYAL_MIN_ORDERS
 * orders) are "loyal"; anyone with ≥1 order OR enough non-order engagement (reviews +
 * wishlist + saved searches + active interests ≥ ACTIVE_MIN_ENGAGEMENT) is "active";
 * everyone else is "new". No monetary input, no monetary effect.
 */
export function computeEngagement(raw: Partial<EngagementCounts>): Engagement {
  const counts: EngagementCounts = {
    orders: clampCount(raw.orders),
    reviews: clampCount(raw.reviews),
    wishlist: clampCount(raw.wishlist),
    savedSearches: clampCount(raw.savedSearches),
    activeInterests: clampCount(raw.activeInterests),
  }

  const nonOrderEngagement =
    counts.reviews + counts.wishlist + counts.savedSearches + counts.activeInterests

  let tier: EngagementTier
  if (counts.orders >= LOYAL_MIN_ORDERS) tier = 'loyal'
  else if (counts.orders >= ACTIVE_MIN_ORDERS || nonOrderEngagement >= ACTIVE_MIN_ENGAGEMENT) {
    tier = 'active'
  } else tier = 'new'

  return { tier, labelUa: ENGAGEMENT_LABELS_UA[tier], labelRu: ENGAGEMENT_LABELS_RU[tier], counts }
}
