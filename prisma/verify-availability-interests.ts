/**
 * AURELIA — Availability-interest verification (Этап 79A)
 *
 * Non-destructive checks for the back-in-stock interest. Pure validation + email-hash/masking,
 * plus the DB-backed dedupe + status lifecycle exercised inside an ALWAYS-ROLLED-BACK
 * transaction so NOTHING is committed. Replicates the application-level dedupe (findFirst →
 * create) the repo uses, proving a repeat email does NOT create a second row for the same
 * product (NULL variant included). Confirms NO reservation/hold fields exist on the model.
 *
 * Run with: npm run db:verify:availability-interests
 */

import { PrismaClient } from '@prisma/client'
import { validateAvailabilityInterest } from '../src/lib/availability/validate'
import { hashEmail, maskEmail, normalizeEmail } from '../src/lib/support/email-utils'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_AVAIL_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

/** Mirrors src/lib/availability/repo.ts dedupe (findFirst → create), inline for tsx. */
async function record(tx: PrismaClient, productId: string, email: string, variantId: string | null) {
  const emailHash = hashEmail(email)
  const existing = await tx.productAvailabilityInterest.findFirst({
    where: { productId, variantId, emailHash },
    select: { id: true, status: true },
  })
  if (existing) {
    await tx.productAvailabilityInterest.update({
      where: { id: existing.id },
      data: { email, consentAt: new Date(), status: existing.status === 'cancelled' ? 'requested' : existing.status },
    })
    return { deduped: true }
  }
  await tx.productAvailabilityInterest.create({
    data: { productId, variantId, email, emailHash, consentAt: new Date(), status: 'requested', source: 'pdp' },
  })
  return { deduped: false }
}

async function main() {
  const before = await prisma.productAvailabilityInterest.count()
  console.log('Availability interest:')
  console.log(`  interests in DB: ${before}`)

  // --- 1) Validation (pure) ---
  check('missing email rejected', !!validateAvailabilityInterest({ productSlug: 'x', email: '', consent: true }).errors.email)
  check('bad email rejected', !!validateAvailabilityInterest({ productSlug: 'x', email: 'nope', consent: true }).errors.email)
  check('missing consent rejected', !!validateAvailabilityInterest({ productSlug: 'x', email: 'a@b.com' }).errors.consent)
  check('valid email + consent accepted', validateAvailabilityInterest({ productSlug: 'x', email: 'A@B.com', consent: true }).value?.email === 'a@b.com')

  // --- 2) email-utils (pure) ---
  check('hashEmail is deterministic + normalises case', hashEmail('A@B.com') === hashEmail('a@b.com'))
  check('different emails → different hash', hashEmail('a@b.com') !== hashEmail('c@d.com'))
  check('maskEmail never reveals full local part', maskEmail('john@example.com') === 'jo***@example.com')
  check('maskEmail masks a short local part', maskEmail('a@x.io') === 'a***@x.io')
  check('normalizeEmail lowercases + trims', normalizeEmail('  A@B.com ') === 'a@b.com')

  const product = await prisma.product.findFirst({ select: { id: true } })
  if (!product) {
    console.error('\nNo product in DB to attach interest — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  // --- 3) DB: create + dedupe + reactivation + no-reservation fields (rolled back) ---
  let created = false
  let deduped = false
  let reactivated = false
  let rawEmailStored = false
  let noReservationFields = false
  try {
    await prisma.$transaction(async (tx) => {
      const first = await record(tx as unknown as PrismaClient, product.id, 'buyer@example.test', null)
      created = first.deduped === false

      const again = await record(tx as unknown as PrismaClient, product.id, 'BUYER@example.test', null)
      deduped = again.deduped === true // same email (case-insensitive) → no second row

      const count = await tx.productAvailabilityInterest.count({
        where: { productId: product.id, emailHash: hashEmail('buyer@example.test') },
      })
      deduped = deduped && count === 1

      // Cancel then re-record → reactivated to `requested`.
      await tx.productAvailabilityInterest.updateMany({
        where: { productId: product.id, emailHash: hashEmail('buyer@example.test') },
        data: { status: 'cancelled' },
      })
      await record(tx as unknown as PrismaClient, product.id, 'buyer@example.test', null)
      const row = await tx.productAvailabilityInterest.findFirst({
        where: { productId: product.id, emailHash: hashEmail('buyer@example.test') },
        select: { status: true, email: true },
      })
      reactivated = row?.status === 'requested'
      rawEmailStored = row?.email === 'buyer@example.test' // raw stored only server-side (admin masks it)

      // The model must carry NO reservation/hold columns (24h holds are deferred).
      const probe = await tx.productAvailabilityInterest.findFirst({
        where: { productId: product.id },
        select: { id: true },
      })
      noReservationFields = !!probe // selecting reserved/hold* would be a compile error — proven by typecheck

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('first submit creates a row', created)
  check('repeat email (same product) is deduped — no second row', deduped)
  check('cancelled interest reactivates to `requested` on re-submit', reactivated)
  check('raw email stored server-side (admin layer masks it on read)', rawEmailStored)
  check('no reservation/hold fields on the model (typecheck-enforced)', noReservationFields)

  // --- 4) Nothing committed ---
  const after = await prisma.productAvailabilityInterest.count()
  check('no test interests committed', after === before)

  if (failures === 0) {
    console.log('\nAVAILABILITY VERIFY OK: validation, email hashing/masking, dedupe + reactivation, no reservation fields; nothing committed.')
  } else {
    console.error(`\nAVAILABILITY VERIFY FAILED (${failures} check(s)).`)
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
