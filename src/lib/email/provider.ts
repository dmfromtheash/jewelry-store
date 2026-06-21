/**
 * AURELIA — Email provider facade (Этап 60A) — NO REAL SENDING
 *
 * A clean adapter boundary for "actually delivering an email", so the rest of the app
 * (the outbox processor) talks to ONE interface and never knows which backend is wired.
 * Today only SAFE local backends exist — nothing here contacts SMTP / SendGrid / Mailgun
 * / any external service, holds credentials, or reads secrets.
 *
 *   - NoSendEmailProvider  (DEFAULT): the honest production-of-today behaviour. It
 *     validates the message and then records the intent WITHOUT sending — returning
 *     `failed_validation` (e.g. no recipient) or `skipped_no_provider` (deliverable, but
 *     there is no provider to deliver it).
 *   - StubEmailProvider: returns `sent_stub` for a valid message. It STILL sends nothing
 *     — it only exists to exercise the "a provider accepted it" branch in the verify
 *     script + to document the future shape. It is never the default.
 *
 * ── FUTURE REAL PROVIDER (owner-gated) ─────────────────────────────────────────────
 * To wire a real provider later: implement `EmailProvider.send` against that provider's
 * SDK/HTTP API in a NEW file (e.g. `provider-smtp.ts`), read its credentials from the
 * environment THERE, flip `PROVIDER_CONFIGURED` (src/lib/email/outbox.ts) and return
 * `getEmailProvider()` → the real adapter below. NOTE: message bodies are intentionally
 * NOT persisted (privacy), so a real adapter must RE-RENDER the body from the related
 * entity at send time using the renderers in ./templates. No other module changes.
 */

import type { EmailTemplateId } from './templates'

/** Honest outcome of a (non-)send. Values double as machine notes; the first three map
 *  1:1 onto the `EmailOutboxStatus` enum values used by the processor. */
export type EmailSendStatus =
  | 'sent_stub' // a provider accepted it (STUB — still nothing left the building)
  | 'skipped_no_provider' // deliverable, but no provider is configured → not sent
  | 'failed_validation' // the message itself is not deliverable (e.g. no recipient)

export interface EmailSendResult {
  status: EmailSendStatus
  /** Short, SAFE machine note. NEVER a secret/token/body/raw provider payload. */
  note: string
}

/** The minimal, SAFE shape a provider needs. Deliberately carries NO message body and
 *  NO token/secret — only the already-stored, safe outbox fields. */
export interface EmailMessage {
  template: EmailTemplateId
  recipientEmail: string | null
  subject: string
}

export interface EmailProvider {
  /** Stable id for logs/admin (e.g. "no-send"). Not a secret. */
  readonly id: string
  send(message: EmailMessage): Promise<EmailSendResult>
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Shared, conservative deliverability validation (no recipient = not deliverable). */
function validateMessage(message: EmailMessage): EmailSendResult | null {
  const to = (message.recipientEmail ?? '').trim()
  if (!to || to.length > 320 || !EMAIL_RE.test(to)) {
    return { status: 'failed_validation', note: 'missing or invalid recipient' }
  }
  if (!message.subject.trim()) {
    return { status: 'failed_validation', note: 'missing subject' }
  }
  return null
}

/**
 * DEFAULT provider. Validates, then records the intent WITHOUT sending. This is the only
 * provider the app uses today (PROVIDER_CONFIGURED is false) — it is honest by
 * construction: a deliverable message is `skipped_no_provider`, never "sent".
 */
export class NoSendEmailProvider implements EmailProvider {
  readonly id = 'no-send'
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const invalid = validateMessage(message)
    if (invalid) return invalid
    return { status: 'skipped_no_provider', note: 'no email provider configured' }
  }
}

/**
 * STUB provider for the future-wiring branch (verify only). Returns `sent_stub` for a
 * valid message but STILL sends nothing — it never opens a socket or reads a credential.
 */
export class StubEmailProvider implements EmailProvider {
  readonly id = 'stub'
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const invalid = validateMessage(message)
    if (invalid) return invalid
    return { status: 'sent_stub', note: 'accepted by stub provider (nothing actually sent)' }
  }
}

/** The single source of the active provider. No provider is configured → NoSend. The
 *  future real adapter plugs in HERE (see the file header). */
export function getEmailProvider(): EmailProvider {
  return new NoSendEmailProvider()
}
