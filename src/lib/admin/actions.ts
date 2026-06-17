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
import {
  canTransitionOrderStatus,
  isSameOrderStatus,
} from '../orders/transitions'

export async function updateOrderStatusAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const orderCode = String(formData.get('orderCode') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()

  if (!orderCode || !isOrderStatus(status)) return

  // Capture the prior status (for the transition guard + summary) before updating.
  const previous = await getAdminOrderStatus(orderCode)

  // Unknown order: nothing to change (avoids a P2025 on a missing row).
  if (previous === null) return

  // Same status: idempotent no-op. Don't touch the row or pollute the audit log;
  // just re-render so the UI stays consistent.
  if (isSameOrderStatus(previous, status)) {
    revalidatePath('/admin/orders')
    revalidatePath(`/admin/orders/${orderCode}`)
    return
  }

  // Forbidden transition: never mutate. The admin <select> only offers allowed
  // targets, so this is a defensive guard against a hand-crafted POST. Safe
  // no-op + a PII-free warning (orderCode/statuses only — no customer data).
  if (!canTransitionOrderStatus(previous, status)) {
    console.warn(
      `[orders] blocked forbidden status transition ${previous} → ${status} for ${orderCode}`,
    )
    return
  }

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
