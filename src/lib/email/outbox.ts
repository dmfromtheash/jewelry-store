/**
 * AURELIA — Email outbox (Этап 59A) — FOUNDATION, NO REAL SENDING
 *
 * Records intended emails into the `EmailOutbox` table for future provider wiring +
 * admin visibility. It does NOT integrate any provider (SendGrid / Mailgun / SMTP),
 * holds NO credentials, reads NO secrets, and never contacts a mail server.
 *
 * Honest lifecycle: because no provider is configured, every enqueue is recorded as
 * `skipped` with a machine note — it is NEVER reported as sent. When a provider is
 * later wired (owner-gated), `PROVIDER_CONFIGURED` flips and rows would start as
 * `queued` for a real send step. The `sent_stub` / `failed_stub` states exist for that
 * future and are exercised by the verify script only.
 *
 * Privacy: only a template id, status, short subject, optional machine note, and a
 * loose (no-FK) related ref are stored. The rendered BODY is never stored, and NO
 * token/secret/reset-code is ever stored here.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import {
  EMAIL_TEMPLATES,
  renderOrderConfirmation,
  type EmailTemplateId,
} from './templates'

/** No email provider is integrated. Honest single source of truth for the lifecycle. */
export const PROVIDER_CONFIGURED = false

const NO_PROVIDER_NOTE = 'no email provider configured — recorded, not sent'

export interface EnqueueEmailInput {
  template: EmailTemplateId
  subject: string
  /** Stored ONLY when already supplied by the order/customer; never invented. */
  recipientEmail?: string | null
  relatedType?: string | null
  relatedId?: string | null
  note?: string | null
}

/**
 * Records one outbox row. Best-effort: a write failure is swallowed + logged (without
 * payload) so it can never break the action that triggered it — same discipline as the
 * audit log. With no provider, the row is terminal `skipped` (recorded, not sent).
 */
export async function enqueueEmail(input: EnqueueEmailInput): Promise<void> {
  try {
    await prisma.emailOutbox.create({
      data: {
        template: input.template,
        status: PROVIDER_CONFIGURED ? 'queued' : 'skipped',
        recipientEmail: input.recipientEmail ?? null,
        relatedType: input.relatedType ?? null,
        relatedId: input.relatedId ?? null,
        subject: input.subject,
        note: input.note ?? (PROVIDER_CONFIGURED ? null : NO_PROVIDER_NOTE),
        processedAt: PROVIDER_CONFIGURED ? null : new Date(),
      },
    })
  } catch (err) {
    console.error(
      `[email] failed to record outbox "${input.template}": ${err instanceof Error ? err.message : 'unknown error'}`,
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
      processedAt: true,
    },
  })
}

export type EmailOutboxRow = Awaited<ReturnType<typeof getRecentEmailOutbox>>[number]
