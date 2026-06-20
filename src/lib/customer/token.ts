/**
 * AURELIA — Customer session token (Этап 47A)
 *
 * Tamper-resistant `<payload>.<hmac>` session token for the storefront customer
 * session, mirroring the admin pattern (src/lib/admin/auth.ts) but with a
 * SEPARATE signing key so an admin token can never validate as a customer token
 * (and vice-versa). The subject is the Customer.id.
 *
 * Pure crypto + env read only (no `server-only`, no cookies, no Prisma) so the
 * create/verify functions are unit-testable in the verify script. Cookie I/O and
 * the DB lookup live in ./session.
 *
 * Signing key resolution (no `.env` change required):
 *   1. CUSTOMER_SESSION_SECRET when set (>= 32 chars) — preferred, fully separate.
 *   2. else derived from ADMIN_SESSION_SECRET via a fixed, labelled HMAC, so the
 *      customer key is cryptographically distinct from the admin key even when
 *      only ADMIN_SESSION_SECRET is configured. Fails closed when neither exists.
 */

import { createHmac, timingSafeEqual } from 'crypto'

export const CUSTOMER_SESSION_COOKIE = 'au_customer_session'

export const CUSTOMER_SESSION_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
const MIN_SECRET_LENGTH = 32
const DERIVE_LABEL = 'aurelia.customer.session.v1'

/** Thrown when neither a customer nor an admin secret is configured. */
export class CustomerAuthConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CustomerAuthConfigError'
  }
}

export interface CustomerSession {
  /** Customer id (subject). */
  sub: string
  /** Issued-at (unix seconds). */
  iat: number
  /** Expiry (unix seconds). */
  exp: number
}

/**
 * Resolves the customer session signing key. Returns null (NOT throws) when
 * unconfigured so read paths (getCurrentCustomer) can fail closed silently;
 * write paths translate null into a config error.
 */
export function resolveCustomerSessionSecret(): string | null {
  const direct = process.env.CUSTOMER_SESSION_SECRET ?? ''
  if (direct && direct.length >= MIN_SECRET_LENGTH) return direct

  const admin = process.env.ADMIN_SESSION_SECRET ?? ''
  if (admin && admin.length >= MIN_SECRET_LENGTH) {
    // Derive a distinct customer key from the admin secret via a labelled HMAC.
    return createHmac('sha256', admin).update(DERIVE_LABEL).digest('hex')
  }
  return null
}

/** Like resolveCustomerSessionSecret but throws a safe config error when unset. */
export function requireCustomerSessionSecret(): string {
  const secret = resolveCustomerSessionSecret()
  if (!secret) {
    throw new CustomerAuthConfigError(
      'Customer auth is not configured: set CUSTOMER_SESSION_SECRET (or ADMIN_SESSION_SECRET) to at least 32 characters.',
    )
  }
  return secret
}

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url')
}

/** Builds a signed `<payload>.<hmac>` token for the given customer id. */
export function createCustomerToken(customerId: string, secret: string): string {
  const now = Math.floor(Date.now() / 1000)
  const payload: CustomerSession = {
    sub: customerId,
    iat: now,
    exp: now + CUSTOMER_SESSION_TTL_SECONDS,
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return `${body}.${sign(body, secret)}`
}

/** Verifies signature + expiry; returns the session or null. Never throws. */
export function verifyCustomerToken(token: string, secret: string): CustomerSession | null {
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
    typeof (payload as CustomerSession).sub !== 'string' ||
    typeof (payload as CustomerSession).exp !== 'number' ||
    typeof (payload as CustomerSession).iat !== 'number'
  ) {
    return null
  }

  const session = payload as CustomerSession
  if (!session.sub) return null
  if (session.exp <= Math.floor(Date.now() / 1000)) return null
  return session
}
