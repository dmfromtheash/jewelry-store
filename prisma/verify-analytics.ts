/**
 * AURELIA — Analytics event verification (Этап 23A)
 *
 * Non-destructive check for the analytics foundation:
 *   - the pure taxonomy helpers work (accept valid names, reject unknown ones,
 *     strip forbidden/PII payload keys) — verified WITHOUT touching the DB;
 *   - the AnalyticsEvent table is accessible (count);
 *   - the write path works, exercised inside a transaction that is ALWAYS rolled
 *     back (a sentinel error aborts it) — so NO event is ever committed.
 *
 * No deleteMany, no raw SQL, no committed test data. Read-mostly + rollback.
 *
 * Run with: npm run db:verify:analytics
 */

import { PrismaClient } from '@prisma/client'
import {
  ANALYTICS_EVENTS,
  normalizeEventName,
  sanitizePayload,
} from '../src/lib/analytics/events'

const prisma = new PrismaClient()
const ROLLBACK_SENTINEL = '__AURELIA_ANALYTICS_SMOKE_ROLLBACK__'

function checkHelpers(): string[] {
  const problems: string[] = []

  // 1) Valid names are accepted + normalized.
  if (normalizeEventName('  PRODUCT_VIEW ') !== ANALYTICS_EVENTS.productView) {
    problems.push('normalizeEventName failed to accept/normalize a valid name')
  }
  // 2) Unknown names are rejected.
  if (normalizeEventName('totally_made_up_event') !== null) {
    problems.push('normalizeEventName failed to reject an unknown name')
  }
  // 3) Forbidden/PII keys are stripped; safe keys are kept.
  const sanitized = sanitizePayload({
    itemCount: 2,
    errorType: 'validation',
    password: 'secret',
    email: 'a@b.com',
    customerName: 'John Doe',
    phone: '+70000000000',
    sessionToken: 'abc',
  })
  const keptKeys = Object.keys(sanitized ?? {}).sort()
  const expected = ['errorType', 'itemCount']
  if (JSON.stringify(keptKeys) !== JSON.stringify(expected)) {
    problems.push(`sanitizePayload kept unexpected keys: ${JSON.stringify(keptKeys)}`)
  }
  // 4) Nested objects are dropped (no deep PII smuggling).
  const nested = sanitizePayload({ ok: 1, nested: { phone: 'x' } })
  if (nested && 'nested' in nested) {
    problems.push('sanitizePayload kept a nested object')
  }

  return problems
}

async function main() {
  const helperProblems = checkHelpers()

  console.log('Analytics foundation:')
  console.log(`  taxonomy helpers: ${helperProblems.length === 0 ? 'OK' : 'FAIL'}`)
  for (const p of helperProblems) console.log(`    - ${p}`)

  const count = await prisma.analyticsEvent.count()
  console.log(`  events: ${count}`)

  // Exercise the write path WITHOUT committing.
  let writePathOk = false
  try {
    await prisma.$transaction(async (tx) => {
      await tx.analyticsEvent.create({
        data: {
          eventName: ANALYTICS_EVENTS.pageView,
          anonymousSessionId: 'smoke00000000000000000000000000',
          pagePath: '/smoke',
          payload: { smoke: true },
        },
      })
      throw new Error(ROLLBACK_SENTINEL)
    })
  } catch (e) {
    if (e instanceof Error && e.message === ROLLBACK_SENTINEL) {
      writePathOk = true // rolled back as intended
    } else {
      throw e
    }
  }

  const countAfter = await prisma.analyticsEvent.count()
  const committedNothing = countAfter === count

  console.log(`  write-path (rolled back): ${writePathOk ? 'OK' : 'FAIL'}`)
  console.log(`  no test data committed:   ${committedNothing ? 'OK' : 'FAIL'}`)

  if (helperProblems.length === 0 && writePathOk && committedNothing) {
    console.log('\nANALYTICS VERIFY OK: helpers enforce taxonomy/privacy; write path works (rolled back).')
  } else {
    console.error('\nANALYTICS VERIFY FAILED')
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
