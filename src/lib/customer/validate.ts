/**
 * AURELIA — Customer auth validation (Этап 47A)
 *
 * Pure, dependency-free validation + normalisation for registration/login.
 * Authoritative on the server (the actions call it); safe to import anywhere
 * (no Prisma, no cookies). Rules are intentionally conservative: normalise the
 * email, enforce a minimum password length, cap name/phone length, and reject
 * any HTML/script/`javascript:`/`data:` payload in the free-text fields.
 */

export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 200 // cap KDF input (DoS guard); no real password is longer
export const NAME_MAX_LENGTH = 80
export const PHONE_MAX_LENGTH = 18
export const EMAIL_MAX_LENGTH = 160

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Lenient phone: digits plus + ( ) - and spaces, 10–18 chars (matches checkout).
const PHONE_RE = /^[+\d][\d\s()-]{8,17}$/

/** Same unsafe-markup predicate the site-settings/page writers use. */
export function hasUnsafeMarkup(value: string): boolean {
  if (/[<>]/.test(value)) return true
  return /(?:javascript|data)\s*:/i.test(value)
}

/** Lowercases + trims an email for storage/lookup (login identity is normalised). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export type CustomerFieldErrors = Partial<
  Record<'email' | 'password' | 'passwordConfirm' | 'name' | 'phone', string>
>

/** Shared name check: trims, length-caps, rejects markup. Empty → null (optional). */
function checkName(raw: string): { error?: string; value: string | null } {
  const name = (raw ?? '').trim()
  if (!name) return { value: null }
  if (name.length > NAME_MAX_LENGTH) return { error: 'Імʼя задовге.', value: null }
  if (hasUnsafeMarkup(name)) return { error: 'Імʼя містить недопустимі символи.', value: null }
  return { value: name }
}

/** Shared phone check: trims, length+format caps. Empty → null (optional). */
function checkPhone(raw: string): { error?: string; value: string | null } {
  const phone = (raw ?? '').trim()
  if (!phone) return { value: null }
  if (phone.length > PHONE_MAX_LENGTH || !PHONE_RE.test(phone)) {
    return { error: 'Перевірте формат телефону.', value: null }
  }
  return { value: phone }
}

export interface RegisterInputRaw {
  email: string
  password: string
  passwordConfirm?: string
  name?: string
  phone?: string
}

export interface NormalizedRegisterInput {
  email: string
  password: string
  name: string | null
  phone: string | null
}

export interface RegisterValidationResult {
  errors: CustomerFieldErrors
  /** Present only when `errors` is empty. */
  value?: NormalizedRegisterInput
}

export function validateRegisterInput(input: RegisterInputRaw): RegisterValidationResult {
  const errors: CustomerFieldErrors = {}

  const email = normalizeEmail(input.email ?? '')
  if (!email) errors.email = 'Вкажіть e-mail.'
  else if (email.length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(email)) {
    errors.email = 'Перевірте формат e-mail.'
  }

  const password = input.password ?? ''
  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = 'Пароль задовгий.'
  }

  // Confirmation is optional in the payload, but if present it must match.
  if (input.passwordConfirm != null && input.passwordConfirm !== password) {
    errors.passwordConfirm = 'Паролі не співпадають.'
  }

  const nameCheck = checkName(input.name ?? '')
  if (nameCheck.error) errors.name = nameCheck.error

  const phoneCheck = checkPhone(input.phone ?? '')
  if (phoneCheck.error) errors.phone = phoneCheck.error

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { email, password, name: nameCheck.value, phone: phoneCheck.value } }
}

export interface LoginInputRaw {
  email: string
  password: string
}

export interface LoginValidationResult {
  ok: boolean
  email: string
  password: string
}

/**
 * Light validation for login: normalise the email and require non-empty fields.
 * Format errors are NOT surfaced separately — the action returns a single
 * generic "invalid email or password" message regardless, to avoid leaking which
 * field was wrong or whether the account exists.
 */
