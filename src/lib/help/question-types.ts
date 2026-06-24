/**
 * AURELIA — Help question types (Этап 79A)
 *
 * Shared, serializable types for the general "Поставити запитання" Help flow. Safe to
 * import from client + server (no Prisma). The DB model is `HelpQuestion`.
 */

export const HELP_SUBJECT_MIN = 4
export const HELP_SUBJECT_MAX = 120
export const HELP_MESSAGE_MIN = 10
export const HELP_MESSAGE_MAX = 2000
export const HELP_NAME_MAX = 80
export const HELP_REF_MAX = 80

/** What the Help question form submits. */
export interface HelpQuestionInput {
  categorySlug: string
  subject: string
  message: string
  /** Optional display name. */
  authorName?: string
  /** Optional reply email; if present, consent must be accepted. */
  email?: string
  /** Must be true when an email is supplied (contact consent). */
  consent?: boolean
  /** Optional product slug the question is about (triage hint). */
  productRef?: string
  /** Optional order code (triage hint only — NOT ownership proof). */
  orderRef?: string
  /** Honeypot — must stay empty; a value means "bot" and the submission is dropped. */
  website?: string
}

export type HelpQuestionFieldErrors = Partial<
  Record<'categorySlug' | 'subject' | 'message' | 'authorName' | 'email' | 'consent', string>
>

export type HelpQuestionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: HelpQuestionFieldErrors }
