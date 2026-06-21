'use server'

/**
 * AURELIA — Customer auth server actions (Этап 47A; abuse protection + audit 49A)
 *
 * register / login / logout / profile / password for storefront customers. Called
 * from the auth modals + account UI (client) and return a typed result rendered
 * inline. Security:
 *   - passwords hashed with scrypt (never stored/logged in plaintext);
 *   - email normalised + validated; generic errors (no account-existence leak);
 *   - separate httpOnly customer session cookie issued on success;
 *   - a DURABLE DB-backed throttle (src/lib/customer/rate-limit.ts, Этап 51A) slows
 *     credential stuffing on the anonymous flows (login/register, keyed by IP) and
 *     current-password guessing / profile spam on the authenticated flows (keyed by
 *     customer id). Counts survive a restart; it fails over to in-memory if the DB
 *     hiccups — see that module's notes;
 *   - every auth/security event is recorded to the admin audit log (49A) with NO
 *     PII/secret payload — see src/lib/customer/audit.ts.
 * Customers are completely separate from the admin identity and can NEVER access
 * /admin.
 */

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { hashPassword, verifyPassword } from './password'
import {
  createCustomer,
  DuplicateEmailError,
  findCustomerCredentials,
  getCustomerCredentialsById,
  updateCustomerPasswordAndBumpVersion,
  updateCustomerProfile,
} from './repo'
import { getCurrentCustomer, startCustomerSession, endCustomerSession } from './session'
import { CustomerAuthConfigError } from './token'
import {
  CUSTOMER_THROTTLE_RULES,
  clearAttempts,
  isThrottled,
  registerAttempt,
  type ThrottleScope,
} from './rate-limit'
import {
  auditCustomerAuthThrottled,
  auditCustomerLoginFailure,
  auditCustomerLoginSuccess,
  auditCustomerLogout,
  auditCustomerPasswordChanged,
  auditCustomerProfileUpdated,
  auditCustomerRegisterFailure,
  auditCustomerRegisterSuccess,
} from './audit'
import {
  validateLoginInput,
  validatePasswordChangeInput,
  validateProfileInput,
  validateRegisterInput,
  type CustomerFieldErrors,
  type PasswordChangeFieldErrors,
  type ProfileFieldErrors,
} from './validate'

export type CustomerAuthResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: CustomerFieldErrors }

export type CustomerProfileResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: ProfileFieldErrors }

export type CustomerPasswordResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: PasswordChangeFieldErrors }

const GENERIC_LOGIN_ERROR = 'Невірний e-mail або пароль.'
const CONFIG_ERROR = 'Вхід тимчасово недоступний. Спробуйте пізніше.'
const SERVER_ERROR = 'Сталася помилка. Спробуйте ще раз.'
const THROTTLED_ERROR = 'Забагато спроб. Зачекайте трохи й спробуйте знову.'
const NOT_LOGGED_IN_ERROR = 'Сесія завершилася. Увійдіть знову.'
const CURRENT_PASSWORD_WRONG = 'Поточний пароль невірний.'

// --- Throttle key helpers ---------------------------------------------------
// Anonymous flows (login/register) are keyed by a coarse client IP; authenticated
// flows (password/profile) are keyed by the customer id so one account's abuse can
// never lock out everyone behind a shared IP. See ./throttle for the limitations.

async function ipKey(scope: ThrottleScope): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `${scope}:${ip}`
}

function customerKey(scope: ThrottleScope, customerId: string): string {
  return `${scope}:cust:${customerId}`
}

