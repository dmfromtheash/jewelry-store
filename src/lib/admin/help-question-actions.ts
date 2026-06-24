'use server'

/**
 * AURELIA — Admin Help-question moderation actions (Этап 79A)
 *
 * Answer / change-status of a Help question from the local admin inbox. Mirrors the review
 * action's security: re-checks the local admin guard (can't be POSTed in production), requires
 * a valid admin session, validates inputs, updates only the answer/status fields, audits the
 * change (no PII — question id + safe status), and revalidates the admin page. No deletes.
 * NO email is sent (answering is manual; the customer is never auto-notified).
 */

import { revalidatePath } from 'next/cache'
import { HelpQuestionStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { hasUnsafeMarkup } from '../customer/validate'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import {
  getHelpQuestionStatus,
  isHelpQuestionStatus,
  HELP_QUESTION_STATUS_LABELS,
} from './help-questions'

const ANSWER_MAX = 4000
const PATH = '/admin/help/questions'

/** Stores an admin answer and moves the question to `answered` (when still new/triaged). */
export async function answerHelpQuestionAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const answer = String(formData.get('answer') ?? '').trim()
  if (!id || answer.length < 2 || answer.length > ANSWER_MAX || hasUnsafeMarkup(answer)) return

  const previous = await getHelpQuestionStatus(id)
  if (previous === null) return

  await prisma.helpQuestion.update({
    where: { id },
    data: {
      answer,
      answeredBy: session.sub,
      answeredAt: new Date(),
      // Advance to `answered` only from an early state; never downgrade a published one.
      status:
        previous === HelpQuestionStatus.new || previous === HelpQuestionStatus.triaged
          ? HelpQuestionStatus.answered
          : previous,
    },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.helpQuestionAnswered,
    entityType: 'help_question',
    entityId: id,
    summary: `Вопрос помощи ${id}: добавлен ответ.`,
  })

  revalidatePath(PATH)
}

/** Changes the moderation status (triaged/published/archived/rejected/spam). */
export async function setHelpQuestionStatusAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!id || !isHelpQuestionStatus(status)) return

  const previous = await getHelpQuestionStatus(id)
  if (previous === null) return
  if (previous === status) {
    revalidatePath(PATH)
    return
  }

  await prisma.helpQuestion.update({
    where: { id },
    data: {
      status: status as HelpQuestionStatus,
      // Stamp publishedAt the first time it becomes public.
      ...(status === HelpQuestionStatus.published ? { publishedAt: new Date() } : {}),
    },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.helpQuestionStatusChanged,
    entityType: 'help_question',
    entityId: id,
    summary: `Вопрос помощи ${id}: ${HELP_QUESTION_STATUS_LABELS[previous]} → ${HELP_QUESTION_STATUS_LABELS[status as HelpQuestionStatus]}.`,
    metadata: { from: previous, to: status },
  })

  revalidatePath(PATH)
}
