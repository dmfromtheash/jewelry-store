/**
 * AURELIA — Admin product-question data layer (Этап 79A) — server-only
 *
 * Prisma reads + answer/status updates for the local admin product-Q&A moderation screen.
 * Public PDP shows only `published` questions that carry an answer. The list NEVER returns the
 * raw reply email — only a masked partial. No password/token/cookie/secret is ever selected.
 */

import 'server-only'

import { ProductQuestionStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { maskEmail } from '../support/email-utils'

export const PRODUCT_QUESTION_STATUSES = Object.values(ProductQuestionStatus) as ProductQuestionStatus[]

export const PRODUCT_QUESTION_STATUS_LABELS: Record<ProductQuestionStatus, string> = {
  pending: 'На модерации',
  answered: 'Отвечен',
  published: 'Опубликован',
  rejected: 'Отклонён',
  archived: 'В архиве',
  spam: 'Спам',
}

export function isProductQuestionStatus(value: string): value is ProductQuestionStatus {
  return (PRODUCT_QUESTION_STATUSES as string[]).includes(value)
}

/** Count of product questions still awaiting moderation (status = pending). */
export async function getPendingProductQuestionCount(): Promise<number> {
  return prisma.productQuestion.count({ where: { status: ProductQuestionStatus.pending } })
}

export interface AdminProductQuestionsQuery {
  status?: string
}

/** Recent product questions for the admin list. Pending first by default. */
export async function getAdminProductQuestions(opts: AdminProductQuestionsQuery = {}) {
  const where =
    opts.status && isProductQuestionStatus(opts.status)
      ? { status: opts.status as ProductQuestionStatus }
      : {}

  const rows = await prisma.productQuestion.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      authorName: true,
      recipientEmail: true,
      body: true,
      answer: true,
      answeredBy: true,
      status: true,
      isDemo: true,
      customerId: true,
      createdAt: true,
      answeredAt: true,
      publishedAt: true,
      product: { select: { name: true, slug: true } },
    },
  })

  return rows.map(({ recipientEmail, ...rest }) => ({
    ...rest,
    emailMasked: maskEmail(recipientEmail),
    hasEmail: !!recipientEmail,
  }))
}

export type AdminProductQuestionItem = Awaited<ReturnType<typeof getAdminProductQuestions>>[number]

export async function getProductQuestionStatus(id: string): Promise<ProductQuestionStatus | null> {
  if (!id) return null
  const row = await prisma.productQuestion.findUnique({ where: { id }, select: { status: true } })
  return row?.status ?? null
}
