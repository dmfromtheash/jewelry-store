/**
 * AURELIA — Customer account-recovery token crypto (Этап 60A)
 *
 * Pure crypto for the short-lived, single-use password-reset / email-verification
 * tokens. The RAW token is what would go into an email link (it is returned to the
 * caller once, at creation); ONLY its sha256 hash is ever persisted (see
 * ./account-token-repo + the CustomerAccountToken model). So a leaked DB row can never
 * be replayed, and the raw token is never logged, stored, or shown anywhere.
 *
 * Pure crypto only (no `server-only`, no Prisma, no cookies) so the verify script can
 * unit-test it directly — mirrors ./password and ./token.
 *
 * FOUNDATION: no email provider is configured, so the raw token is never actually
 * delivered to a real inbox today. The flow is provider-ready; delivery is owner-gated.
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto'

/** Token validity window. Short by design (single-use, recovery-grade). */
export const ACCOUNT_TOKEN_TTL_MINUTES = 45
export const ACCOUNT_TOKEN_TTL_MS = ACCOUNT_TOKEN_TTL_MINUTES * 60 * 1000

/** Stable purpose ids — mirror the Prisma `CustomerTokenPurpose` enum. */
export const ACCOUNT_TOKEN_PURPOSES = {
  passwordReset: 'password_reset',
  emailVerification: 'email_verification',
} as const

export type AccountTokenPurpose =
  (typeof ACCOUNT_TOKEN_PURPOSES)[keyof typeof ACCOUNT_TOKEN_PURPOSES]

/** 32 random bytes → URL-safe string. ~256 bits of entropy; unguessable. */
export function generateRawToken(): string {
  return randomBytes(32).toString('base64url')
}

/** sha256 of the raw token, hex. This is the ONLY form that is ever persisted. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

/** Constant-time compare of two token hashes (defensive; lookups are by unique hash). */
export function tokenHashesEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** The expiry instant for a token created now (or at `from`). */
export function tokenExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + ACCOUNT_TOKEN_TTL_MS)
}

/** True when the token is still usable: not consumed AND not past expiry. */
export function isTokenLive(token: { usedAt: Date | null; expiresAt: Date }, now: Date = new Date()): boolean {
  if (token.usedAt !== null) return false
  return token.expiresAt.getTime() > now.getTime()
}