export function validateLoginInput(input: LoginInputRaw): LoginValidationResult {
  const email = normalizeEmail(input.email ?? '')
  const password = input.password ?? ''
  const ok = email.length > 0 && email.length <= EMAIL_MAX_LENGTH && password.length > 0
  return { ok, email, password }
}

// --- Profile editing (Этап 47B) ---------------------------------------------
// Email is intentionally NOT editable in v1 (it is the login identity and would
// need a verified change flow); only name + phone can be updated. Same
// conservative name/phone rules as registration, reused via the shared helpers.

export type ProfileFieldErrors = Partial<Record<'name' | 'phone', string>>

export interface NormalizedProfileInput {
  name: string | null
  phone: string | null
}

export interface ProfileValidationResult {
  errors: ProfileFieldErrors
  /** Present only when `errors` is empty. */
  value?: NormalizedProfileInput
}

export function validateProfileInput(input: { name?: string; phone?: string }): ProfileValidationResult {
  const errors: ProfileFieldErrors = {}

  const nameCheck = checkName(input.name ?? '')
  if (nameCheck.error) errors.name = nameCheck.error

  const phoneCheck = checkPhone(input.phone ?? '')
  if (phoneCheck.error) errors.phone = phoneCheck.error

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { name: nameCheck.value, phone: phoneCheck.value } }
}

// --- Password change (Этап 47B) ---------------------------------------------
// Requires the current password (verified server-side against the stored hash)
// plus a new password held to the same min/max length as registration. The
// confirmation, when sent, must match. No content of any password is ever
// surfaced in an error.

export type PasswordChangeFieldErrors = Partial<
  Record<'currentPassword' | 'newPassword' | 'newPasswordConfirm', string>
>

export interface PasswordChangeInputRaw {
  currentPassword: string
  newPassword: string
  newPasswordConfirm?: string
}

export interface PasswordChangeValidationResult {
  errors: PasswordChangeFieldErrors
  /** Present only when `errors` is empty. */
  value?: { currentPassword: string; newPassword: string }
}

export function validatePasswordChangeInput(input: PasswordChangeInputRaw): PasswordChangeValidationResult {
  const errors: PasswordChangeFieldErrors = {}

  const currentPassword = input.currentPassword ?? ''
  if (!currentPassword) errors.currentPassword = 'Вкажіть поточний пароль.'

  const newPassword = input.newPassword ?? ''
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = `Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`
  } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.newPassword = 'Пароль задовгий.'
  }

  if (input.newPasswordConfirm != null && input.newPasswordConfirm !== newPassword) {
    errors.newPasswordConfirm = 'Паролі не співпадають.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { currentPassword, newPassword } }
}

// --- Password reset (Этап 60A) ----------------------------------------------
// Reset (via token) sets a NEW password WITHOUT a current password — identity is
// proven by the single-use token, not the old password. Same length rules as
// registration / change; the confirmation, when sent, must match.

export type ResetPasswordFieldErrors = Partial<Record<'newPassword' | 'newPasswordConfirm', string>>

export interface ResetPasswordValidationResult {
  errors: ResetPasswordFieldErrors
  /** Present only when `errors` is empty. */
  value?: { newPassword: string }
}

export function validateResetPasswordInput(input: {
  newPassword: string
  newPasswordConfirm?: string
}): ResetPasswordValidationResult {
  const errors: ResetPasswordFieldErrors = {}

  const newPassword = input.newPassword ?? ''
  if (newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = `Пароль має містити щонайменше ${PASSWORD_MIN_LENGTH} символів.`
  } else if (newPassword.length > PASSWORD_MAX_LENGTH) {
    errors.newPassword = 'Пароль задовгий.'
  }

  if (input.newPasswordConfirm != null && input.newPasswordConfirm !== newPassword) {
    errors.newPasswordConfirm = 'Паролі не співпадають.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { newPassword } }
}
