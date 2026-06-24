/**
 * AURELIA — Support email utilities (Этап 79A)
 *
 * Pure, dependency-light helpers shared by the Help question / product Q&A /
 * availability-interest flows. NO Prisma, NO React, NO provider — safe to import from
 * server actions and verify scripts alike (the only import is Node's `crypto`, erased
 * from any client bundle because these modules are used server-side only).
 *
 * Privacy by construction:
 *   - `hashEmail` folds a NORMALISED email into a sha256 digest used for dedupe/abuse
 *     keys, so a raw address never has to be compared/stored to deduplicate.
 *   - `maskEmail` produces an admin-safe partial (`jo***@example.com`) so a moderator can
 *     recognise a contact without the full address being splashed across the UI/logs.
 */

import { createHash } from 'crypto'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const SUPPORT_EMAIL_MAX = 160

/** Lowercases + trims an email (same normalisation as the auth layer). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** True when the value is a plausibly-formatted, length-capped email. */
export function isValidEmail(email: string): boolean {
  const e = normalizeEmail(email)
  return e.length > 0 && e.length <= SUPPORT_EMAIL_MAX && EMAIL_RE.test(e)
}

/** sha256 of the normalised email — opaque dedupe/abuse key; the raw email is never the key. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(normalizeEmail(email)).digest('hex')
}

/**
 * Admin-safe partial email, e.g. "jo***@example.com" / "a***@x.io". Never returns the
 * full local part. Returns an empty string for a missing/blank value so callers can render
 * a neutral placeholder.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return ''
  const e = normalizeEmail(email)
  const at = e.indexOf('@')
  if (at <= 0) return '***'
  const local = e.slice(0, at)
  const domain = e.slice(at + 1)
  const head = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${head}***@${domain}`
}
