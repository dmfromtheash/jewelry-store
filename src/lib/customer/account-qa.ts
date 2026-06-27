/**
 * AURELIA — Customer-facing account Q&A / waiting labels + visibility (Этап 86A)
 *
 * PURE helpers (NO `server-only`, NO Prisma client) so they can be imported by the
 * server-only account reads, the account page UI, AND the verify script (which runs
 * under tsx and cannot load server-only modules). The maps are keyed by the stored
 * status STRING (with a safe fallback), mirroring src/lib/customer/order-display.ts.
 *
 * Honest by construction: a customer only ever sees their OWN questions, mapped to
 * friendly Ukrainian copy. Moderation-only states (`spam`, and a `rejected` help
 * question) are HIDDEN from the customer, and no admin actor / moderation reason is
 * ever surfaced (those fields are never even selected by the reads).
 */

/* ----------------------------- Help questions ----------------------------- */

/** Customer-facing labels for a general Help question (model HelpQuestion). */
export const HELP_QUESTION_CUSTOMER_LABELS: Record<string, string> = {
  new: 'На розгляді',
  triaged: 'На розгляді',
  answered: 'Відповіли',
  published: 'Відповіли',
  archived: 'Закрито',
}

export function helpQuestionCustomerLabel(status: string): string {
  return HELP_QUESTION_CUSTOMER_LABELS[status] ?? 'На розгляді'
}

/** Statuses a customer must NEVER see in their account (moderation-only). */
const HELP_QUESTION_HIDDEN = new Set(['spam', 'rejected'])

/** True when a Help question may be shown back to its owner. */
export function isHelpQuestionVisibleToCustomer(status: string): boolean {
  return !HELP_QUESTION_HIDDEN.has(status)
}

/** True when a Help question carries an answer the customer can read. */
export function isHelpQuestionAnswered(status: string): boolean {
  return status === 'answered' || status === 'published'
}

/* --------------------------- Product questions ---------------------------- */

/** Customer-facing labels for a product question (model ProductQuestion). */
export const PRODUCT_QUESTION_CUSTOMER_LABELS: Record<string, string> = {
  pending: 'На модерації',
  answered: 'Відповіли',
  published: 'Опубліковано',
  rejected: 'Відхилено',
  archived: 'Закрито',
}

export function productQuestionCustomerLabel(status: string): string {
  return PRODUCT_QUESTION_CUSTOMER_LABELS[status] ?? 'На модерації'
}

/** `spam` is abuse — never shown to the customer. Everything else is the customer's
 *  own content (incl. a neutral "Відхилено") and may be shown. */
const PRODUCT_QUESTION_HIDDEN = new Set(['spam'])

export function isProductQuestionVisibleToCustomer(status: string): boolean {
  return !PRODUCT_QUESTION_HIDDEN.has(status)
}

export function isProductQuestionAnswered(status: string): boolean {
  return status === 'answered' || status === 'published'
}

/* ------------------------ Availability interests -------------------------- */

/** Customer-facing labels for an email-based availability interest
 *  (model ProductAvailabilityInterest). NO reservation/hold is ever implied. */
export const AVAILABILITY_CUSTOMER_LABELS: Record<string, string> = {
  requested: 'Очікую наявності',
  pending_availability: 'Очікую наявності',
  queued_notification: 'Очікую наявності',
  notification_prepared: 'Сповіщення підготовлено (без надсилання)',
  cancelled: 'Скасовано',
  expired: 'Завершено',
}

export function availabilityCustomerLabel(status: string): string {
  return AVAILABILITY_CUSTOMER_LABELS[status] ?? 'Очікую наявності'
}

/** "Open" (still-waiting) availability statuses — drives the unified waiting count
 *  and whether a self-cancel makes sense. A `cancelled`/`expired` row is closed. */
const AVAILABILITY_OPEN = new Set([
  'requested',
  'pending_availability',
  'queued_notification',
  'notification_prepared',
])

export function isAvailabilityInterestOpen(status: string): boolean {
  return AVAILABILITY_OPEN.has(status)
}
