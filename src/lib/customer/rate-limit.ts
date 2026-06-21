/**
 * AURELIA — Durable customer-auth rate limiter (Этап 51A)
 *
 * Replaces the 49A in-memory-ONLY throttle with a DB-backed fixed-window counter
 * (table `CustomerAuthThrottle`) so attempt budgets SURVIVE a server restart / HMR —
 * the readiness step needed for a single-instance public demo. The pure in-memory
 * store (./throttle) is kept as a fallback (see "Backend selection" below).
 *
 * Clean abstraction: callers use `isThrottled` / `registerAttempt` / `clearAttempts`
 * and never see the backend. A future shared-store limiter (Redis/Postgres advisory
 * locks for multi-instance) can replace the `db*` functions here without touching the
 * server actions or the audit wiring.
 *
 * Privacy: the limiter is keyed by an opaque string (`<scope>:<identifier>`) that the
 * caller builds — `scope:ip` for anonymous flows, `scope:cust:<id>` for authenticated
 * ones. Before anything is persisted the WHOLE key is sha256-hashed into `keyHash`, so
 * the raw IP / customer id never reaches the table. No password, cookie, token, secret,
 * header, or email is ever stored.
 *
 * NOT `server-only`: this module is pure logic over an injectable Prisma client (it is
 * imported only by the 'use server' actions and the verify script, never by a client
 * bundle). Keeping it importable lets the verify script exercise the real SQL inside a
 * rolled-back transaction — the same reason ./audit-actions is split out from ./audit.
 */

import { createHash } from 'crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '../db/prisma'
import {
  type ThrottleRule,
  isThrottled as memIsThrottled,
  registerAttempt as memRegisterAttempt,
  clearAttempts as memClearAttempts,
} from './throttle'

export { CUSTOMER_THROTTLE_RULES, type ThrottleRule, type ThrottleScope } from './throttle'

/** A Prisma client OR an interactive-transaction client — so verify can inject a tx. */
export type ThrottleClient = PrismaClient | Prisma.TransactionClient

/** Expired rows older than this past their reset are eligible for opportunistic GC. */
const CLEANUP_GRACE_MS = 60 * 60 * 1000 // 1h
/** Probability that a registerAttempt also sweeps expired rows (bounds table size,
 *  no cron needed). */
const CLEANUP_SAMPLE_RATE = 0.05

/** Folds the opaque key into a digest — the raw IP / customer id is never stored. */
function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

/** Derives the safe machine scope label from the key (the part before the first ':'). */
function scopeOf(key: string): string {
  const i = key.indexOf(':')
  return i === -1 ? key : key.slice(0, i)
}

// --- DB-backed primitives (deterministic; injectable client for verify) ------------

/** True when the key has reached its budget for the CURRENT (unexpired) window.
 *  Read-only: an expired window reads as "not throttled" but is not mutated here. */
export async function dbIsThrottled(
  client: ThrottleClient,
  key: string,
  rule: ThrottleRule,
): Promise<boolean> {
  const row = await client.customerAuthThrottle.findUnique({
    where: { keyHash: hashKey(key) },
    select: { count: true, resetAt: true },
  })
  if (!row) return false
  if (row.resetAt.getTime() <= Date.now()) return false // window lapsed
  return row.count >= rule.max
}

/** Records one attempt: opens a fresh window when missing/expired, else increments. */
export async function dbRegisterAttempt(
  client: ThrottleClient,
  key: string,
  rule: ThrottleRule,
): Promise<void> {
  const keyHash = hashKey(key)
  const now = Date.now()
  const existing = await client.customerAuthThrottle.findUnique({
    where: { keyHash },
    select: { resetAt: true },
  })

  if (!existing || existing.resetAt.getTime() <= now) {
    const windowStart = new Date(now)
    const resetAt = new Date(now + rule.windowMs)
    await client.customerAuthThrottle.upsert({
      where: { keyHash },
      create: { keyHash, scope: scopeOf(key), count: 1, windowStart, resetAt },
      update: { count: 1, windowStart, resetAt, scope: scopeOf(key) },
    })
    return
  }

  await client.customerAuthThrottle.update({
    where: { keyHash },
    data: { count: { increment: 1 } },
  })
}

/** Clears the counter for the key (call on a successful, legitimate action). */
export async function dbClearAttempts(client: ThrottleClient, key: string): Promise<void> {
  // deleteMany (not delete) so a missing row is a no-op rather than throwing.
  await client.customerAuthThrottle.deleteMany({ where: { keyHash: hashKey(key) } })
}

/** Best-effort GC of long-expired rows. Safe to call opportunistically. */
export async function cleanupExpiredThrottles(client: ThrottleClient = prisma): Promise<number> {
  const cutoff = new Date(Date.now() - CLEANUP_GRACE_MS)
  const { count } = await client.customerAuthThrottle.deleteMany({
    where: { resetAt: { lt: cutoff } },
  })
  return count
}

// --- Public facade: durable when the DB is healthy, in-memory fallback otherwise -----
// Auth must never break because the limiter's own storage hiccuped, so a DB error here
// fails over to the per-process in-memory store (49A behaviour) instead of throwing.
// When the DB is healthy — the normal case — the durable counter is authoritative and
// survives restarts.

export async function isThrottled(key: string, rule: ThrottleRule): Promise<boolean> {
  try {
    return await dbIsThrottled(prisma, key, rule)
  } catch (e) {
    console.error('[rate-limit] DB read failed, using in-memory fallback:', e instanceof Error ? e.message : 'unknown')
    return memIsThrottled(key, rule)
  }
}

export async function registerAttempt(key: string, rule: ThrottleRule): Promise<void> {
  try {
    await dbRegisterAttempt(prisma, key, rule)
    if (Math.random() < CLEANUP_SAMPLE_RATE) {
      // Fire-and-forget sweep; never let cleanup failure affect the request.
      cleanupExpiredThrottles().catch(() => {})
    }
  } catch (e) {
    console.error('[rate-limit] DB write failed, using in-memory fallback:', e instanceof Error ? e.message : 'unknown')
    memRegisterAttempt(key, rule)
  }
}

export async function clearAttempts(key: string): Promise<void> {
  try {
    await dbClearAttempts(prisma, key)
  } catch (e) {
    console.error('[rate-limit] DB clear failed, using in-memory fallback:', e instanceof Error ? e.message : 'unknown')
    memClearAttempts(key)
  }
}
