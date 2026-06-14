/**
 * AURELIA — Order read helpers (Этап 16A)
 *
 * Server-only read for the checkout success page. Intentionally does NOT select
 * customer contact fields (name/phone/email): the order code is shown in a URL,
 * so we never expose PII through it — only the order summary.
 */

import 'server-only'

import { prisma } from '../db/prisma'

export async function getOrderSummaryByCode(orderCode: string) {
  if (!orderCode) return null
  return prisma.order.findUnique({
    where: { orderCode },
    select: {
      orderCode: true,
      status: true,
      currency: true,
      subtotalAmount: true,
      totalAmount: true,
      createdAt: true,
      items: {
        select: { productName: true, quantity: true, unitPrice: true, lineTotal: true },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

export type OrderSummary = NonNullable<Awaited<ReturnType<typeof getOrderSummaryByCode>>>
