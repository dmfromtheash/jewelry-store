/**
 * AURELIA — Admin audit log verification (Этап 21A)
 *
 * Non-destructive check for the AdminAuditLog table:
 *   - the model is accessible (count succeeds)
 *   - the write path works, exercised inside a transaction that is ALWAYS rolled
 *     back (a sentinel error aborts it) — so NO audit row is ever committed.
 *
 * No deleteMany, no raw SQL, no committed test data. Read-mostly + rollback.
 *
 * Run with: npm run db:verify:audit-log
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const ROLLBACK_SENTINEL = '__AURELIA_AUDIT_SMOKE_ROLLBACK__'

async function main() {
  const count = await prisma.adminAuditLog.count()

  console.log('Admin audit log:')
  console.log(`  events: ${count}`)

  // Exercise the write path WITHOUT committing.
  let writePathOk = false
  try {
    await prisma.$transaction(async (tx) => {
      await tx.adminAuditLog.create({
        data: {
          actor: 'smoke-test',
          action: 'admin.smoke.check',
          success: true,
          summary: 'smoke-test (rolled back)',
        },
      })
      throw new Error(ROLLBACK_SENTINEL)
    })
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK_SENTINEL) {
      writePathOk = true // transaction rolled back as intended
    } else {
      throw e
    }
  }

  const countAfter = await prisma.adminAuditLog.count()
  const committedNothing = countAfter === count

  console.log(`  write-path (rolled back): ${writePathOk ? 'OK' : 'FAIL'}`)
  console.log(`  no test data committed:   ${committedNothing ? 'OK' : 'FAIL'}`)

  if (writePathOk && committedNothing) {
    console.log('\nAUDIT LOG VERIFY OK: table accessible; write path works (rolled back).')
  } else {
    console.error('\nAUDIT LOG VERIFY FAILED')
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
