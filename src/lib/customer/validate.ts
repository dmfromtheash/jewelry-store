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

  const nameRaw = (input.name ?? '').trim()
  let name: string | null = null
  if (nameRaw) {
    if (nameRaw.length > NAME_MAX_LENGTH) errors.name = 'Імʼя задовге.'
    else if (hasUnsafeMarkup(nameRaw)) errors.name = 'Імʼя містить недопустимі символи.'
    else name = nameRaw
  }

  const phoneRaw = (input.phone ?? '').trim()
  let phone: string | null = null
  if (phoneRaw) {
    if (phoneRaw.length > PHONE_MAX_LENGTH || !PHONE_RE.test(phoneRaw)) {
      errors.phone = 'Перевірте формат телефону.'
    } else phone = phoneRaw
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { email, password, name, phone } }
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
