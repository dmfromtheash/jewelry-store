/**
 * AURELIA — Customer account-token data primitives (Этап 60A)
 *
 * DB operations for the single-use password-reset / email-verification tokens, over an
 * INJECTABLE Prisma client (PrismaClient | TransactionClient) — the same pattern as
 * src/lib/customer/rate-limit.ts. Keeping it importable (NOT `server-only`) lets the
 * verify script exercise the real SQL inside an always-rolled-back transaction, while
 * the 'use server' recovery actions call it with the live `prisma` client.
 *
 * Security/privacy by construction:
 *   - ONLY a token hash is ever written/looked up — the raw token never reaches the DB.
 *   - `createAccountToken` returns the RAW token to its caller exactly once (for the
 *     email link); it is never persisted in raw form.
 *   - `consumeAccountToken` is single-use: it stamps `usedAt` and refuses an already
 *     used/expired token, so a token cannot be replayed.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import {
  ACCOUNT_TOKEN_PURPOSES,
  generateRawToken,
  hashToken,
  isTokenLive,
  tokenExpiry,
  type AccountTokenPurpose,
} from './account-token'

export { ACCOUNT_TOKEN_PURPOSES, type AccountTokenPurpose } from './account-token'

/** A Prisma client OR an interactive-transaction client — so verify can inject a tx. */
export type AccountTokenClient = PrismaClient | Prisma.TransactionClient

/**
 * Issues a fresh token for a customer + purpose. Persists ONLY the hash + expiry and
 * returns the RAW token once (the caller puts it in the email link — which, with no
 * provider, is never actually delivered today). Best practice is one live token per
 * purpose, so any existing UNUSED tokens for the same (customer, purpose) are first
 * invalidated (marked used) — a new request supersedes an old link.
 */
export async function createAccountToken(
  client: AccountTokenClient,
  customerId: string,
  purpose: AccountTokenPurpose,
): Promise<{ rawToken: string; expiresAt: Date }> {
  // Supersede any still-live tokens of this purpose for the customer.
  await client.customerAccountToken.updateMany({
    where: { customerId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  })

  const rawToken = generateRawToken()
  const expiresAt = tokenExpiry()
  await client.customerAccountToken.create({
    data: { customerId, purpose, tokenHash: hashToken(rawToken), expiresAt },
    select: { id: true },
  })
  return { rawToken, expiresAt }
}

/**
 * Looks up a LIVE token (correct purpose, not used, not expired) by its raw value and,
 * if valid, atomically marks it used and returns the owning customerId. Returns null for
 * an unknown / wrong-purpose / expired / already-used token. Single-use: the conditional
 * `updateMany(where usedAt:null)` guarantees only the first consumption wins even under a
 * race (a second call updates 0 rows → null).
 */
export async function consumeAccountToken(
  client: AccountTokenClient,
  rawToken: string,
  purpose: AccountTokenPurpose,
  now: Date = new Date(),
): Promise<{ customerId: string } | null> {
  if (!rawToken) return null
  const row = await client.customerAccountToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, customerId: true, purpose: true, usedAt: true, expiresAt: true },
  })
  if (!row || row.purpose !== purpose) return null
  if (!isTokenLive({ usedAt: row.usedAt, expiresAt: row.expiresAt }, now)) return null

  // Atomic single-use claim: only succeeds while still unused.
  const claimed = await client.customerAccountToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: now },
  })
  if (claimed.count !== 1) return null
  return { customerId: row.customerId }
}

/** Marks an email verified for a customer (idempotent: keeps the first verified time). */
export async function markEmailVerified(
  client: AccountTokenClient,
  customerId: string,
  now: Date = new Date(),
): Promise<void> {
  await client.customer.updateMany({
    where: { id: customerId, emailVerifiedAt: null },
    data: { emailVerifiedAt: now },
  })
}

/**
 * Safe aggregate counts of account tokens by purpose + state — for the admin view.
 * Returns COUNTS ONLY (never token hashes or values). "live" = unused and unexpired.
 */
export async function getAccountTokenStats(client: AccountTokenClient, now: Date = new Date()) {
  const purposes = [
    ACCOUNT_TOKEN_PURPOSES.passwordReset,
    ACCOUNT_TOKEN_PURPOSES.emailVerification,
  ] as const

  const stats = await Promise.all(
    purposes.map(async (purpose) => {
      const [total, used, live] = await Promise.all([
        client.customerAccountToken.count({ where: { purpose } }),
        client.customerAccountToken.count({ where: { purpose, usedAt: { not: null } } }),
        client.customerAccountToken.count({
          where: { purpose, usedAt: null, expiresAt: { gt: now } },
        }),
      ])
      return { purpose, total, used, live, expired: total - used - live }
    }),
  )
  return stats
}

export type AccountTokenStats = Awaited<ReturnType<typeof getAccountTokenStats>>
