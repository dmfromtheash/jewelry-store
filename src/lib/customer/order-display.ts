/**
 * AURELIA — Customer-facing order display labels (Этап 47A)
 *
 * Pure, dependency-light Ukrainian labels for the customer account order history.
 * The admin labels (src/lib/admin/orders.ts) are Russian + server-only; the
 * storefront is Ukrainian, so the customer view gets its own small map. Only a
 * TYPE import from Prisma (erased at runtime), so it is safe to import anywhere.
 */

import type { OrderStatus } from '@prisma/client'

/** Ukrainian, customer-facing order status labels. */
export const CUSTOMER_ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Чернетка',
  submitted: 'Оформлено',
  processing: 'В обробці',
  completed: 'Виконано',
  cancelled: 'Скасовано',
}

export function customerOrderStatusLabel(status: OrderStatus): string {
  return CUSTOMER_ORDER_STATUS_LABELS[status] ?? String(status)
}
