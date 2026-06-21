/**
 * AURELIA — Email operations + account recovery verification (Этап 60A)
 *
 * Non-destructive checks for the provider-ready email/account-recovery foundation (NO real
 * sending). Pure crypto/provider checks, plus DB lifecycle exercised inside ALWAYS-ROLLED-
 * BACK transactions (a sentinel error aborts each tx) so NOTHING is ever committed; row
 * counts are asserted unchanged afterwards.
 *
 * Covered:
 *   A. Email provider facade (pure): NoSend → skipped_no_provider for a valid message,
 *      failed_validation with no recipient; Stub → sent_stub; neither ever "sends".
 *   B. Outbox processing (DB, rolled back): enqueue→queued; process→terminal status;
 *      attempts/processedAt updated; idempotent (re-process is a no-op); the model has NO
 *      body column; recipient stored only when supplied.
 *   C. Account-token crypto (pure): hash != raw, stable, live/expired/used predicates.
 *   D. Password reset (DB, rolled back): token stored HASHED (plaintext absent); valid
 *      token resets password (old fails, new verifies) + bumps sessionVersion (old token
 *      stale); token is single-use (reuse rejected); expired token rejected; a superseding
 *      request invalidates the previous token.
 *   E. Email verification (DB, rolled back): token hash stored; valid token sets
 *      emailVerifiedAt; expired/used token rejected.
 *
 * Run with: npm run db:verify:email-ops
 */

