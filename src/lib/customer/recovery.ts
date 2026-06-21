'use server'

/**
 * AURELIA — Account recovery + email verification server actions (Этап 60A)
 *
 * Provider-ready password-reset and email-verification flows built on single-use, HASHED
 * tokens (CustomerAccountToken) — with NO real email sending. Because no provider is
 * configured, the reset/verification LINK is never actually delivered to a real inbox:
 * the request enqueues an outbox INTENT (recorded as skipped_no_provider) and the raw
 * token is returned to internals only (the verify script drives the confirm step
 * directly). The UI copy is honest about this; nothing here claims an email was sent.
 *
 * Security:
 *   - Reset REQUEST returns a GENERIC response whether or not the email exists (no
 *     account-enumeration leak), and is rate-limited by IP + audited as "anonymous".
 *   - Tokens are single-use, short-lived, and stored only as a sha256 hash. A completed
 *     reset uses the existing scrypt hash + `updateCustomerPasswordAndBumpVersion`, which
 *     increments `sessionVersion` → EVERY previously issued session token is revoked.
 *   - Email verification never blocks login or guest checkout.
 *   - No raw token / password / email is ever logged or returned in an error.
 */

import { headers } from 'next/headers'
import { prisma } from '../db/prisma'
import { hashPassword } from './password'
import {
  findCustomerForRecovery,
  updateCustomerPasswordAndBumpVersion,
} from './repo'
import { getCurrentCustomer } from './session'
import {
  ACCOUNT_TOKEN_PURPOSES,
  createAccountToken,
  consumeAccountToken,
  markEmailVerified,
} from './account-token-repo'
import {
  enqueuePasswordResetEmail,
  enqueueEmailVerificationEmail,
} from '../email/outbox'
import {
  CUSTOMER_THROTTLE_RULES,
  clearAttempts,
  isThrottled,
  registerAttempt,
  type ThrottleScope,
} from './rate-limit'
import {
  auditCustomerAuthThrottled,
  auditCustomerPasswordResetRequested,
  auditCustomerPasswordResetCompleted,
  auditCustomerPasswordResetFailed,
  auditCustomerEmailVerificationRequested,
  auditCustomerEmailVerified,
} from './audit'
import { normalizeEmail, validateResetPasswordInput, type ResetPasswordFieldErrors } from './validate'

export type RecoveryResult = { ok: true } | { ok: false; error: string }
export type ResetPasswordResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: ResetPasswordFieldErrors }

const THROTTLED_ERROR = 'Забагато спроб. Зачекайте трохи й спробуйте знову.'
const SERVER_ERROR = 'Сталася помилка. Спробуйте ще раз.'
const RESET_TOKEN_ERROR = 'Посилання недійсне або застаріле. Запросіть нове.'
const NOT_LOGGED_IN_ERROR = 'Сесія завершилася. Увійдіть знову.'
// Generic, honest acknowledgement — identical whether or not the account exists, and
// honest that nothing is actually emailed (no provider configured).
const GENERIC_RESET_ACK =
  'Якщо акаунт із такою адресою існує, ми надішлемо інструкції. ' +
  'Зараз надсилання листів не активне (не підключено поштовий сервіс).'

async function ipKey(scope: ThrottleScope): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd || h.get('x-real-ip')?.trim() || 'local'
  return `${scope}:${ip}`
}

function customerKey(scope: ThrottleScope, customerId: string): string {
  return `${scope}:cust:${customerId}`
}

/**
 * Requests a password reset for an email. ALWAYS returns the same generic acknowledgement
 * (no account-existence leak). When the account exists it creates a single-use token and
 * enqueues a reset-email INTENT — which, with no provider, is recorded as
 * skipped_no_provider and never actually delivered.
 */
export async function requestPasswordResetAction(input: { email: string }): Promise<RecoveryResult> {
  const key = await ipKey('passwordReset')
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.passwordReset)) {
    await auditCustomerAuthThrottled('passwordReset')
    return { ok: false, error: THROTTLED_ERROR }
  }
  await registerAttempt(key, CUSTOMER_THROTTLE_RULES.passwordReset)

  const email = normalizeEmail(input.email ?? '')
  // Audit is identical for existing + non-existing accounts (actor "anonymous", no email).
  await auditCustomerPasswordResetRequested()

  try {
    if (email) {
      const customer = await findCustomerForRecovery(email)
      if (customer) {
        // Raw token stays internal (never returned/logged) — there is no provider to mail it.
        await createAccountToken(prisma, customer.id, ACCOUNT_TOKEN_PURPOSES.passwordReset)
        await enqueuePasswordResetEmail(customer.id, customer.email)
      }
    }
  } catch (e) {
    // Never surface internal failure (would leak timing/existence) — log + generic ack.
    console.error('requestPasswordResetAction failed:', e instanceof Error ? e.message : 'unknown')
  }
  // Same response regardless of outcome.
  return { ok: true }
}

