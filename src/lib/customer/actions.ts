'use server'

/**
 * AURELIA — Customer auth server actions (Этап 47A)
 *
 * register / login / logout for storefront customers. Called from the auth
 * modals (client) and return a typed result the modal renders inline. Security:
 *   - passwords hashed with scrypt (never stored/logged in plaintext);
 *   - email normalised + validated; generic errors (no account-existence leak);
 *   - separate httpOnly customer session cookie issued on success;
 *   - a conservative in-memory throttle slows credential stuffing (best-effort,
 *     per-process — fails OPEN on restart, like the admin throttle).
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
} from './repo'
import { startCustomerSession, endCustomerSession } from './session'
import { CustomerAuthConfigError } from './token'
import {
  validateLoginInput,
  validateRegisterInput,
  type CustomerFieldErrors,
} from './validate'

export type CustomerAuthResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: CustomerFieldErrors }

const GENERIC_LOGIN_ERROR = 'Невірний e-mail або пароль.'
const CONFIG_ERROR = 'Вхід тимчасово недоступний. Спробуйте пізніше.'
const SERVER_ERROR = 'Сталася помилка. Спробуйте ще раз.'
const THROTTLED_ERROR = 'Забагато спроб. Зачекайте трохи й спробуйте знову.'

// --- Best-effort in-memory auth throttle (per-process; fails open on restart) ---
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000
const ATTEMPT_MAX = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

async function clientKey(scope: string): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `${scope}:${ip}`
}

function isThrottled(key: string): boolean {
  const bucket = attempts.get(key)
  if (!bucket) return false
  if (Date.now() > bucket.resetAt) {
    attempts.delete(key)
    return false
  }
  return bucket.count >= ATTEMPT_MAX
}

function registerAttempt(key: string): void {
  const now = Date.now()
  const bucket = attempts.get(key)
  if (!bucket || now > bucket.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS })
    return
  }
  bucket.count += 1
}

function clearAttempts(key: string): void {
  attempts.delete(key)
}

export async function registerCustomerAction(input: {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
  phone?: string
}): Promise<CustomerAuthResult> {
  const key = await clientKey('register')
  if (isThrottled(key)) return { ok: false, error: THROTTLED_ERROR }

  const { errors, value } = validateRegisterInput(input)
  if (!value) {
    registerAttempt(key)
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
    clearAttempts(key)
    await startCustomerSession(customer.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof DuplicateEmailError) {
      // Generic-ish: tell them the email is taken (needed UX), but no other leak.
      registerAttempt(key)
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
  const key = await clientKey('login')
  if (isThrottled(key)) return { ok: false, error: THROTTLED_ERROR }

  const { ok, email, password } = validateLoginInput(input)
  if (!ok) {
    registerAttempt(key)
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
      registerAttempt(key)
      return { ok: false, error: GENERIC_LOGIN_ERROR }
    }

    clearAttempts(key)
    await startCustomerSession(creds.id)
    return { ok: true }
  } catch (e) {
    if (e instanceof CustomerAuthConfigError) return { ok: false, error: CONFIG_ERROR }
    console.error('loginCustomerAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

export async function logoutCustomerAction(): Promise<void> {
  await endCustomerSession()
  redirect('/')
}
