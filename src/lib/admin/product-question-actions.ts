'use server'

/**
 * AURELIA — Admin product-question moderation actions (Этап 79A)
 *
 * Answer / change-status of a product question. Same security as the review/help actions:
 * local admin guard + session, validated inputs, status/answer-only updates, audit, revalidate.
 * No deletes. NO email is sent. A question becomes PUBLIC only when an admin sets it to
 * `published` (and it already carries an answer; the public read additionally requires that).
 */

import { revalidatePath } from 'next/cache'
import { ProductQuestionStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { hasUnsafeMarkup } from '../customer/validate'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import {
  getProductQuestionStatus,
  isProductQuestionStatus,
  PRODUCT_QUESTION_STATUS_LABELS,
} from './product-questions'

const ANSWER_MAX = 4000
const PATH = '/admin/product-questions'

export async function answerProductQuestionAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const answer = String(formData.get('answer') ?? '').trim()
  if (!id || answer.length < 2 || answer.length > ANSWER_MAX || hasUnsafeMarkup(answer)) return

  const previous = await getProductQuestionStatus(id)
  if (previous === null) return

  await prisma.productQuestion.update({
    where: { id },
    data: {
      answer,
      answeredBy: session.sub,
      answeredAt: new Date(),
      status: previous === ProductQuestionStatus.pending ? ProductQuestionStatus.answered : previous,
    },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productQuestionAnswered,
    entityType: 'product_question',
    entityId: id,
    summary: `Вопрос о товаре ${id}: добавлен ответ.`,
  })

  revalidatePath(PATH)
}

export async function setProductQuestionStatusAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!id || !isProductQuestionStatus(status)) return

  const previous = await getProductQuestionStatus(id)
  if (previous === null) return
  if (previous === status) {
    revalidatePath(PATH)
    return
  }

  // Guard: a question can only be published once it actually has an answer (public read also
  // requires this, but block it here so the status can't claim "published" with no answer).
  if (status === ProductQuestionStatus.published) {
    const row = await prisma.productQuestion.findUnique({ where: { id }, select: { answer: true } })
    if (!row?.answer) {
      revalidatePath(PATH)
      return
    }
  }

  await prisma.productQuestion.update({
    where: { id },
    data: {
      status: status as ProductQuestionStatus,
      ...(status === ProductQuestionStatus.published ? { publishedAt: new Date() } : {}),
    },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.productQuestionStatusChanged,
    entityType: 'product_question',
    entityId: id,
    summary: `Вопрос о товаре ${id}: ${PRODUCT_QUESTION_STATUS_LABELS[previous]} → ${PRODUCT_QUESTION_STATUS_LABELS[status as ProductQuestionStatus]}.`,
    metadata: { from: previous, to: status },
  })

  revalidatePath(PATH)
}
