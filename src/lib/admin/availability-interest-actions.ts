'use server'

/**
 * AURELIA — Admin availability-interest actions (Этап 79A) — NO real sending
 *
 * Cancel an interest, or "prepare" a NO-SEND back-in-stock notification. Same security as the
 * other admin actions: local guard + session, validated id, status-only updates, audit,
 * revalidate. "Prepare notification" records an EmailOutbox row through the existing no-send
 * pipeline — it terminates at `skipped_no_provider`, so NOTHING is ever emailed. No stock is
 * reserved or held at any point.
 */

import { revalidatePath } from 'next/cache'
import { AvailabilityInterestStatus } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { enqueueBackInStockNotification } from '../email/outbox'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import { AVAILABILITY_STATUS_LABELS, isAvailabilityStatus } from './availability-interests'

const PATH = '/admin/availability-interests'

/** Changes the interest status (e.g. → cancelled / pending_availability / queued_notification). */
export async function setAvailabilityStatusAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()
  if (!id || !isAvailabilityStatus(status)) return

  const row = await prisma.productAvailabilityInterest.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!row) return
  if (row.status === status) {
    revalidatePath(PATH)
    return
  }

  await prisma.productAvailabilityInterest.update({
    where: { id },
    data: { status: status as AvailabilityInterestStatus },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.availabilityStatusChanged,
    entityType: 'availability_interest',
    entityId: id,
    summary: `Ожидание наличия ${id}: ${AVAILABILITY_STATUS_LABELS[row.status]} → ${AVAILABILITY_STATUS_LABELS[status as AvailabilityInterestStatus]}.`,
    metadata: { from: row.status, to: status },
  })

  revalidatePath(PATH)
}

/**
 * Records a NO-SEND back-in-stock notification for one interest: marks it
 * `notification_prepared`, stamps `notifiedAt`, and enqueues a no-send outbox row (which
 * settles to `skipped_no_provider`). Nothing is delivered. Idempotent: a row already
 * prepared is left alone.
 */
export async function prepareAvailabilityNotificationAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return

  const row = await prisma.productAvailabilityInterest.findUnique({
    where: { id },
    select: {
      status: true,
      email: true,
      product: { select: { name: true } },
    },
  })
  if (!row) return
  if (row.status === AvailabilityInterestStatus.notification_prepared) {
    revalidatePath(PATH)
    return
  }

  await prisma.productAvailabilityInterest.update({
    where: { id },
    data: { status: AvailabilityInterestStatus.notification_prepared, notifiedAt: new Date() },
  })

  // Record the INTENT only — the no-send pipeline never contacts a mail server.
  await enqueueBackInStockNotification(id, row.product.name, row.email)

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.availabilityNotificationPrepared,
    entityType: 'availability_interest',
    entityId: id,
    summary: `Ожидание наличия ${id}: подготовлено уведомление (без отправки).`,
  })

  revalidatePath(PATH)
}
