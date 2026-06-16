'use server'

/**
 * AURELIA — Admin order server actions (Этап 17A; auth added 18A)
 *
 * Status-change action for the local admin order screens. Re-checks the local
 * admin guard (so it can't be POSTed in production) AND requires a valid admin
 * session (an unauthenticated POST is redirected to login, never mutating),
 * validates the target status against the enum, updates ONLY the status, and
 * revalidates the admin pages. No deletes, no price/item edits, no payment.
 */

import { revalidatePath } from 'next/cache'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import {
  getAdminOrderStatus,
  isOrderStatus,
  ORDER_STATUS_LABELS,
  updateAdminOrderStatus,
} from './orders'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'

export async function updateOrderStatusAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const orderCode = String(formData.get('orderCode') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()

  if (!orderCode || !isOrderStatus(status)) return

  // Capture the prior status (for the transition summary) before updating.
  const previous = await getAdminOrderStatus(orderCode)
  await updateAdminOrderStatus(orderCode, status)

  // Audit the change: order code + status transition only — no customer PII.
  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.orderStatusChanged,
    entityType: 'order',
    entityId: orderCode,
    summary: `Статус заказа ${orderCode}: ${
      previous ? ORDER_STATUS_LABELS[previous] : '—'
    } → ${ORDER_STATUS_LABELS[status]}.`,
    metadata: { from: previous, to: status },
  })

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderCode}`)
}
