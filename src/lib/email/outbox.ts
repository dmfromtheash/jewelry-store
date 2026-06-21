/**
 * AURELIA — Email outbox (Этап 59A; provider-ready processing 60A) — NO REAL SENDING
 *
 * Records intended emails into the `EmailOutbox` table and runs them through the no-send
 * PROVIDER facade (./provider) so every row reaches an honest terminal status. It does
 * NOT integrate any provider (SendGrid / Mailgun / SMTP), holds NO credentials, reads NO
 * secrets, and never contacts a mail server.
 *
 * Lifecycle (Этап 60A): `enqueueEmail` writes a `queued` row, then immediately processes
 * it once (best-effort) via src/lib/email/process.ts. With the default NoSendEmailProvider
 * a deliverable row becomes `skipped_no_provider` (recorded, NOT sent) and one with no
 * recipient becomes `failed_validation` — it is NEVER reported as sent. The
 * `email:process:stub` CLI can drain any remaining `queued` rows. When a real provider is
 * later wired (owner-gated), `PROVIDER_CONFIGURED` flips and `getEmailProvider()` returns
 * the real adapter; `sent_stub` exists for that future and is exercised by verify only.
 *
 * Privacy: only a template id, status, short subject, optional machine note/last-error,
 * attempts, and a loose (no-FK) related ref are stored. The rendered BODY is never stored,
 * and NO token/secret/reset-code is ever stored here (reset/verification tokens live —
 * hashed — in CustomerAccountToken, never in the outbox).
 */

import 'server-only'

import { prisma } from '../db/prisma'
import { getAccountTokenStats as getAccountTokenStatsRepo } from '../customer/account-token-repo'
import { processOutboxRow } from './process'
import {
  EMAIL_TEMPLATES,
  renderOrderConfirmation,
  renderPasswordReset,
  renderEmailVerification,
  type EmailTemplateId,
} from './templates'

/** No email provider is integrated. Honest single source of truth for the lifecycle. */
export const PROVIDER_CONFIGURED = false

export interface EnqueueEmailInput {
  template: EmailTemplateId
  subject: string
  /** Stored ONLY when already supplied by the order/customer; never invented. */
  recipientEmail?: string | null
  relatedType?: string | null
  relatedId?: string | null
}

/**
 * Records one outbox row as `queued`, then processes it once through the no-send
 * provider so it lands in an honest terminal state. Best-effort: any write/processing
 * failure is swallowed + logged (without payload) so it can never break the action that
 * triggered it — same discipline as the audit log. NO email is ever sent.
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<void> {
  try {
    const row = await prisma.emailOutbox.create({
      data: {
        template: input.template,
        status: 'queued',
        recipientEmail: input.recipientEmail ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        subject: input.subject,
      },
      select: { id: true },
    })
    // Process inline (no-send): moves the row to skipped_no_provider / failed_validation.
    await processOutboxRow(prisma, row.id)
  } catch (err) {
    console.error(
      `[email] failed to record/process outbox "${input.template}": ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }
}

/**
 * Convenience: record an order-confirmation email for an order. Best-effort; only an
 * already-supplied recipient email is stored. No email is sent (no provider).
 */
export async function enqueueOrderConfirmationEmail(
  orderCode: string,
  recipientEmail: string | null,
): Promise<void> {
  const { subject } = renderOrderConfirmation({ orderCode })
  await enqueueEmail({
    template: EMAIL_TEMPLATES.orderConfirmation,
    subject,
    recipientEmail,
    relatedType: 'order',
    relatedId: orderCode,
  })
}

/**
 * Records a password-reset email INTENT for a customer (Этап 60A). The hashed token
 * lives in CustomerAccountToken — it is NEVER placed in the outbox. With no provider the
 * row is terminal `skipped_no_provider`, so the reset link is never actually delivered.
 */
export async function enqueuePasswordResetEmail(
  customerId: string,
  recipientEmail: string | null,
): Promise<void> {
  const { subject } = renderPasswordReset()
  await enqueueEmail({
    template: EMAIL_TEMPLATES.passwordReset,
    subject,
    recipientEmail,
    relatedType: 'customer',
    relatedId: customerId,
  })
}

/** Records an email-verification INTENT for a customer (Этап 60A). No token in the row. */
export async function enqueueEmailVerificationEmail(
  customerId: string,
  recipientEmail: string | null,
): Promise<void> {
  const { subject } = renderEmailVerification()
  await enqueueEmail({
    template: EMAIL_TEMPLATES.emailVerification,
    subject,
    recipientEmail,
    relatedType: 'customer',
    relatedId: customerId,
  })
}

/** Recent outbox rows for the admin view. The BODY is never stored, so never shown. */
export async function getRecentEmailOutbox(limit = 50) {
  return prisma.emailOutbox.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      template: true,
      status: true,
      recipientEmail: true,
      relatedType: true,
      relatedId: true,
      subject: true,
      note: true,
      attempts: true,
      lastError: true,
      processedAt: true,
    },
  })
}

export type EmailOutboxRow = Awaited<ReturnType<typeof getRecentEmailOutbox>>[number]

/** Safe account-token counts (no token values) for the admin recovery/verification view. */
export function getAccountTokenStats() {
  return getAccountTokenStatsRepo(prisma)
}