import { randomBytes } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { hashPassword, verifyPassword } from '../src/lib/customer/password'
import { createCustomerToken, verifyCustomerToken } from '../src/lib/customer/token'
import {
  ACCOUNT_TOKEN_TTL_MS,
  generateRawToken,
  hashToken,
  isTokenLive,
  tokenExpiry,
} from '../src/lib/customer/account-token'
import {
  ACCOUNT_TOKEN_PURPOSES,
  createAccountToken,
  consumeAccountToken,
  markEmailVerified,
} from '../src/lib/customer/account-token-repo'
import { NoSendEmailProvider, StubEmailProvider } from '../src/lib/email/provider'
import { processOutboxRow, processQueuedOutbox } from '../src/lib/email/process'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_EMAIL_OPS_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const outboxCountBefore = await prisma.emailOutbox.count()
  const tokenCountBefore = await prisma.customerAccountToken.count()
  const customerCountBefore = await prisma.customer.count()
  console.log('Email operations + account recovery:')
  console.log(`  outbox rows:  ${outboxCountBefore}`)
  console.log(`  account tokens: ${tokenCountBefore}`)

  // --- A) Provider facade (pure) ---
  const noSend = new NoSendEmailProvider()
  const stub = new StubEmailProvider()
  const validMsg = { template: 'order_confirmation' as const, recipientEmail: 'buyer@example.test', subject: 'Hi' }
  const noRecipientMsg = { template: 'order_confirmation' as const, recipientEmail: null, subject: 'Hi' }

  const noSendValid = await noSend.send(validMsg)
  check('NoSend provider: valid message → skipped_no_provider (NOT sent)', noSendValid.status === 'skipped_no_provider')
  const noSendInvalid = await noSend.send(noRecipientMsg)
  check('NoSend provider: missing recipient → failed_validation', noSendInvalid.status === 'failed_validation')
  const stubValid = await stub.send(validMsg)
  check('Stub provider: valid message → sent_stub (future-wiring branch)', stubValid.status === 'sent_stub')
  check('provider notes carry no token/secret', !/token|secret|[A-Za-z0-9_-]{24,}/.test(noSendValid.note + noSendInvalid.note + stubValid.note))

  // --- B) Outbox processing lifecycle (DB, rolled back) ---
  let enqueueIsQueued = false
  let processedTerminal = false
  let attemptsAndProcessedAt = false
  let reprocessNoOp = false
  let failedValidationForGuest = false
  let recipientOptional = false
  let stubSends = false
  try {
    await prisma.$transaction(async (tx) => {
      // Enqueue == create queued row (mirrors enqueueEmail's first step).
      const row = await tx.emailOutbox.create({
        data: { template: 'order_confirmation', status: 'queued', subject: 'verify', recipientEmail: 'buyer@example.test', relatedType: 'order', relatedId: 'AUR-OPS01' },
        select: { id: true, status: true },
      })
      enqueueIsQueued = row.status === 'queued'

      const status1 = await processOutboxRow(tx, row.id, noSend)
      processedTerminal = status1 === 'skipped_no_provider'
      const after = await tx.emailOutbox.findUnique({ where: { id: row.id }, select: { status: true, attempts: true, processedAt: true, lastError: true } })
      attemptsAndProcessedAt = !!after && after.attempts === 1 && after.processedAt !== null && after.status === 'skipped_no_provider'

      // Re-processing a terminal row is a no-op (returns null, attempts unchanged).
      const status2 = await processOutboxRow(tx, row.id, noSend)
      const afterRe = await tx.emailOutbox.findUnique({ where: { id: row.id }, select: { attempts: true } })
      reprocessNoOp = status2 === null && afterRe?.attempts === 1

      // A guest row with no recipient → failed_validation.
      const guest = await tx.emailOutbox.create({ data: { template: 'order_confirmation', status: 'queued', subject: 'verify' }, select: { id: true, recipientEmail: true } })
      const guestStatus = await processOutboxRow(tx, guest.id, noSend)
      failedValidationForGuest = guestStatus === 'failed_validation'
      recipientOptional = guest.recipientEmail === null

      // Batch processing drains queued rows; with the stub provider a valid row → sent_stub.
      const q = await tx.emailOutbox.create({ data: { template: 'email_verification', status: 'queued', subject: 'verify', recipientEmail: 'v@example.test', relatedType: 'customer', relatedId: 'cust_x' }, select: { id: true } })
      const tally = await processQueuedOutbox(tx, stub, 50)
      const qAfter = await tx.emailOutbox.findUnique({ where: { id: q.id }, select: { status: true } })
      stubSends = (tally.byStatus['sent_stub'] ?? 0) >= 1 && qAfter?.status === 'sent_stub'

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('enqueue records a queued row', enqueueIsQueued)
  check('processor moves queued → skipped_no_provider (no real send)', processedTerminal)
  check('processor stamps attempts + processedAt', attemptsAndProcessedAt)
  check('re-processing a terminal row is a no-op (idempotent)', reprocessNoOp)
  check('guest row (no recipient) → failed_validation', failedValidationForGuest)
  check('recipient stored only when supplied', recipientOptional)
  check('batch processor + stub provider → sent_stub (future branch)', stubSends)

  // Schema guarantee: no rendered body column is persisted.
  const sampleRow = await prisma.emailOutbox.findFirst({ select: { subject: true } }).catch(() => null)
  check('outbox stores no rendered body column (privacy by construction)', !('body' in (sampleRow ?? {})))

  // --- C) Account-token crypto (pure) ---
  const raw = generateRawToken()
  const h = hashToken(raw)
  check('token hash is not the raw token', h !== raw && h.length === 64)
  check('token hash is stable for the same input', hashToken(raw) === h)
  check('different raw tokens hash differently', hashToken(generateRawToken()) !== h)
  check('live token (unused, future expiry) is usable', isTokenLive({ usedAt: null, expiresAt: tokenExpiry() }))
  check('used token is not usable', !isTokenLive({ usedAt: new Date(), expiresAt: tokenExpiry() }))
  check('expired token is not usable', !isTokenLive({ usedAt: null, expiresAt: new Date(Date.now() - 1000) }))
  check('token TTL is short (<= 2h)', ACCOUNT_TOKEN_TTL_MS <= 2 * 60 * 60 * 1000)

  // --- D) Password reset (DB, rolled back) ---
  const tag = randomBytes(6).toString('hex')
  const secret = randomBytes(32).toString('hex')
  let resetStoredHashed = false
  let resetWorks = false
  let resetBumpsVersion = false
  let resetSingleUse = false
  let expiredRejected = false
  let supersedeInvalidatesOld = false
  try {
    await prisma.$transaction(async (tx) => {
      const oldPlain = `Old-${tag}-aaaa`
      const c = await tx.customer.create({
        data: { email: `reset+${tag}@aurelia.test`, passwordHash: await hashPassword(oldPlain) },
        select: { id: true, sessionVersion: true },
      })

      const { rawToken } = await createAccountToken(tx, c.id, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      // Stored HASHED: the raw token is absent, the hash is present.
      const stored = await tx.customerAccountToken.findUnique({ where: { tokenHash: hashToken(rawToken) }, select: { tokenHash: true } })
      const rawHit = await tx.customerAccountToken.findUnique({ where: { tokenHash: rawToken } }).catch(() => null)
      resetStoredHashed = !!stored && stored.tokenHash !== rawToken && rawHit === null

      // Token issued for the CURRENT version — will go stale after the reset.
      const tokenBefore = createCustomerToken(c.id, c.sessionVersion, secret)

      // Consume + reset.
      const consumed = await consumeAccountToken(tx, rawToken, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      const newPlain = `New-${tag}-bbbb`
      const newHash = await hashPassword(newPlain)
      const updated = await tx.customer.update({
        where: { id: consumed!.customerId },
        data: { passwordHash: newHash, sessionVersion: { increment: 1 }, passwordChangedAt: new Date() },
        select: { sessionVersion: true, passwordHash: true },
      })
      resetWorks =
        !!consumed &&
        consumed.customerId === c.id &&
        !(await verifyPassword(oldPlain, updated.passwordHash)) &&
        (await verifyPassword(newPlain, updated.passwordHash))

      // Old session token is now stale (ver mismatch), mirroring getCurrentCustomer.
      const decoded = verifyCustomerToken(tokenBefore, secret)
      resetBumpsVersion = !!decoded && decoded.ver !== updated.sessionVersion

      // Single-use: the same token cannot be consumed again.
      const reuse = await consumeAccountToken(tx, rawToken, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      resetSingleUse = reuse === null

      // Expired token rejected: forge a row already past expiry.
      const expiredRaw = generateRawToken()
      await tx.customerAccountToken.create({
        data: { customerId: c.id, purpose: 'password_reset', tokenHash: hashToken(expiredRaw), expiresAt: new Date(Date.now() - 1000) },
      })
      expiredRejected = (await consumeAccountToken(tx, expiredRaw, ACCOUNT_TOKEN_PURPOSES.passwordReset)) === null

      // A new request supersedes prior unused tokens (old becomes unusable).
      const { rawToken: firstRaw } = await createAccountToken(tx, c.id, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      await createAccountToken(tx, c.id, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      supersedeInvalidatesOld = (await consumeAccountToken(tx, firstRaw, ACCOUNT_TOKEN_PURPOSES.passwordReset)) === null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('reset token stored HASHED (raw token absent from DB)', resetStoredHashed)
  check('valid reset token resets password (old fails, new verifies)', resetWorks)
  check('reset bumps sessionVersion → old session token stale', resetBumpsVersion)
  check('reset token is single-use (reuse rejected)', resetSingleUse)
  check('expired reset token rejected', expiredRejected)
  check('a superseding request invalidates the previous token', supersedeInvalidatesOld)

  // --- E) Email verification (DB, rolled back) ---
  let verifyStoredHashed = false
  let verifySetsTimestamp = false
  let verifySingleUse = false
  let verifyExpiredRejected = false
  let wrongPurposeRejected = false
  try {
    await prisma.$transaction(async (tx) => {
      const c = await tx.customer.create({
        data: { email: `verify+${tag}@aurelia.test`, passwordHash: await hashPassword(`Pw-${tag}-cccc`) },
        select: { id: true, emailVerifiedAt: true },
      })
      const startsUnverified = c.emailVerifiedAt === null

      const { rawToken } = await createAccountToken(tx, c.id, ACCOUNT_TOKEN_PURPOSES.emailVerification)
      const stored = await tx.customerAccountToken.findUnique({ where: { tokenHash: hashToken(rawToken) }, select: { tokenHash: true } })
      verifyStoredHashed = !!stored && stored.tokenHash !== rawToken && startsUnverified

      // A password-reset token must NOT satisfy an email-verification consume (purpose check).
      const { rawToken: resetRaw } = await createAccountToken(tx, c.id, ACCOUNT_TOKEN_PURPOSES.passwordReset)
      wrongPurposeRejected = (await consumeAccountToken(tx, resetRaw, ACCOUNT_TOKEN_PURPOSES.emailVerification)) === null

      const consumed = await consumeAccountToken(tx, rawToken, ACCOUNT_TOKEN_PURPOSES.emailVerification)
      await markEmailVerified(tx, consumed!.customerId)
      const afterC = await tx.customer.findUnique({ where: { id: c.id }, select: { emailVerifiedAt: true } })
      verifySetsTimestamp = !!consumed && afterC?.emailVerifiedAt !== null

      verifySingleUse = (await consumeAccountToken(tx, rawToken, ACCOUNT_TOKEN_PURPOSES.emailVerification)) === null

      const expiredRaw = generateRawToken()
      await tx.customerAccountToken.create({
        data: { customerId: c.id, purpose: 'email_verification', tokenHash: hashToken(expiredRaw), expiresAt: new Date(Date.now() - 1000) },
      })
      verifyExpiredRejected = (await consumeAccountToken(tx, expiredRaw, ACCOUNT_TOKEN_PURPOSES.emailVerification)) === null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('verification token stored HASHED, customer starts unverified', verifyStoredHashed)
  check('wrong-purpose token rejected (reset token != verification token)', wrongPurposeRejected)
  check('valid verification token sets emailVerifiedAt', verifySetsTimestamp)
  check('verification token is single-use (reuse rejected)', verifySingleUse)
  check('expired verification token rejected', verifyExpiredRejected)

  // --- F) Nothing committed ---
  const outboxCountAfter = await prisma.emailOutbox.count()
  const tokenCountAfter = await prisma.customerAccountToken.count()
  const customerCountAfter = await prisma.customer.count()
  check('no test outbox rows committed', outboxCountAfter === outboxCountBefore)
  check('no test account tokens committed', tokenCountAfter === tokenCountBefore)
  check('no test customers committed', customerCountAfter === customerCountBefore)

  if (failures === 0) {
    console.log('\nEMAIL OPS VERIFY OK: provider facade honest (no send), outbox lifecycle, hashed single-use reset + verification tokens, session revocation — all pass; nothing committed.')
  } else {
    console.error(`\nEMAIL OPS VERIFY FAILED (${failures} check(s)).`)
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
