'use server'

/**
 * AURELIA — Admin order server actions (Этап 17A)
 *
 * Status-change action for the local admin order screens. Re-checks the local
 * admin guard (so it can't be POSTed in production), validates the target
 * status against the enum, updates ONLY the status, and revalidates the admin
 * pages. No deletes, no price/item edits, no payment.
 */

import { revalidatePath } from 'next/cache'
import { ensureLocalAdmin } from './guard'
import { isOrderStatus, updateAdminOrderStatus } from './orders'

export async function updateOrderStatusAction(formData: FormData) {
  await ensureLocalAdmin()

  const orderCode = String(formData.get('orderCode') ?? '').trim()
  const status = String(formData.get('status') ?? '').trim()

  if (!orderCode || !isOrderStatus(status)) return

  await updateAdminOrderStatus(orderCode, status)

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderCode}`)
}
