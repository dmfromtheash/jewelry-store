/**
 * AURELIA — Prisma client singleton (Этап 15A)
 *
 * Safe PrismaClient instance for Next.js. In development the module is
 * re-evaluated on hot reload, which would otherwise spawn a new client (and a
 * new connection pool) on every change — so we cache it on `globalThis`.
 *
 * IMPORTANT (15A scope): this helper is NOT yet imported by any UI / route.
 * The storefront still reads the static mock catalog via src/lib/catalog/*.
 * It exists so later stages can adopt the DB without re-plumbing the client.
 */

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
