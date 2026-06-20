/**
 * AURELIA — Site settings verification (Этап 46C)
 *
 * Non-destructive check for the SiteSetting table:
 *   - every allowlisted key exists after seed/backfill;
 *   - keys are unique (no duplicates);
 *   - NO unknown keys (strict against the code allowlist);
 *   - each row's type/group is valid;
 *   - NO value contains unsafe HTML/script/javascript:/data: payload.
 *
 * Read-only: no writes, no deletes, no product/order access. Prints a safe
 * summary. Run with: npm run db:verify:site-settings
 */

import { PrismaClient } from '@prisma/client'
import {
  SITE_SETTING_DEFS,
  SITE_SETTING_KEYS,
  SITE_SETTING_GROUPS,
} from '../src/lib/site-settings/defaults'

const prisma = new PrismaClient()

const VALID_TYPES = new Set(['text', 'long_text', 'email', 'phone', 'url'])
const VALID_GROUPS = new Set<string>(SITE_SETTING_GROUPS)

/** Same safety predicate the write-path validator enforces. */
function hasUnsafeMarkup(value: string): boolean {
  if (/[<>]/.test(value)) return true
  return /(?:javascript|data)\s*:/i.test(value)
}

async function main() {
  const rows = await prisma.siteSetting.findMany({
    select: { key: true, value: true, type: true, group: true },
  })

  const keys = rows.map((r) => r.key)
  const keySet = new Set(keys)

  const missing = SITE_SETTING_KEYS.filter((k) => !keySet.has(k))
  const unknown = keys.filter((k) => !SITE_SETTING_KEYS.includes(k))
  const duplicates = keys.length !== keySet.size
  const badType = rows.filter((r) => !VALID_TYPES.has(String(r.type)))
  const badGroup = rows.filter((r) => !VALID_GROUPS.has(r.group))
  const unsafe = rows.filter((r) => hasUnsafeMarkup(r.value))

  console.log('Site settings:')
  console.log(`  allowlist keys:   ${SITE_SETTING_KEYS.length}`)
  console.log(`  rows in DB:       ${rows.length}`)
  console.log(`  missing keys:     ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''}`)
  console.log(`  unknown keys:     ${unknown.length}${unknown.length ? ` (${unknown.join(', ')})` : ''}`)
  console.log(`  duplicate keys:   ${duplicates ? 'YES' : 'no'}`)
  console.log(`  invalid type:     ${badType.length}`)
  console.log(`  invalid group:    ${badGroup.length}`)
  console.log(`  unsafe values:    ${unsafe.length}${unsafe.length ? ` (${unsafe.map((r) => r.key).join(', ')})` : ''}`)

  const ok =
    missing.length === 0 &&
    unknown.length === 0 &&
    !duplicates &&
    badType.length === 0 &&
    badGroup.length === 0 &&
    unsafe.length === 0 &&
    rows.length === SITE_SETTING_DEFS.length

  if (ok) {
    console.log('\nSITE SETTINGS VERIFY OK: all keys present, unique, typed, plain-text-safe.')
  } else {
    console.error('\nSITE SETTINGS VERIFY FAILED')
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
