/**
 * AURELIA — Admin order data layer (Этап 17A)
 *
 * Server-only Prisma reads/updates for the local admin order screens. No raw
 * SQL, no deletes — orders are only listed, read, and have their `status`
 * changed. PII (customer name/phone/email) is selected only for the detail read,
 * which is rendered behind the local admin guard.
 */

import 'server-only'

import { OrderStatus, Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'

export const ORDER_STATUSES = Object.values(OrderStatus) as OrderStatus[]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: 'Черновик',
  submitted: 'Оформлен',
  cancelled: 'Отменён',
}

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as string[]).includes(value)
}

/**
 * Этап 27D — "needs attention" inbox status. Every storefront order is created
 * as `submitted` (see createOrderDraft), so that is the status the owner must
 * still act on. An order leaves the inbox as soon as its status changes (today
 * the only move from `submitted` is → `cancelled`; a dedicated "fulfilled"
 * status is a future lifecycle stage — see docs/ORDER_LIFECYCLE_SPEC.md §5).
 * No schema/enum change: this is purely a read over the existing status.
 */
export const NEEDS_ATTENTION_STATUS: OrderStatus = OrderStatus.submitted

/** Count of orders still awaiting owner action (status = submitted). */
export async function getNeedsAttentionOrderCount(): Promise<number> {
  return prisma.order.count({ where: { status: NEEDS_ATTENTION_STATUS } })
}

export interface AdminOrdersQuery {
  status?: string
  query?: string
}

export async function getAdminOrders(opts: AdminOrdersQuery = {}) {
  const where: Prisma.OrderWhereInput = {}

  if (opts.status && isOrderStatus(opts.status)) {
    where.status = opts.status
  }

  const q = opts.query?.trim()
  if (q) {
    where.OR = [
      { orderCode: { contains: q, mode: 'insensitive' } },
      { customerName: { contains: q, mode: 'insensitive' } },
      { customerPhone: { contains: q, mode: 'insensitive' } },
    ]
  }

  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      orderCode: true,
      status: true,
      customerName: true,
      deliveryCity: true,
      deliveryMethod: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  })
}

export async function getAdminOrderByCode(orderCode: string) {
  if (!orderCode) return null
  return prisma.order.findUnique({
    where: { orderCode },
    select: {
      orderCode: true,
      status: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      deliveryCity: true,
      deliveryMethod: true,
      deliveryDetails: true,
      paymentMethod: true,
      subtotalAmount: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      updatedAt: true,
      items: {
        select: {
          productName: true,
          productSlug: true,
          productSku: true,
          unitPrice: true,
          quantity: true,
          lineTotal: true,
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  })
}

/** Reads just the current status (for audit transition logging). No PII. */
export async function getAdminOrderStatus(orderCode: string): Promise<OrderStatus | null> {
  if (!orderCode) return null
  const row = await prisma.order.findUnique({
    where: { orderCode },
    select: { status: true },
  })
  return row?.status ?? null
}

/** Updates ONLY the status. Never touches items, prices, or contact data. */
export async function updateAdminOrderStatus(orderCode: string, status: OrderStatus) {
  return prisma.order.update({
    where: { orderCode },
    data: { status },
    select: { orderCode: true, status: true },
  })
}

export type AdminOrderListItem = Awaited<ReturnType<typeof getAdminOrders>>[number]
export type AdminOrderDetail = NonNullable<Awaited<ReturnType<typeof getAdminOrderByCode>>>
