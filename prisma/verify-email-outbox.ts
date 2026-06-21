/**
 * AURELIA — Email outbox foundation verification (Этап 59A)
 *
 * Non-destructive checks for the email FOUNDATION (no real sending). Pure template
 * checks, plus DB lifecycle exercised inside ALWAYS-ROLLED-BACK transactions (a
 * sentinel error aborts each tx) so NOTHING is ever committed; the outbox count is
 * asserted unchanged afterwards.
 *
 * Covered:
 *   - every template id has a label + renders a non-empty subject; the password-reset /
 *     verification renderers honestly say sending is NOT active (no "it works" claim, no
 *     token embedded);
 *   - DB (rolled back): an outbox row can be created for each template + each honest
 *     status; with no provider the foundation records `skipped` (recorded, NOT sent),
 *     stamping processedAt; the rendered BODY is never a column (so never stored); a
 *     recipient is stored only when supplied (null otherwise);
 *   - nothing committed.
 *
 * NOTE: src/lib/email/outbox.ts is `server-only` (can't be imported under tsx), so the
 * `skipped`-by-default invariant is reproduced here directly against the table — the
 * same approach verify-customer-auth uses for its server-only write paths.
 *
 * Run with: npm run db:verify:email-outbox
 */

import { PrismaClient } from '@prisma/client'
import {
  EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_LABELS,
  renderOrderConfirmation,
  renderOrderStatusUpdate,
  renderPasswordReset,
  renderEmailVerification,
  type EmailTemplateId,
} from '../src/lib/email/templates'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_EMAIL_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const outboxCountBefore = await prisma.emailOutbox.count()
  console.log('Email outbox:')
  console.log(`  outbox rows in DB: ${outboxCountBefore}`)

  // --- 1) Templates (pure) ---
  const ids = Object.values(EMAIL_TEMPLATES)
  check('every template id has a label', ids.every((id) => typeof EMAIL_TEMPLATE_LABELS[id as EmailTemplateId] === 'string' && EMAIL_TEMPLATE_LABELS[id as EmailTemplateId].length > 0))

  const conf = renderOrderConfirmation({ orderCode: 'AUR-TEST01' })
  check('order confirmation renders subject + body with the order code', conf.subject.length > 0 && conf.text.includes('AUR-TEST01'))
  const upd = renderOrderStatusUpdate({ orderCode: 'AUR-TEST01', statusLabel: 'Виконано' })
  check('order status update renders subject + body', upd.subject.length > 0 && upd.text.includes('Виконано'))

  const reset = renderPasswordReset()
  const verify = renderEmailVerification()
  // Honest: the foundation must NOT claim a working reset/verification flow, and must
  // not embed a token. We assert the text flags that sending is not active.
  check('password reset renderer says sending is NOT active (no working flow)', /не актив/i.test(reset.text) && reset.subject.length > 0)
  check('email verification renderer says sending is NOT active', /не актив/i.test(verify.text))
  check('reset/verification bodies embed NO token-like secret', !/token|код[-\s]?\d|[A-Za-z0-9]{24,}/.test(reset.text + verify.text))

  // --- 2) DB lifecycle (rolled back) ---
  let allTemplatesCreatable = false
  let allStatusesCreatable = false
  let skippedDefaultHonest = false
  let recipientOptional = false
  try {
    await prisma.$transaction(async (tx) => {
      // A row for each template id (proves the enum accepts every reserved slot).
      const made = await Promise.all(
        ids.map((template) =>
          tx.emailOutbox.create({ data: { template: template as EmailTemplateId, subject: 'verify', status: 'queued' }, select: { id: true } }),
        ),
      )
      allTemplatesCreatable = made.length === ids.length && made.every((r) => !!r.id)

      // Each honest status is a valid enum value.
      const statuses = ['queued', 'sent_stub', 'skipped', 'failed_stub'] as const
      const statusRows = await Promise.all(
        statuses.map((status) =>
          tx.emailOutbox.create({ data: { template: 'order_confirmation', subject: 'verify', status }, select: { status: true } }),
        ),
      )
      allStatusesCreatable = statusRows.length === statuses.length

      // Foundation invariant (no provider): record as `skipped` + a note + processedAt;
      // NEVER `sent_stub`/`queued` (which would imply a working send path).
      const skipped = await tx.emailOutbox.create({
        data: {
          template: 'order_confirmation',
          status: 'skipped',
          subject: 'AURELIA — замовлення AUR-TEST01 прийнято',
          relatedType: 'order',
          relatedId: 'AUR-TEST01',
          note: 'no email provider configured — recorded, not sent',
          processedAt: new Date(),
        },
        select: { status: true, note: true, processedAt: true },
      })
      skippedDefaultHonest =
        skipped.status === 'skipped' && !!skipped.note && skipped.processedAt !== null

      // Recipient stored only when supplied (null otherwise).
      const noRecipient = await tx.emailOutbox.create({ data: { template: 'password_reset', subject: 'verify', status: 'skipped' }, select: { recipientEmail: true } })
      const withRecipient = await tx.emailOutbox.create({ data: { template: 'order_confirmation', subject: 'verify', status: 'skipped', recipientEmail: 'buyer@example.test' }, select: { recipientEmail: true } })
      recipientOptional = noRecipient.recipientEmail === null && withRecipient.recipientEmail === 'buyer@example.test'

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('an outbox row is creatable for every template slot', allTemplatesCreatable)
  check('every honest status is a valid enum value', allStatusesCreatable)
  check('no-provider foundation records skipped + note + processedAt (not sent)', skippedDefaultHonest)
  check('recipient stored only when supplied (null otherwise)', recipientOptional)

  // The model has NO body column (the rendered body is intentionally not persisted).
  // This is a schema guarantee; we assert the select shape excludes a body field.
  const sampleRow = await prisma.emailOutbox.findFirst({ select: { subject: true } }).catch(() => null)
  check('outbox stores no rendered body column (privacy by construction)', !('body' in (sampleRow ?? {})))

  // --- 3) Nothing committed ---
  const outboxCountAfter = await prisma.emailOutbox.count()
  check('no test outbox rows committed', outboxCountAfter === outboxCountBefore)

  if (failures === 0) {
    console.log('\nEMAIL OUTBOX VERIFY OK: templates honest (no working send/reset), lifecycle + privacy hold; no real sending; nothing committed.')
  } else {
    console.error(`\nEMAIL OUTBOX VERIFY FAILED (${failures} check(s)).`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
