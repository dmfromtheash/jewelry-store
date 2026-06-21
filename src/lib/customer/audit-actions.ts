/**
 * AURELIA — Customer auth audit action ids + labels (Этап 49A)
 *
 * Plain constants only (NO `server-only`, no Prisma) so they can be imported by the
 * server-only write helpers (./audit), the admin audit-log viewer, AND the verify
 * script (which runs under tsx and cannot import server-only modules). The values
 * are stable strings — they are persisted in AdminAuditLog.action and queried/labelled.
 */

/** Stable customer auth action identifiers (the `customer.*` namespace). */
export const CUSTOMER_AUDIT_ACTIONS = {
  registerSuccess: 'customer.register.success',
  registerFailure: 'customer.register.failure',
  loginSuccess: 'customer.login.success',
  loginFailure: 'customer.login.failure',
  logout: 'customer.logout',
  profileUpdated: 'customer.profile.updated',
  passwordChanged: 'customer.password.changed',
  throttled: 'customer.auth.throttled',
} as const

/** Human-readable labels for the admin audit-log UI (Russian, matching the admin
 *  viewer language). The viewer falls back to the raw action string if unmapped. */
export const CUSTOMER_AUDIT_ACTION_LABELS: Record<string, string> = {
  [CUSTOMER_AUDIT_ACTIONS.registerSuccess]: 'Регистрация клиента',
  [CUSTOMER_AUDIT_ACTIONS.registerFailure]: 'Неуспешная регистрация',
  [CUSTOMER_AUDIT_ACTIONS.loginSuccess]: 'Вход клиента',
  [CUSTOMER_AUDIT_ACTIONS.loginFailure]: 'Неуспешный вход клиента',
  [CUSTOMER_AUDIT_ACTIONS.logout]: 'Выход клиента',
  [CUSTOMER_AUDIT_ACTIONS.profileUpdated]: 'Профиль клиента обновлён',
  [CUSTOMER_AUDIT_ACTIONS.passwordChanged]: 'Клиент сменил пароль',
  [CUSTOMER_AUDIT_ACTIONS.throttled]: 'Запрос клиента отклонён (лимит)',
}