export async function registerCustomerAction(input: {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
  phone?: string
}): Promise<CustomerAuthResult> {
  const key = await ipKey('register')
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.register)) {
    await auditCustomerAuthThrottled('register')
    return { ok: false, error: THROTTLED_ERROR }
  }

  const { errors, value } = validateRegisterInput(input)
  if (!value) {
    // Ordinary form typos count toward the budget but are NOT audited (noise).
    await registerAttempt(key, CUSTOMER_THROTTLE_RULES.register)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  try {
    const passwordHash = await hashPassword(value.password)
    const customer = await createCustomer({
      email: value.email,
      passwordHash,
      name: value.name,
      phone: value.phone,
    })
    await clearAttempts(key)
    await startCustomerSession(customer.id, customer.sessionVersion)
    await auditCustomerRegisterSuccess(customer.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof DuplicateEmailError) {
      // Generic-ish: tell them the email is taken (needed UX), but no other leak.
      await registerAttempt(key, CUSTOMER_THROTTLE_RULES.register)
      await auditCustomerRegisterFailure('duplicate_email')
      return { ok: false, error: 'Акаунт з таким e-mail вже існує.', fieldErrors: { email: ' ' } }
    }
    if (e instanceof CustomerAuthConfigError) return { ok: false, error: CONFIG_ERROR }
    console.error('registerCustomerAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

export async function loginCustomerAction(input: {
  email: string
  password: string
}): Promise<CustomerAuthResult> {
  const key = await ipKey('login')
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.login)) {
    await auditCustomerAuthThrottled('login')
    return { ok: false, error: THROTTLED_ERROR }
  }

  const { ok, email, password } = validateLoginInput(input)
  if (!ok) {
    await registerAttempt(key, CUSTOMER_THROTTLE_RULES.login)
    await auditCustomerLoginFailure()
    return { ok: false, error: GENERIC_LOGIN_ERROR }
  }

  try {
    const creds = await findCustomerCredentials(email)
    // Always run a hash verification to keep timing similar whether or not the
    // account exists (a fixed dummy hash when it does not).
    const stored =
      creds?.passwordHash ??
      'scrypt$32768$8$1$00000000000000000000000000000000$00'
    const passwordOk = await verifyPassword(password, stored)

    if (!creds || !passwordOk) {
      await registerAttempt(key, CUSTOMER_THROTTLE_RULES.login)
      await auditCustomerLoginFailure()
      return { ok: false, error: GENERIC_LOGIN_ERROR }
    }

    await clearAttempts(key)
    await startCustomerSession(creds.id, creds.sessionVersion)
    await auditCustomerLoginSuccess(creds.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof CustomerAuthConfigError) return { ok: false, error: CONFIG_ERROR }
    console.error('loginCustomerAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

export async function logoutCustomerAction(): Promise<void> {
  // Capture the subject before clearing the cookie so the audit row has an actor.
  const customer = await getCurrentCustomer()
  await endCustomerSession()
  if (customer) await auditCustomerLogout(customer.id)
  redirect('/')
}

/**
 * Updates the logged-in customer's editable profile fields (name/phone — Этап 47B).
 * Re-resolves the owner from the VERIFIED session (never trusts a client id), so it
 * can only ever update the caller's own row. Email stays immutable. Validation
 * mirrors registration (length caps + HTML/script rejection).
 */
export async function updateCustomerProfileAction(input: {
  name?: string
  phone?: string
}): Promise<CustomerProfileResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { ok: false, error: NOT_LOGGED_IN_ERROR }

  // Anti-spam rate-limit keyed by the authenticated customer (every save counts).
  const key = customerKey('profile', customer.id)
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.profile)) {
    await auditCustomerAuthThrottled('profile', customer.id)
    return { ok: false, error: THROTTLED_ERROR }
  }
  await registerAttempt(key, CUSTOMER_THROTTLE_RULES.profile)

  const { errors, value } = validateProfileInput(input)
  if (!value) return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }

  try {
    await updateCustomerProfile(customer.id, value)
    await auditCustomerProfileUpdated(customer.id)
    return { ok: true }
  } catch (e) {
    console.error('updateCustomerProfileAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

/**
 * Changes the logged-in customer's password (Этап 47B; session revocation in 47C).
 * Requires the CURRENT password, verified against the stored hash before any write.
 * The new password is hashed with the existing scrypt helper (never stored/logged
 * in plaintext).
 *
 * Session security (Этап 47C): the same UPDATE that stores the new hash also
 * increments `sessionVersion`, which invalidates EVERY token signed with the old
 * version — including sessions on OTHER devices (they resolve to "logged out" on
 * their next request via getCurrentCustomer). The current device is then re-issued a
 * fresh token bound to the NEW version, so it stays logged in. No email reset here.
 */
export async function changeCustomerPasswordAction(input: {
  currentPassword: string
  newPassword: string
  newPasswordConfirm?: string
}): Promise<CustomerPasswordResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { ok: false, error: NOT_LOGGED_IN_ERROR }

  // Failure-lockout keyed by the authenticated customer: a tight budget against
  // current-password guessing. Cleared on a successful change below.
  const key = customerKey('password', customer.id)
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.password)) {
    await auditCustomerAuthThrottled('password', customer.id)
    return { ok: false, error: THROTTLED_ERROR }
  }

  const { errors, value } = validatePasswordChangeInput(input)
  if (!value) return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }

  try {
    const creds = await getCustomerCredentialsById(customer.id)
    if (!creds) return { ok: false, error: NOT_LOGGED_IN_ERROR }

    const currentOk = await verifyPassword(value.currentPassword, creds.passwordHash)
    if (!currentOk) {
      // Count wrong current-password guesses toward the lockout budget.
      await registerAttempt(key, CUSTOMER_THROTTLE_RULES.password)
      return { ok: false, error: CURRENT_PASSWORD_WRONG, fieldErrors: { currentPassword: ' ' } }
    }

    const newHash = await hashPassword(value.newPassword)
    // Atomic: new hash + sessionVersion++ + passwordChangedAt in ONE update. This is
    // what revokes all previously issued tokens (this device and any other).
    const { sessionVersion } = await updateCustomerPasswordAndBumpVersion(customer.id, newHash)
    // Re-issue THIS device a fresh token bound to the new version so it stays in.
    await startCustomerSession(customer.id, sessionVersion)
    await clearAttempts(key)
    await auditCustomerPasswordChanged(customer.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof CustomerAuthConfigError) return { ok: false, error: CONFIG_ERROR }
    console.error('changeCustomerPasswordAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
