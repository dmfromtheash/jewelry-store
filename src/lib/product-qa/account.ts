/**
 * AURELIA — Customer account product-question reads (Этап 86A) — server-only
 *
 * Reads back the logged-in customer's OWN product questions (and any admin answer +
 * moderation status) for their account. HARD-SCOPED by `customerId`, so a customer can
 * only ever see their own questions.
 *
 * Privacy by construction: the select returns ONLY customer-appropriate fields plus the
 * related product's name/slug/published flag (so the row can link to the PDP when the
 * product is still public). It NEVER selects `answeredBy`, `emailHash`, `recipientEmail`,
 * or moderation internals. `spam` rows are filtered out (see ../customer/account-qa).
 * Guest submissions (customerId null) are excluded by the `where`.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { isProductQuestionVisibleToCustomer } from '../customer/account-qa'

export interface MyProductQuestion {
  id: string
  body: string
  status: string
  answer: string | null
  createdAt: Date
  answeredAt: Date | null
  productName: string
  productSlug: string
  /** Whether the related product is still published (drives whether we link to the PDP). */
  productPublished: boolean
}

/** The customer's OWN product questions (newest first), with `spam` rows removed. */
export async function listMyProductQuestions(customerId: string): Promise<MyProductQuestion[]> {
  if (!customerId) return []
  const rows = await prisma.productQuestion.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      body: true,
      status: true,
      answer: true,
      createdAt: true,
      answeredAt: true,
      product: { select: { name: true, slug: true, isPublished: true } },
    },
  })
  return rows
    .filter((r) => isProductQuestionVisibleToCustomer(r.status))
    .map((r) => ({
      id: r.id,
      body: r.body,
      status: r.status,
      answer: r.answer,
      createdAt: r.createdAt,
      answeredAt: r.answeredAt,
      productName: r.product.name,
      productSlug: r.product.slug,
      productPublished: r.product.isPublished,
    }))
}
