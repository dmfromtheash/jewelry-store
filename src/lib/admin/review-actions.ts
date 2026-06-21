'use server'

/**
 * AURELIA — Admin review moderation actions (Этап 59A)
 *
 * Approve / reject a pending review from the local admin moderation screen. Mirrors
 * the order-status action's security: re-checks the local admin guard (so it can't
 * be POSTed in production), requires a valid admin session (an unauthenticated POST
 * redirects to login, never mutating), validates the target status, updates ONLY the
 * status (never the body), audits the change (no PII — review id + product slug), and
 * revalidates the admin pages. No deletes.
 */

import { revalidatePath } from 'next/cache'
import { ReviewStatus } from '@prisma/client'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import {
  getAdminReviewStatus,
  isReviewStatus,
  REVIEW_STATUS_LABELS,
  setAdminReviewStatus,
} from './reviews'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'

async function moderate(formData: FormData, status: ReviewStatus) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id || !isReviewStatus(status)) return

  const previous = await getAdminReviewStatus(id)
  if (previous === null) return // unknown review — nothing to change
  if (previous === status) {
    revalidatePath('/admin/reviews')
    return // idempotent no-op; don't pollute the audit log
  }

  await setAdminReviewStatus(id, status)

  await recordAuditEvent({
    actor: session.sub,
    action: status === ReviewStatus.approved ? AUDIT_ACTIONS.reviewApproved : AUDIT_ACTIONS.reviewRejected,
    entityType: 'review',
    entityId: id,
    summary: `Отзыв ${id}: ${REVIEW_STATUS_LABELS[previous]} → ${REVIEW_STATUS_LABELS[status]}.`,
    metadata: { from: previous, to: status },
  })

  revalidatePath('/admin/reviews')
}

export async function approveReviewAction(formData: FormData) {
  await moderate(formData, ReviewStatus.approved)
}

export async function rejectReviewAction(formData: FormData) {
  await moderate(formData, ReviewStatus.rejected)
}
