/**
 * AURELIA — Saved-search data layer (Этап 69A)
 *
 * Server-only Prisma reads/writes for the logged-in customer's saved catalog searches
 * (model CustomerSavedSearch). EVERY function is HARD-SCOPED by `customerId` (the caller
 * passes the id it re-derived from the verified session), so one customer can never read or
 * alter another's saved searches. Only pre-validated fields (src/lib/customer/saved-search.ts)
 * are ever written — never a raw URL or markup.
 *
 * `import 'server-only'` keeps Prisma out of any client bundle.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import {
  SAVED_SEARCH_MAX_PER_CUSTOMER,
  type NormalizedSavedSearch,
} from './saved-search'

const SAVED_SEARCH_SELECT = {
  id: true,
  label: true,
  query: true,
  categorySlug: true,
  sort: true,
  statusFilter: true,
  minPrice: true,
  maxPrice: true,
  material: true,
  createdAt: true,
} as const

/** The customer's saved searches, newest first. Scoped by customerId. */
export async function listSavedSearches(customerId: string) {
  if (!customerId) return []
  return prisma.customerSavedSearch.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: SAVED_SEARCH_MAX_PER_CUSTOMER,
    select: SAVED_SEARCH_SELECT,
  })
}

export type SavedSearchListItem = Awaited<ReturnType<typeof listSavedSearches>>[number]

/** Count of saved searches for one customer. */
export async function countSavedSearches(customerId: string): Promise<number> {
  if (!customerId) return 0
  return prisma.customerSavedSearch.count({ where: { customerId } })
}

export type CreateSavedSearchResult = 'created' | 'limit_reached'

/**
 * Creates a saved search for the customer from PRE-VALIDATED fields. Enforces the per-customer
 * cap so the list can't grow unbounded. Returns 'limit_reached' (no write) when the cap is hit.
 */
export async function createSavedSearch(
  customerId: string,
  value: NormalizedSavedSearch,
): Promise<CreateSavedSearchResult> {
  if (!customerId) return 'limit_reached'
  const existing = await prisma.customerSavedSearch.count({ where: { customerId } })
  if (existing >= SAVED_SEARCH_MAX_PER_CUSTOMER) return 'limit_reached'

  await prisma.customerSavedSearch.create({
    data: {
      customerId,
      label: value.label,
      query: value.query,
      categorySlug: value.categorySlug,
      sort: value.sort,
      statusFilter: value.statusFilter,
      minPrice: value.minPrice,
      maxPrice: value.maxPrice,
      material: value.material,
    },
  })
  return 'created'
}

/** Removes ONE saved search by id, scoped to the owner. Safe no-op if absent/not theirs. */
export async function removeSavedSearch(customerId: string, id: string): Promise<boolean> {
  if (!customerId || !id) return false
  // deleteMany with BOTH id AND customerId → a customer can only ever delete their own row.
  const res = await prisma.customerSavedSearch.deleteMany({ where: { id, customerId } })
  return res.count > 0
}
