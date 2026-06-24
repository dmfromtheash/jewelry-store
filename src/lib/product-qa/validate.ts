/**
 * AURELIA — Product Q&A validation (Этап 79A)
 *
 * Pure, dependency-free validation + normalisation for a product question. AUTHORITATIVE on
 * the server; the client form reuses it for instant UX. Mirrors the review-validate posture:
 * length-capped + markup-free body/name, with an optional consented reply email. A logged-in
 * customer's display name is the fallback when the form omits a name; a guest must supply one.
 */

import { hasUnsafeMarkup } from '../customer/validate'
import { isValidEmail, normalizeEmail } from '../support/email-utils'
import {
  PQ_BODY_MIN,
  PQ_BODY_MAX,
  PQ_NAME_MIN,
  PQ_NAME_MAX,
  type ProductQuestionFieldErrors,
  type ProductQuestionInput,
} from './types'

export interface NormalizedProductQuestion {
  authorName: string
  body: string
  email: string | null
  consentGiven: boolean
}

export interface ProductQuestionValidation {
  errors: ProductQuestionFieldErrors
  value?: NormalizedProductQuestion
}

export function validateProductQuestion(
  input: ProductQuestionInput,
  fallbackAuthorName?: string | null,
): ProductQuestionValidation {
  const errors: ProductQuestionFieldErrors = {}

  const rawName = (input.authorName ?? '').trim() || (fallbackAuthorName ?? '').trim()
  if (rawName.length < PQ_NAME_MIN) errors.authorName = 'Вкажіть імʼя (мінімум 2 символи).'
  else if (rawName.length > PQ_NAME_MAX) errors.authorName = 'Імʼя задовге.'
  else if (hasUnsafeMarkup(rawName)) errors.authorName = 'Імʼя містить недопустимі символи.'

  const body = (input.body ?? '').trim()
  if (body.length < PQ_BODY_MIN) errors.body = 'Запитання закоротке.'
  else if (body.length > PQ_BODY_MAX) errors.body = 'Запитання задовге.'
  else if (hasUnsafeMarkup(body)) errors.body = 'Запитання містить недопустимі символи.'

  const rawEmail = (input.email ?? '').trim()
  let email: string | null = null
  let consentGiven = false
  if (rawEmail) {
    if (!isValidEmail(rawEmail)) errors.email = 'Перевірте формат e-mail.'
    else if (!input.consent) errors.consent = 'Підтвердіть згоду на звʼязок, щоб ми могли відповісти.'
    else {
      email = normalizeEmail(rawEmail)
      consentGiven = true
    }
  }

  if (Object.keys(errors).length > 0) return { errors }
  return { errors, value: { authorName: rawName, body, email, consentGiven } }
}

export function hasProductQuestionErrors(errors: ProductQuestionFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
