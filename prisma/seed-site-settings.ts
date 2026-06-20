/**
 * AURELIA — Site settings seed/backfill (Этап 46C)
 *
 * Idempotent backfill for the SiteSetting table. For every allowlisted key:
 *   - CREATE the row from its static default when missing;
 *   - when it already exists, RE-SYNC the code-owned metadata (label/group/type/
 *     isPublic) but NEVER overwrite the admin-edited `value`.
 *
 * So re-running is always safe: it fills gaps and self-heals metadata without
 * clobbering edits, and it never deletes rows or touches product/order data.
 *
 * Prints only safe counts + keys (values are public business copy; no secrets
 * exist here anyway). Run with: npm run db:seed:site-settings
 */

import { PrismaClient, SiteSettingType } from '@prisma/client'
import { SITE_SETTING_DEFS } from '../src/lib/site-settings/defaults'

const prisma = new PrismaClient()

async function main() {
  console.log('▶ Backfilling AURELIA site settings (idempotent)…')

  let created = 0
  let metadataSynced = 0
  const createdKeys: string[] = []

  for (const def of SITE_SETTING_DEFS) {
    const existing = await prisma.siteSetting.findUnique({
      where: { key: def.key },
      select: { id: true },
    })

    if (existing) {
      // Keep code-owned metadata in sync; leave the edited value alone.
      await prisma.siteSetting.update({
        where: { key: def.key },
        data: {
          label: def.label,
          group: def.group,
          type: def.type as SiteSettingType,
          isPublic: true,
        },
      })
      metadataSynced += 1
    } else {
      await prisma.siteSetting.create({
        data: {
          key: def.key,
          label: def.label,
          group: def.group,
          type: def.type as SiteSettingType,
          value: def.defaultValue,
          isPublic: true,
        },
      })
      created += 1
      createdKeys.push(def.key)
    }
  }

  console.log('Site settings:')
  console.log(`  defs in allowlist: ${SITE_SETTING_DEFS.length}`)
  console.log(`  created:           ${created}${createdKeys.length ? ` (${createdKeys.join(', ')})` : ''}`)
  console.log(`  metadata-synced:   ${metadataSynced} (values preserved)`)
  console.log('\nSITE SETTINGS SEED OK')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
