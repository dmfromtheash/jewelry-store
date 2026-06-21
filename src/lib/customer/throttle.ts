/**
 * AURELIA — Customer auth throttle (Этап 49A)
 *
 * Dependency-free, in-memory, per-process best-effort rate limiter shared by the
 * customer auth server actions. It is a local/MVP speed-bump, NOT durable infra:
 *
 *   - State lives in module memory, so it is PER-PROCESS and fails OPEN on server
 *     restart / dev HMR — a legitimate customer can never be permanently locked out.
 *   - It does NOT coordinate across instances. A public, multi-instance launch needs
 *     a shared store (Redis/DB); this file is the single place to swap that in.
 *   - Keys are opaque strings built by the caller: `scope:ip` for anonymous flows
 *     (login/register) and `scope:cust:<id>` for authenticated ones (password/profile).
 *     No PII, no secrets, no passwords are ever stored here — only counts + timestamps.
 *
 * Pure (string-keyed) so the buckets logic is unit-testable from the verify script
 * without a request context.
 */

export interface ThrottleRule {
  /** Rolling window length in milliseconds. */
  windowMs: number
  /** Max attempts within the window before `isThrottled` returns true. */
  max: number
}

/**
 * Per-scope limits. Anonymous credential flows (login/register) get the same budget
 * as the admin login (10 / 10 min). Authenticated flows are keyed per-customer:
 *   - password: a tight failure-lockout against current-password guessing;
 *   - profile:  a looser anti-spam rate-limit on profile saves.
 */
export const CUSTOMER_THROTTLE_RULES = {
  login: { windowMs: 10 * 60 * 1000, max: 10 },
  register: { windowMs: 10 * 60 * 1000, max: 10 },
  password: { windowMs: 10 * 60 * 1000, max: 8 },
  profile: { windowMs: 10 * 60 * 1000, max: 20 },
} as const

export type ThrottleScope = keyof typeof CUSTOMER_THROTTLE_RULES

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** True when the key has reached its attempt budget for the current window. */
export function isThrottled(key: string, rule: ThrottleRule): boolean {
  const bucket = buckets.get(key)
  if (!bucket) return false
  if (Date.now() > bucket.resetAt) {
    buckets.delete(key)
    return false
  }
  return bucket.count >= rule.max
}

/** Records one attempt for the key, starting/continuing its window. */
export function registerAttempt(key: string, rule: ThrottleRule): void {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
    return
  }
  bucket.count += 1
}

/** Clears the counter for the key (call on a successful, legitimate action). */
export function clearAttempts(key: string): void {
  buckets.delete(key)
}

/** Test-only: drops all buckets so verify runs are deterministic. */
export function _resetAllAttempts(): void {
  buckets.clear()
}
