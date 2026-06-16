/**
 * AURELIA — Admin auth/session helpers (Этап 18A)
 *
 * Real local/dev admin authentication for /admin/*. Identity comes from env
 * (ADMIN_USERNAME / ADMIN_PASSWORD); the session is a tamper-resistant,
 * httpOnly cookie signed with HMAC-SHA256 using ADMIN_SESSION_SECRET. No new
 * dependency — Node's built-in `crypto` does the signing.
 *
 * This layers ON TOP of the local-only gate in ./guard (ensureLocalAdmin),
 * which still hard-blocks production / non-localhost. Credentials and the secret
 * are NEVER hardcoded, logged, or returned to the client.
 */

import 'server-only'

import { createHmac, timingSafeEqual } from 'crypto'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const ADMIN_SESSION_COOKIE = 'au_admin_session'

const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours
const MIN_SECRET_LENGTH = 32

/** Thrown when the admin auth env vars are missing/invalid (no values leaked). */
export class AdminAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminAuthConfigError'
  }
}

export interface AdminSession {
  /** Admin username (subject). */
  sub: string
  /** Issued-at (unix seconds). */
  iat: number
  /** Expiry (unix seconds). */
  exp: number
}

interface AdminAuthConfig {
  username: string
  password: string
  secret: string
}

/**
 * Reads + validates admin auth config from env. Throws AdminAuthConfigError
 * (with a safe, value-free message) when unconfigured — callers fail closed.
 */
function readAdminAuthConfig(): AdminAuthConfig {
  const username = process.env.ADMIN_USERNAME ?? ''
  const password = process.env.ADMIN_PASSWORD ?? ''
  const secret = process.env.ADMIN_SESSION_SECRET ?? ''

  if (!username || !password || !secret) {
    throw new AdminAuthConfigError(
      'Admin auth is not configured: set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET (see .env.example).',
    )
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new AdminAuthConfigError(
      `Admin auth is misconfigured: ADMIN_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
    )
  }
  return { username, password, secret }
}

/** Constant-time string equality (length mismatch fails without an early-exit leak). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

/** Builds a signed `<payload>.<hmac>` session token. */
function createToken(sub: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: AdminSession = { sub, iat: now, exp: now + SESSION_TTL_SECONDS }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body, secret)}`
}

/** Verifies signature + expiry; returns the session or null. Never throws. */
function verifyToken(token: string, secret: string): AdminSession | null {
  const dot = token.indexOf('.')
  if (dot <= 0 || dot === token.length - 1) return null

  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body, secret)

  const sigBuf = Buffer.from(sig, 'utf8')
  const expBuf = Buffer.from(expected, 'utf8')
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) return null

  let payload: unknown
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (
    typeof payload !== 'object' ||
    payload === null ||
    typeof (payload as AdminSession).sub !== 'string' ||
    typeof (payload as AdminSession).exp !== 'number' ||
    typeof (payload as AdminSession).iat !== 'number'
  ) {
    return null
  }

  const session = payload as AdminSession
  if (session.exp <= Math.floor(Date.now() / 1000)) return null
  return session
}

/**
 * Checks supplied credentials against env. Returns false on mismatch and throws
 * AdminAuthConfigError when auth is unconfigured. Both fields are always
 * compared (no short-circuit) to reduce timing signal.
 */
export function verifyAdminCredentials(username: string, password: string): boolean {
  const cfg = readAdminAuthConfig()
  const userOk = safeEqual(username, cfg.username)
  const passOk = safeEqual(password, cfg.password)
  return userOk && passOk
}

/** Reads + verifies the current admin session cookie. Null when absent/invalid/unconfigured. */
export async function getAdminSession(): Promise<AdminSession | null> {
  let secret: string
  try {
    secret = readAdminAuthConfig().secret
  } catch {
    return null // fail closed — unconfigured means no valid session
  }

  const value = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value
  if (!value) return null
  return verifyToken(value, secret)
}

/** Requires a valid admin session; redirects to /admin/login otherwise. */
export async function requireAdminSession(): Promise<AdminSession> {
  const session = await getAdminSession()
  if (!session) redirect('/admin/login')
  return session
}

/** Issues a fresh signed session cookie (call only from a server action / route handler). */
export async function startAdminSession(username: string): Promise<void> {
  const { secret } = readAdminAuthConfig()
  const token = createToken(username, secret)
  ;(await cookies()).set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: SESSION_TTL_SECONDS,
  })
}

/** Clears the session cookie (call only from a server action / route handler). */
export async function endAdminSession(): Promise<void> {
  ;(await cookies()).set(ADMIN_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
    maxAge: 0,
  })
}

// --- Login throttle (best-effort, in-memory) ---------------------------------
// A dependency-free brute-force speed-bump for the local admin login. State lives
// in module memory: it is per-process and fails OPEN on server restart / dev HMR,
// so it can never permanently lock out the legitimate single admin. This is
// defense-in-depth on top of the local-only guard (ensureLocalAdmin) — durable,
// per-account rate limiting belongs with the future AdminUser/DB model.

const LOGIN_WINDOW_MS = 10 * 60 * 1000 // rolling 10-minute window
const LOGIN_MAX_FAILURES = 10 // failed attempts per window before lockout

interface LoginAttemptBucket {
  count: number
  resetAt: number
}

const loginAttempts = new Map<string, LoginAttemptBucket>()

/** Derives a coarse client key for throttling (proxy IP if present, else local). */
export async function getLoginClientKey(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim()
  return ip || 'local'
}

/** True when the key has exhausted its failed-attempt budget for the window. */
export function isLoginThrottled(key: string): boolean {
  const bucket = loginAttempts.get(key)
  if (!bucket) return false
  if (Date.now() > bucket.resetAt) {
    loginAttempts.delete(key)
    return false
  }
  return bucket.count >= LOGIN_MAX_FAILURES
}

/** Records a failed login attempt for the key (starts/continues the window). */
export function registerFailedLogin(key: string): void {
  const now = Date.now()
  const bucket = loginAttempts.get(key)
  if (!bucket || now > bucket.resetAt) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return
  }
  bucket.count += 1
}

/** Clears the failed-attempt counter for the key (call on successful login). */
export function clearLoginThrottle(key: string): void {
  loginAttempts.delete(key)
}

/**
 * Sanitizes a post-login redirect target: only internal `/admin/*` paths (never
 * the login page itself, never protocol-relative/external). Prevents open
 * redirects and login loops.
 */
export function sanitizeNextPath(next: string | undefined | null): string {
  const fallback = '/admin/dashboard'
  if (!next) return fallback
  if (!next.startsWith('/admin/')) return fallback
  if (next.startsWith('//')) return fallback
  if (next.startsWith('/admin/login')) return fallback
  return next
}
