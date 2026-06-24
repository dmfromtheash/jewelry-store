/**
 * AURELIA — Admin Help-question data layer (Этап 79A) — server-only
 *
 * Prisma reads + status/answer updates for the local admin Help inbox. Privacy by
 * construction: the list NEVER returns the raw reply email — only an `emailMasked` partial
 * (e.g. "jo***@example.com") so a moderator can recognise a contact without the full address
 * being splashed across the UI. No password/token/cookie/secret is ever selected.
 */

import 'server-only'

import { HelpQuestionStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { maskEmail } from '../support/email-utils'
import { getHelpCategory } from '../help/content'

export const HELP_QUESTION_STATUSES = Object.values(HelpQuestionStatus) as HelpQuestionStatus[]

export const HELP_QUESTION_STATUS_LABELS: Record<HelpQuestionStatus, string> = {
  new: 'Новый',
  triaged: 'В работе',
  answered: 'Отвечен',
  published: 'Опубликован',
  archived: 'В архиве',
  spam: 'Спам',
  rejected: 'Отклонён',
}

export function isHelpQuestionStatus(value: string): value is HelpQuestionStatus {
  return (HELP_QUESTION_STATUSES as string[]).includes(value)
}

/** Count of Help questions still needing attention (status = new). */
export async function getOpenHelpQuestionCount(): Promise<number> {
  return prisma.helpQuestion.count({ where: { status: HelpQuestionStatus.new } })
}

export interface AdminHelpQuestionsQuery {
  status?: string
  category?: string
}

/** Recent Help questions for the admin list. New first by default (most actionable). */
export async function getAdminHelpQuestions(opts: AdminHelpQuestionsQuery = {}) {
  const where: { status?: HelpQuestionStatus; categorySlug?: string } = {}
  if (opts.status && isHelpQuestionStatus(opts.status)) where.status = opts.status as HelpQuestionStatus
  if (opts.category) where.categorySlug = opts.category

  const rows = await prisma.helpQuestion.findMany({
    where,
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      categorySlug: true,
      authorName: true,
      recipientEmail: true,
      subject: true,
      message: true,
      productRef: true,
      orderRef: true,
      status: true,
      answer: true,
      answeredBy: true,
      customerId: true,
      createdAt: true,
      answeredAt: true,
      publishedAt: true,
    },
  })

  // Map the raw email to a masked partial — the raw value never leaves this module.
  return rows.map(({ recipientEmail, categorySlug, ...rest }) => ({
    ...rest,
    categorySlug,
    categoryName: getHelpCategory(categorySlug)?.name ?? categorySlug,
    emailMasked: maskEmail(recipientEmail),
    hasEmail: !!recipientEmail,
  }))
}

export type AdminHelpQuestionItem = Awaited<ReturnType<typeof getAdminHelpQuestions>>[number]

/** Reads just the current status (for the audit summary / guards). */
export async function getHelpQuestionStatus(id: string): Promise<HelpQuestionStatus | null> {
  if (!id) return null
  const row = await prisma.helpQuestion.findUnique({ where: { id }, select: { status: true } })
  return row?.status ?? null
}
