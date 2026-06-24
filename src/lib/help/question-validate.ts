/**
 * AURELIA — Help question validation (Этап 79A)
 *
 * Pure, dependency-free validation + normalisation for the general Help question form.
 * AUTHORITATIVE on the server; the client form reuses it for instant UX. No Prisma, no
 * cookies. Conservative rules: known category, length-capped + markup-free subject/message/
 * name, a valid reply email ONLY when one is supplied (with consent), and loose triage refs.
 */

import { hasUnsafeMarkup } from '../customer/validate'
import { isValidEmail, normalizeEmail } from '../support/email-utils'
import { isHelpCategorySlug } from './content'
import {
  HELP_SUBJECT_MIN,
  HELP_SUBJECT_MAX,
  HELP_MESSAGE_MIN,
  HELP_MESSAGE_MAX,
  HELP_NAME_MAX,
  HELP_REF_MAX,
  type HelpQuestionFieldErrors,
  type HelpQuestionInput,
} from './question-types'

export interface NormalizedHelpQuestion {
  categorySlug: string
  subject: string
  message: string
  authorName: string | null
  /** Normalised reply email, or null when none was supplied. */
  email: string | null
  /** True only when an email was supplied AND consent accepted. */
  consentGiven: boolean
  productRef: string | null
  orderRef: string | null
}

export interface HelpQuestionValidation {
  errors: HelpQuestionFieldErrors
  value?: NormalizedHelpQuestion
}

function cleanRef(raw: string | undefined, max: number): string | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (v.length > max || hasUnsafeMarkup(v)) return null // silently drop a bad triage hint
  return v
}

export function validateHelpQuestion(input: HelpQuestionInput): HelpQuestionValidation {
  const errors: HelpQuestionFieldErrors = {}

  if (!isHelpCategorySlug(input.categorySlug)) {
    errors.categorySlug = 'Оберіть категорію.'
  }

  const subject = (input.subject ?? '').trim()
  if (subject.length < HELP_SUBJECT_MIN) errors.subject = 'Вкажіть тему запитання.'
  else if (subject.length > HELP_SUBJECT_MAX) errors.subject = 'Тема задовга.'
  else if (hasUnsafeMarkup(subject)) errors.subject = 'Тема містить недопустимі символи.'

  const message = (input.message ?? '').trim()
  if (message.length < HELP_MESSAGE_MIN) errors.message = 'Опишіть запитання детальніше.'
  else if (message.length > HELP_MESSAGE_MAX) errors.message = 'Повідомлення задовге.'
  else if (hasUnsafeMarkup(message)) errors.message = 'Повідомлення містить недопустимі символи.'

  const rawName = (input.authorName ?? '').trim()
  let authorName: string | null = null
  if (rawName) {
    if (rawName.length > HELP_NAME_MAX) errors.authorName = 'Імʼя задовге.'
    else if (hasUnsafeMarkup(rawName)) errors.authorName = 'Імʼя містить недопустимі символи.'
    else authorName = rawName
  }

  // Email is optional. If supplied, it must be valid AND consent must be accepted.
  const rawEmail = (input.email ?? '').trim()
  let email: string | null = null
  let consentGiven = false
  if (rawEmail) {
    if (!isValidEmail(rawEmail)) {
      errors.email = 'Перевірте формат e-mail.'
    } else if (!input.consent) {
      errors.consent = 'Підтвердіть згоду на звʼязок, щоб ми могли відповісти.'
    } else {
      email = normalizeEmail(rawEmail)
      consentGiven = true
    }
  }

  if (Object.keys(errors).length > 0) return { errors }

  return {
    errors,
    value: {
      categorySlug: input.categorySlug,
      subject,
      message,
      authorName,
      email,
      consentGiven,
      productRef: cleanRef(input.productRef, HELP_REF_MAX),
      orderRef: cleanRef(input.orderRef, HELP_REF_MAX),
    },
  }
}

export function hasHelpQuestionErrors(errors: HelpQuestionFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
