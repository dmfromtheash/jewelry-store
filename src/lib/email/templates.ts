/**
 * AURELIA — Email template registry + renderers (Этап 59A)
 *
 * Pure, dependency-free template identifiers + renderers for the email foundation.
 * NO email is sent by anything here — these produce a safe subject + plain-text body
 * for FUTURE provider wiring (and the admin/verify layers). No Prisma, no provider,
 * no secrets. The rendered body is intentionally NOT persisted (it could embed PII);
 * only the subject is stored in the outbox.
 *
 * Stable string values mirror the Prisma `EmailTemplate` enum.
 */

export const EMAIL_TEMPLATES = {
  orderConfirmation: 'order_confirmation',
  orderStatusUpdate: 'order_status_update',
  passwordReset: 'password_reset',
  emailVerification: 'email_verification',
  backInStockNotification: 'back_in_stock_notification',
} as const

export type EmailTemplateId = (typeof EMAIL_TEMPLATES)[keyof typeof EMAIL_TEMPLATES]

/** Human-readable labels for the admin outbox view (fallback: the raw id). */
export const EMAIL_TEMPLATE_LABELS: Record<EmailTemplateId, string> = {
  [EMAIL_TEMPLATES.orderConfirmation]: 'Подтверждение заказа',
  [EMAIL_TEMPLATES.orderStatusUpdate]: 'Обновление статуса заказа',
  [EMAIL_TEMPLATES.passwordReset]: 'Сброс пароля',
  [EMAIL_TEMPLATES.emailVerification]: 'Подтверждение e-mail',
  [EMAIL_TEMPLATES.backInStockNotification]: 'Сообщение о наличии товара',
}

export interface RenderedEmail {
  subject: string
  text: string
}

/** Order confirmation — safe: order code only, never contact data or payment. */
export function renderOrderConfirmation(input: { orderCode: string }): RenderedEmail {
  return {
    subject: `AURELIA — замовлення ${input.orderCode} прийнято`,
    text:
      `Дякуємо за замовлення в AURELIA.\n\n` +
      `Номер замовлення: ${input.orderCode}.\n` +
      `Ми звʼяжемося з вами для підтвердження.`,
  }
}

/** Order status update — order code + a status label (already safe text). */
export function renderOrderStatusUpdate(input: { orderCode: string; statusLabel: string }): RenderedEmail {
  return {
    subject: `AURELIA — статус замовлення ${input.orderCode}`,
    text: `Статус вашого замовлення ${input.orderCode}: ${input.statusLabel}.`,
  }
}

/**
 * Password reset — FOUNDATION ONLY. This renderer does NOT embed a real token: a
 * working reset link requires a provider + a hashed-token model (deferred, owner-gated
 * — see docs/customer/CUSTOMER_AUTH_ACCOUNT_SPEC.md). The placeholder makes the absence
 * explicit so no code accidentally ships a broken "reset works" flow.
 */
export function renderPasswordReset(): RenderedEmail {
  return {
    subject: 'AURELIA — скидання пароля',
    text:
      'Запит на скидання пароля. ' +
      'Реальне надсилання листів і робоче посилання для скидання поки не активні ' +
      '(потрібен поштовий провайдер).',
  }
}

/** Email verification — FOUNDATION ONLY (same provider/token caveat as reset). */
export function renderEmailVerification(): RenderedEmail {
  return {
    subject: 'AURELIA — підтвердження e-mail',
    text:
      'Підтвердження e-mail. ' +
      'Реальне надсилання листів поки не активне (потрібен поштовий провайдер).',
  }
}

/**
 * Back-in-stock availability notification — FOUNDATION ONLY (Этап 79A). Records the INTENT to
 * tell a customer a product is available again; with no provider the outbox row terminates at
 * `skipped_no_provider`, so nothing is delivered. The product name is safe text (no PII).
 */
export function renderBackInStockNotification(input: { productName: string }): RenderedEmail {
  return {
    subject: `AURELIA — ${input.productName}: товар знову в наявності`,
    text:
      `Товар «${input.productName}», за яким ви стежили, знову в наявності.\n\n` +
      'Реальне надсилання листів поки не активне (потрібен поштовий провайдер).',
  }
}
