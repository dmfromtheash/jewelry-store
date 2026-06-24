/**
 * AURELIA — Product Q&A server reads (Этап 79A)
 *
 * DB-backed PUBLIC reads for the PDP question section. Public by construction: only
 * `published` questions that carry an answer, on a `published` product, are ever returned —
 * so a pending/rejected/unanswered question (or a question on a hidden product) is never
 * visible. `import 'server-only'` keeps Prisma out of the client bundle.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import type { PublicProductQuestion } from './types'

const PUBLISHED = 'published' as const

/**
 * Published, answered questions for a product, newest first, resolved by SLUG. A hidden or
 * unknown product resolves to no questions. Demo/sample questions are included but carry the
 * `isDemo` flag so the UI can label them honestly.
 */
export async function getPublishedQuestionsBySlug(
  slug: string,
  take = 20,
): Promise<PublicProductQuestion[]> {
  if (!slug) return []
  const rows = await prisma.productQuestion.findMany({
    where: {
      status: PUBLISHED,
      answer: { not: null },
      product: { slug, isPublished: true },
    },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      authorName: true,
      body: true,
      answer: true,
      createdAt: true,
      answeredAt: true,
      isDemo: true,
    },
  })
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    body: r.body,
    answer: r.answer ?? '',
    createdAt: r.createdAt.toISOString(),
    answeredAt: r.answeredAt ? r.answeredAt.toISOString() : null,
    isDemo: r.isDemo,
  }))
}
