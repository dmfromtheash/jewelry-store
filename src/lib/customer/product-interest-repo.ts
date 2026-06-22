/**
 * AURELIA — Product-interest data layer (Этап 69A) — NO real notifications
 *
 * Server-only Prisma reads/writes for a logged-in customer's product interests
 * (model CustomerProductInterest — "повідомити, коли буде доступно"). HARD-SCOPED by
 * `customerId` everywhere. NOTHING is emailed and NO notification fires: this only records
 * interest so the owner can act manually. The admin sees COUNTS, never contact details.
 *
 * Resolution is by SLUG → a real PUBLISHED product server-side (never an arbitrary id), so a
 * hidden/unknown product can't be tracked. "Add" is idempotent via the (customerId, productId,
 * type) unique key and reactivates a previously cancelled interest.
 */

import 'server-only'

import { CustomerInterestStatus, CustomerInterestType, ProductStatus } from '@prisma/client'
import { prisma } from '../db/prisma'

/** Latin storefront slug guard (matches the /product/[slug] route shape). */
const SLUG_RE = /^[a-z0-9-]{1,128}$/i

function isValidSlug(slug: unknown): slug is string {
  return typeof slug === 'string' && SLUG_RE.test(slug)
}

/** Resolves a slug to a PUBLISHED product id, or null (hidden/unknown/invalid). */
async function resolvePublishedProductId(slug: string): Promise<string | null> {
  if (!isValidSlug(slug)) return null
  const row = await prisma.product.findFirst({
    where: { slug, isPublished: true },
    select: { id: true },
  })
  return row?.id ?? null
}

/**
 * Registers (or reactivates) the customer's interest in a product (by slug). Idempotent:
 * a second add of the same (customer, product, type) just keeps a single ACTIVE row. Returns
 * false when the slug is invalid or resolves to no published product. NO email/notification.
 */
export async function addProductInterestBySlug(
  customerId: string,
  slug: string,
  type: CustomerInterestType = CustomerInterestType.back_in_stock,
): Promise<boolean> {
  if (!customerId) return false
  const productId = await resolvePublishedProductId(slug)
  if (!productId) return false
  await prisma.customerProductInterest.upsert({
    where: { customerId_productId_type: { customerId, productId, type } },
    create: { customerId, productId, type, status: CustomerInterestStatus.active },
    // Reactivate a previously cancelled/fulfilled interest; no-op for an already-active one.
    update: { status: CustomerInterestStatus.active, fulfilledAt: null },
  })
  return true
}

/** Cancels ONE interest by id, scoped to the owner. Safe no-op if absent/not theirs. */
export async function cancelProductInterest(customerId: string, id: string): Promise<boolean> {
  if (!customerId || !id) return false
  const res = await prisma.customerProductInterest.updateMany({
    where: { id, customerId, status: CustomerInterestStatus.active },
    data: { status: CustomerInterestStatus.cancelled },
  })
  return res.count > 0
}

/** Count of ACTIVE interests for one customer. */
export async function countActiveInterests(customerId: string): Promise<number> {
  if (!customerId) return 0
  return prisma.customerProductInterest.count({
    where: { customerId, status: CustomerInterestStatus.active },
  })
}

export interface ActiveInterestItem {
  id: string
  type: CustomerInterestType
  createdAt: Date
  productName: string
  productSlug: string
  /** Whether the product is now purchasable (in active sale) — drives an honest label. */
  available: boolean
}

/**
 * The customer's ACTIVE interests (published products only), newest first. Includes the
 * product's current availability so the account page can honestly show "вже в продажу".
 */
export async function listActiveInterests(customerId: string): Promise<ActiveInterestItem[]> {
  if (!customerId) return []
  const rows = await prisma.customerProductInterest.findMany({
    where: {
      customerId,
      status: CustomerInterestStatus.active,
      product: { isPublished: true },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      type: true,
      createdAt: true,
      product: { select: { name: true, slug: true, status: true, price: true, stockQuantity: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    createdAt: r.createdAt,
    productName: r.product.name,
    productSlug: r.product.slug,
    available:
      r.product.status === ProductStatus.available &&
      r.product.price != null &&
      r.product.stockQuantity !== 0,
  }))
}
