/**
 * AURELIA — Customer session helpers (Этап 47A)
 *
 * Server-only cookie I/O for the storefront customer session, layered on the
 * pure token logic in ./token. The session cookie is:
 *   - a SEPARATE name from the admin cookie (CUSTOMER_SESSION_COOKIE);
 *   - httpOnly (never readable by client JS);
 *   - sameSite=lax;
 *   - secure in production;
 *   - HMAC-signed with a customer-specific key (see ./token).
 *
 * `getCurrentCustomer` validates the cookie AND confirms the customer still
 * exists in the DB before returning the safe public projection — so a stale
 * token for a deleted account resolves to "logged out". Only safe display fields
 * (id/email/name/phone/createdAt) are ever returned; the password hash is never
 * loaded here.
 */

import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import {
  CUSTOMER_SESSION_COOKIE,
  CUSTOMER_SESSION_TTL_SECONDS,
  createCustomerToken,
  requireCustomerSessionSecret,
  resolveCustomerSessionSecret,
  verifyCustomerToken,
} from './token'
import { getCustomerById, type PublicCustomer } from './repo'

// Site-wide path so both the storefront (Header/account/checkout) and any future
// surface can see the session. Start and end MUST use the same path.
const SESSION_COOKIE_PATH = '/'

/** Issues a fresh signed session cookie. Call only from a server action / route. */
export async function startCustomerSession(customerId: string): Promise<void> {
  const secret = requireCustomerSessionSecret()
  const token = createCustomerToken(customerId, secret)
  ;(await cookies()).set(CUSTOMER_SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: SESSION_COOKIE_PATH,
    maxAge: CUSTOMER_SESSION_TTL_SECONDS,
  })
}

/** Clears the session cookie. Call only from a server action / route handler. */
export async function endCustomerSession(): Promise<void> {
  ;(await cookies()).set(CUSTOMER_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: SESSION_COOKIE_PATH,
    maxAge: 0,
  })
}

/**
 * Reads + verifies the current customer session and confirms the account still
 * exists. Returns the safe public customer, or null when there is no valid
 * session (absent/invalid/expired cookie, unconfigured secret, or deleted
 * account). Never throws — read paths fail closed to "logged out".
 */
export async function getCurrentCustomer(): Promise<PublicCustomer | null> {
  const secret = resolveCustomerSessionSecret()
  if (!secret) return null

  const value = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value
  if (!value) return null

  const session = verifyCustomerToken(value, secret)
  if (!session) return null

  // Confirm the account still exists (defends against stale tokens after delete).
  return getCustomerById(session.sub)
}

/**
 * Account-page guard: returns the current customer or redirects to `next` when
 * not logged in. Storefront customer auth is modal-based (no dedicated login
 * route), so by default we bounce to the home page; the account page itself also
 * renders an in-page login prompt for the not-logged-in case when it chooses not
 * to redirect.
 */
export async function requireCustomer(redirectTo = '/'): Promise<PublicCustomer> {
  const customer = await getCurrentCustomer()
  if (!customer) redirect(redirectTo)
  return customer
}
