/**
 * AURELIA — Availability-interest validation (Этап 79A)
 *
 * Pure, dependency-free validation for the back-in-stock form. AUTHORITATIVE on the server;
 * the client form reuses it. Requires a valid email AND explicit consent (the email is only
 * stored to allow a future notification — consent is mandatory). No Prisma, no cookies.
 */

import { isValidEmail, normalizeEmail } from '../support/email-utils'
import type { AvailabilityInterestFieldErrors, AvailabilityInterestInput } from './types'

export interface NormalizedAvailabilityInterest {
  email: string
}

export interface AvailabilityInterestValidation {
  errors: AvailabilityInterestFieldErrors
  value?: NormalizedAvailabilityInterest
}

export function validateAvailabilityInterest(
  input: AvailabilityInterestInput,
): AvailabilityInterestValidation {
  const errors: AvailabilityInterestFieldErrors = {}

  const rawEmail = (input.email ?? '').trim()
  if (!rawEmail) errors.email = 'Вкажіть e-mail.'
  else if (!isValidEmail(rawEmail)) errors.email = 'Перевірте формат e-mail.'

  if (!input.consent) {
    errors.consent = 'Підтвердіть згоду, щоб ми могли зберегти ваш запит.'
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { email: normalizeEmail(rawEmail) } }
}

export function hasAvailabilityInterestErrors(errors: AvailabilityInterestFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