/** The generic acknowledgement copy (also rendered by the request page on success). */
export async function passwordResetAcknowledgement(): Promise<string> {
  return GENERIC_RESET_ACK
}

/**
 * Confirms a password reset: validates the new password, atomically consumes the
 * single-use token, then replaces the hash + bumps sessionVersion (revoking all old
 * sessions). A missing/used/expired token yields a generic error.
 */
export async function confirmPasswordResetAction(input: {
  token: string
  newPassword: string
  newPasswordConfirm?: string
}): Promise<ResetPasswordResult> {
  const key = await ipKey('passwordResetConfirm')
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.passwordResetConfirm)) {
    await auditCustomerAuthThrottled('passwordResetConfirm')
    return { ok: false, error: THROTTLED_ERROR }
  }

  const { errors, value } = validateResetPasswordInput(input)
  if (!value) {
    await registerAttempt(key, CUSTOMER_THROTTLE_RULES.passwordResetConfirm)
    return { ok: false, error: 'Перевірте поля форми.', fieldErrors: errors }
  }

  try {
    const consumed = await consumeAccountToken(
      prisma,
      (input.token ?? '').trim(),
      ACCOUNT_TOKEN_PURPOSES.passwordReset,
    )
    if (!consumed) {
      await registerAttempt(key, CUSTOMER_THROTTLE_RULES.passwordResetConfirm)
      await auditCustomerPasswordResetFailed('invalid_or_expired_token')
      return { ok: false, error: RESET_TOKEN_ERROR }
    }

    const newHash = await hashPassword(value.newPassword)
    // Atomic new hash + sessionVersion++ + passwordChangedAt → revokes every old session.
    await updateCustomerPasswordAndBumpVersion(consumed.customerId, newHash)
    await clearAttempts(key)
    await auditCustomerPasswordResetCompleted(consumed.customerId)
    return { ok: true }
  } catch (e) {
    console.error('confirmPasswordResetAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

/**
 * Requests an email-verification email for the LOGGED-IN customer. Creates a single-use
 * token + enqueues a verification INTENT (recorded skipped_no_provider — never delivered,
 * no provider). No-op-safe if already verified. Rate-limited per customer.
 */
export async function requestEmailVerificationAction(): Promise<RecoveryResult> {
  const customer = await getCurrentCustomer()
  if (!customer) return { ok: false, error: NOT_LOGGED_IN_ERROR }
  if (customer.emailVerifiedAt) return { ok: true }

  const key = customerKey('emailVerification', customer.id)
  if (await isThrottled(key, CUSTOMER_THROTTLE_RULES.emailVerification)) {
    await auditCustomerAuthThrottled('emailVerification', customer.id)
    return { ok: false, error: THROTTLED_ERROR }
  }
  await registerAttempt(key, CUSTOMER_THROTTLE_RULES.emailVerification)

  try {
    await createAccountToken(prisma, customer.id, ACCOUNT_TOKEN_PURPOSES.emailVerification)
    await enqueueEmailVerificationEmail(customer.id, customer.email)
    await auditCustomerEmailVerificationRequested(customer.id)
    return { ok: true }
  } catch (e) {
    console.error('requestEmailVerificationAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

/**
 * Confirms email verification from a token. Single-use; sets `emailVerifiedAt`. A
 * missing/used/expired token yields a generic error. Verification is never required for
 * login or checkout — this only flips the status.
 */
export async function confirmEmailVerificationAction(input: { token: string }): Promise<RecoveryResult> {
  try {
    const consumed = await consumeAccountToken(
      prisma,
      (input.token ?? '').trim(),
      ACCOUNT_TOKEN_PURPOSES.emailVerification,
    )
    if (!consumed) return { ok: false, error: RESET_TOKEN_ERROR }

    await markEmailVerified(prisma, consumed.customerId)
    await auditCustomerEmailVerified(consumed.customerId)
    return { ok: true }
  } catch (e) {
    console.error('confirmEmailVerificationAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}
