/**
 * AURELIA — Email outbox processor (Этап 60A) — NO REAL SENDING
 *
 * Drains `queued` outbox rows through the email PROVIDER facade (./provider) and records
 * an honest terminal status. Over an INJECTABLE Prisma client (PrismaClient |
 * TransactionClient) so the verify script can run the real lifecycle inside an
 * always-rolled-back transaction, and the `email:process:stub` CLI + the server-only
 * `enqueueEmail` can run it against the live DB. NOT `server-only`.
 *
 * With the default NoSendEmailProvider nothing is ever sent: a deliverable row becomes
 * `skipped_no_provider`, an undeliverable one (no recipient) `failed_validation`. The
 * rendered body is never read (it is never stored) and no token/secret is ever touched.
 */

import type { Prisma, PrismaClient } from '@prisma/client'
import { getEmailProvider, type EmailProvider, type EmailSendResult } from './provider'

export type OutboxClient = PrismaClient | Prisma.TransactionClient

/** Provider result status → EmailOutboxStatus enum value (1:1 for the values we use). */
type TerminalStatus = 'sent_stub' | 'skipped_no_provider' | 'failed_validation'

function isTerminal(status: EmailSendResult['status']): status is TerminalStatus {
  return (
    status === 'sent_stub' ||
    status === 'skipped_no_provider' ||
    status === 'failed_validation'
  )
}

/**
 * Processes ONE outbox row by id: only acts on a `queued` row (terminal rows are left
 * untouched, so re-running is safe + idempotent). Calls the provider with the SAFE stored
 * fields only, then stamps the terminal status, increments `attempts`, sets `processedAt`
 * and a short safe `lastError`/note. Returns the resulting status, or null if the row was
 * absent / not queued.
 */
export async function processOutboxRow(
  client: OutboxClient,
  id: string,
  provider: EmailProvider = getEmailProvider(),
): Promise<EmailSendResult['status'] | null> {
  const row = await client.emailOutbox.findUnique({
    where: { id },
    select: { id: true, status: true, template: true, recipientEmail: true, subject: true },
  })
  if (!row || row.status !== 'queued') return null

  const result = await provider.send({
    template: row.template,
    recipientEmail: row.recipientEmail,
    subject: row.subject,
  })
  if (!isTerminal(result.status)) return null

  await client.emailOutbox.update({
    where: { id: row.id },
    data: {
      status: result.status,
      attempts: { increment: 1 },
      processedAt: new Date(),
      note: result.note,
      // `lastError` carries the safe note only for the non-success outcomes.
      lastError: result.status === 'sent_stub' ? null : result.note,
    },
  })
  return result.status
}

/**
 * Processes up to `limit` oldest `queued` rows. Returns a per-status tally. Each row is
 * processed independently; one failure never aborts the batch. Used by the
 * `email:process:stub` CLI; the live path processes one row inline at enqueue time.
 */
export async function processQueuedOutbox(
  client: OutboxClient,
  provider: EmailProvider = getEmailProvider(),
  limit = 100,
): Promise<{ processed: number; byStatus: Record<string, number> }> {
  const queued = await client.emailOutbox.findMany({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true },
  })

  const byStatus: Record<string, number> = {}
  let processed = 0
  for (const { id } of queued) {
    const status = await processOutboxRow(client, id, provider)
    if (status) {
      byStatus[status] = (byStatus[status] ?? 0) + 1
      processed++
    }
  }
  return { processed, byStatus }
}
