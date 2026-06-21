/**
 * AURELIA — Customer auth audit log (Этап 49A)
 *
 * Records storefront customer auth/security events into the SAME append-only
 * `AdminAuditLog` table as the admin events, under a `customer.*` action namespace.
 * Reusing that table (instead of a parallel CustomerAuthAuditLog) avoids a schema
 * change and a second admin viewer — the structure (actor / action / success /
 * entity / summary / reason) maps exactly, and the namespace keeps the two streams
 * distinguishable.
 *
 * Privacy & safety (enforced by construction here — mirrors src/lib/admin/audit.ts):
 *   - actor is the Customer.id (an opaque cuid, not PII) for KNOWN-customer events,
 *     or "anonymous" for pre-account / failed / throttled events.
 *   - NEVER store passwords, attempted passwords, the email, session cookies/tokens,
 *     the password hash, or any raw request body/headers. Failure events carry only
 *     a machine `reason` ("invalid_credentials" | "duplicate_email" | a scope name).
 *   - To avoid leaking which emails exist, the attacker-supplied email is NOT stored
 *     on login/register failures.
 *   - Writing never throws into the caller (recordAuditEvent swallows + logs).
 */

import 'server-only'

import { recordAuditEvent } from '../admin/audit'
import { CUSTOMER_AUDIT_ACTIONS } from './audit-actions'

// Action ids + labels live in ./audit-actions (a plain, non-server-only module) so
// the admin viewer and the verify script can reuse them. Re-exported for callers
// that already import from this module.
export { CUSTOMER_AUDIT_ACTIONS, CUSTOMER_AUDIT_ACTION_LABELS } from './audit-actions'

const ENTITY_CUSTOMER = 'customer'

/** Successful customer registration. */
export function auditCustomerRegisterSuccess(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.registerSuccess,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Зарегистрирован новый клиент.',
  })
}

/**
 * Refused registration. Records ONLY a machine reason — never the attempted email
 * or password. We log "duplicate_email" (a real abuse signal) but skip ordinary
 * validation typos to keep the log low-noise.
 */
export function auditCustomerRegisterFailure(reason: string): Promise<void> {
  const summary =
    reason === 'duplicate_email'
      ? 'Регистрация отклонена: e-mail уже занят.'
      : 'Неуспешная попытка регистрации.'
  return recordAuditEvent({
    actor: 'anonymous',
    action: CUSTOMER_AUDIT_ACTIONS.registerFailure,
    success: false,
    reason,
    summary,
  })
}

/** Successful customer login. */
export function auditCustomerLoginSuccess(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.loginSuccess,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Успешный вход клиента.',
  })
}

/** Failed customer login. Reason is always the generic "invalid_credentials"
 *  (no account-existence leak); the attempted email is intentionally NOT stored. */
export function auditCustomerLoginFailure(): Promise<void> {
  return recordAuditEvent({
    actor: 'anonymous',
    action: CUSTOMER_AUDIT_ACTIONS.loginFailure,
    success: false,
    reason: 'invalid_credentials',
    summary: 'Неуспешная попытка входа клиента.',
  })
}

/** Customer logout. */
export function auditCustomerLogout(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.logout,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Клиент вышел из аккаунта.',
  })
}

/** Customer profile update (name/phone). No field VALUES are stored. */
export function auditCustomerProfileUpdated(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.profileUpdated,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Клиент обновил профиль.',
  })
}

/** Successful customer password change (also revokes other-device sessions). */
export function auditCustomerPasswordChanged(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.passwordChanged,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Клиент сменил пароль (другие сессии завершены).',
  })
}

/**
 * Password-reset REQUESTED (Этап 60A). To avoid leaking which emails exist, this is
 * recorded as "anonymous" with NO email — even when a matching account was found, the
 * audit row is identical to the no-account case from the outside.
 */
export function auditCustomerPasswordResetRequested(): Promise<void> {
  return recordAuditEvent({
    actor: 'anonymous',
    action: CUSTOMER_AUDIT_ACTIONS.passwordResetRequested,
    success: true,
    summary: 'Запрошен сброс пароля (если аккаунт существует).',
  })
}

/** Password reset COMPLETED via a valid token (also revokes other-device sessions). */
export function auditCustomerPasswordResetCompleted(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.passwordResetCompleted,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Пароль сброшен по токену (другие сессии завершены).',
  })
}

/** Password reset REFUSED. `reason` is a machine token only ("invalid_or_expired_token"
 *  | "invalid_password" | a throttle scope) — never the attempted token or password. */
export function auditCustomerPasswordResetFailed(reason: string): Promise<void> {
  return recordAuditEvent({
    actor: 'anonymous',
    action: CUSTOMER_AUDIT_ACTIONS.passwordResetFailed,
    success: false,
    reason,
    summary: 'Сброс пароля отклонён.',
  })
}

/** Email-verification email REQUESTED for a logged-in customer. */
export function auditCustomerEmailVerificationRequested(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.emailVerificationRequested,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'Запрошено подтверждение e-mail.',
  })
}

/** Email VERIFIED via a valid token. */
export function auditCustomerEmailVerified(customerId: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId,
    action: CUSTOMER_AUDIT_ACTIONS.emailVerified,
    success: true,
    entityType: ENTITY_CUSTOMER,
    entityId: customerId,
    summary: 'E-mail клиента подтверждён.',
  })
}

/**
 * A customer auth attempt refused by the rate limiter. `scope` is the throttle
 * scope ("login" | "register" | "password" | "profile" | "passwordReset" |
 * "emailVerification") — a machine reason only. For authenticated scopes the customer
 * id is recorded as the actor; for anonymous scopes it stays "anonymous".
 */
export function auditCustomerAuthThrottled(scope: string, customerId?: string): Promise<void> {
  return recordAuditEvent({
    actor: customerId ?? 'anonymous',
    action: CUSTOMER_AUDIT_ACTIONS.throttled,
    success: false,
    reason: scope,
    entityType: customerId ? ENTITY_CUSTOMER : null,
    entityId: customerId ?? null,
    summary: 'Запрос клиента отклонён: слишком много попыток.',
  })
}
