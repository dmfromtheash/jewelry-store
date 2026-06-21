/**
 * AURELIA — Email outbox processor CLI (Этап 60A) — NO REAL SENDING
 *
 * Drains any `queued` EmailOutbox rows through the no-send provider and prints a per-status
 * tally. With the default NoSendEmailProvider NOTHING is sent — rows become
 * `skipped_no_provider` / `failed_validation`. It opens NO socket, reads NO secret, and
 * contacts NO mail server. Safe to run repeatedly (terminal rows are never re-processed).
 *
 * Run with: npm run email:process:stub
 */

import { PrismaClient } from '@prisma/client'
import { processQueuedOutbox } from '../src/lib/email/process'
import { getEmailProvider } from '../src/lib/email/provider'

const prisma = new PrismaClient()

async function main() {
  const provider = getEmailProvider()
  console.log(`Email outbox processor — provider: ${provider.id} (NO real sending)\n`)

  const queuedBefore = await prisma.emailOutbox.count({ where: { status: 'queued' } })
  console.log(`  queued before: ${queuedBefore}`)

  const { processed, byStatus } = await processQueuedOutbox(prisma, provider, 500)

  console.log(`  processed:     ${processed}`)
  for (const [status, count] of Object.entries(byStatus)) {
    console.log(`    ${status}: ${count}`)
  }
  const queuedAfter = await prisma.emailOutbox.count({ where: { status: 'queued' } })
  console.log(`  queued after:  ${queuedAfter}`)
  console.log('\nDONE — no email was sent (no provider configured).')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
