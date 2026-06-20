/**
 * AURELIA — Customer data layer (Этап 47A)
 *
 * Server-only Prisma reads/writes for storefront customer accounts. No raw SQL,
 * no deletes. The password hash is read ONLY for credential verification (login)
 * and is never selected into anything client-facing. Order history is always
 * scoped by `customerId`, so one customer can never read another's orders.
 */

import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'

/** Safe public projection — NEVER includes passwordHash. */
const PUBLIC_CUSTOMER_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  createdAt: true,
} as const

export type PublicCustomer = Prisma.CustomerGetPayload<{ select: typeof PUBLIC_CUSTOMER_SELECT }>

/** Thrown by createCustomer when the email is already registered. */
export class DuplicateEmailError extends Error {
  constructor() {
    super('duplicate_email')
    this.name = 'DuplicateEmailError'
  }
}

/**
 * Creates a customer. `email` must be pre-normalised and `passwordHash` already
 * hashed (never a plaintext password). Throws DuplicateEmailError on the unique
 * constraint so the caller returns a generic message.
 */
export async function createCustomer(input: {
  email: string
  passwordHash: string
  name: string | null
  phone: string | null
}): Promise<PublicCustomer> {
  try {
    return await prisma.customer.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        phone: input.phone,
      },
      select: PUBLIC_CUSTOMER_SELECT,
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new DuplicateEmailError()
    }
    throw e
  }
}

/**
 * Reads the credential row for login: id + passwordHash ONLY. The hash never
 * leaves the server boundary (only verifyPassword consumes it). Returns null
 * when no account exists for the (normalised) email.
 */
export async function findCustomerCredentials(
  email: string,
): Promise<{ id: string; passwordHash: string } | null> {
  return prisma.customer.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  })
}

/** Reads the safe public profile by id. Null when the customer no longer exists. */
export async function getCustomerById(id: string): Promise<PublicCustomer | null> {
  if (!id) return null
  return prisma.customer.findUnique({
    where: { id },
    select: PUBLIC_CUSTOMER_SELECT,
  })
}

/**
 * Updates the editable profile fields (name/phone only — Этап 47B). Email and the
 * password hash are NEVER touched here. Returns the safe public projection. The
 * caller must have validated/normalised the values (null clears the field).
 */
export async function updateCustomerProfile(
  id: string,
  data: { name: string | null; phone: string | null },
): Promise<PublicCustomer> {
  return prisma.customer.update({
    where: { id },
    data: { name: data.name, phone: data.phone },
    select: PUBLIC_CUSTOMER_SELECT,
  })
}

/**
 * Reads ONLY the password hash for a known, already-authenticated customer id
 * (Этап 47B password change). The hash never leaves the server boundary — only
 * verifyPassword consumes it. Null when the customer no longer exists.
 */
export async function getCustomerCredentialsById(
  id: string,
): Promise<{ passwordHash: string } | null> {
  if (!id) return null
  return prisma.customer.findUnique({
    where: { id },
    select: { passwordHash: true },
  })
}

/** Replaces the stored password hash (Этап 47B). `passwordHash` is already hashed. */
export async function updateCustomerPassword(id: string, passwordHash: string): Promise<void> {
  await prisma.customer.update({ where: { id }, data: { passwordHash } })
}

/**
 * Order history for ONE customer, newest first. Hard-scoped by `customerId`, so
 * it can only ever return that customer's own orders. No PII beyond what the
 * customer already owns; amounts in minor units (formatted by the caller).
 */
export async function getCustomerOrders(customerId: string) {
  if (!customerId) return []
  return prisma.order.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      orderCode: true,
      status: true,
      deliveryMethod: true,
      paymentMethod: true,
      totalAmount: true,
      currency: true,
      createdAt: true,
      _count: { select: { items: true } },
    },
  })
}

export type CustomerOrderListItem = Awaited<ReturnType<typeof getCustomerOrders>>[number]

/** Customer-facing order detail projection (Этап 47B). Only the customer's OWN
 *  snapshot data — no admin-only fields, no audit/internal columns. */
const CUSTOMER_ORDER_DETAIL_SELECT = {
  orderCode: true,
  status: true,
  deliveryCity: true,
  deliveryMethod: true,
  deliveryDetails: true,
  paymentMethod: true,
  subtotalAmount: true,
  totalAmount: true,
  currency: true,
  createdAt: true,
  items: {
    select: {
      productName: true,
      productSku: true,
      variantValue: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
} as const

export type CustomerOrderDetail = Prisma.OrderGetPayload<{ select: typeof CUSTOMER_ORDER_DETAIL_SELECT }>

/**
 * Loads ONE order by its code, HARD-SCOPED to the owning customer (Этап 47B).
 * The `customerId` is part of the WHERE, so a customer can only ever read their
 * OWN order — another customer's code (or a guest order's code) resolves to null,
 * which the page turns into notFound(). There is no order-lookup-by-code that is
 * not scoped to the authenticated owner.
 */
export async function getCustomerOrderByCode(
  customerId: string,
  orderCode: string,
): Promise<CustomerOrderDetail | null> {
  if (!customerId || !orderCode) return null
  return prisma.order.findFirst({
    where: { orderCode, customerId },
    select: CUSTOMER_ORDER_DETAIL_SELECT,
  })
}
