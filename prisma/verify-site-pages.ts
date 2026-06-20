/**
 * AURELIA — Info pages verification (Этап 46E)
 *
 * Non-destructive check for the SitePage table:
 *   - every known slug exists after backfill;
 *   - slugs are unique;
 *   - NO unknown slugs (strict against the code allowlist);
 *   - each row's `sections` JSON passes the strict content validator;
 *   - NO unsafe HTML/script/javascript:/data: in any stored value;
 *   - the public fallback resolves for every known slug (a valid DB row OR a
 *     static default in src/data/info-pages.ts always exists).
 *
 * Read-only: no writes, no deletes, no product/order access. Mirrors the public
 * loader's validation via the shared pure validator (no server-only import).
 * Run with: npm run db:verify:site-pages
 */

import { PrismaClient } from '@prisma/client'
import {
  SITE_PAGE_DEFS,
  SITE_PAGE_SLUGS,
  getDefaultInfoPage,
} from '../src/lib/site-pages/defaults'
import { validateSitePageContent, hasUnsafeMarkup } from '../src/lib/site-pages/validate'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.sitePage.findMany({
    select: {
      slug: true,
      title: true,
      metaTitle: true,
      metaDescription: true,
      intro: true,
      notice: true,
      sections: true,
    },
  })

  const slugs = rows.map((r) => r.slug)
  const slugSet = new Set(slugs)

  const missing = SITE_PAGE_SLUGS.filter((s) => !slugSet.has(s))
  const unknown = slugs.filter((s) => !SITE_PAGE_SLUGS.includes(s))
  const duplicates = slugs.length !== slugSet.size

  // Validate each row's content (same validator the write/read paths use).
  const invalidContent: string[] = []
  const unsafe: string[] = []
  for (const row of rows) {
    const res = validateSitePageContent({
      title: row.title,
      metaTitle: row.metaTitle,
      metaDescription: row.metaDescription,
      intro: row.intro,
      notice: row.notice,
      sections: row.sections,
    })
    if (!res.ok) {
      invalidContent.push(`${row.slug}:${res.reason}`)
      if (res.reason === 'html') unsafe.push(row.slug)
    }
    // Belt-and-braces: scalar fields must also be markup-free.
    if ([row.title, row.metaTitle, row.metaDescription, row.intro ?? '', row.notice ?? ''].some(hasUnsafeMarkup)) {
      if (!unsafe.includes(row.slug)) unsafe.push(row.slug)
    }
  }

  // Public fallback: every known slug must resolve to SOMETHING (valid DB row or
  // a static default), so the public page can never be empty.
  const noResolution = SITE_PAGE_SLUGS.filter((s) => {
    const hasValidRow = rows.some((r) => r.slug === s) && !invalidContent.some((x) => x.startsWith(`${s}:`))
    return !hasValidRow && !getDefaultInfoPage(s)
  })

  console.log('Info pages:')
  console.log(`  known slugs:      ${SITE_PAGE_SLUGS.length}`)
  console.log(`  rows in DB:       ${rows.length}`)
  console.log(`  missing slugs:    ${missing.length}${missing.length ? ` (${missing.join(', ')})` : ''}`)
  console.log(`  unknown slugs:    ${unknown.length}${unknown.length ? ` (${unknown.join(', ')})` : ''}`)
  console.log(`  duplicate slugs:  ${duplicates ? 'YES' : 'no'}`)
  console.log(`  invalid content:  ${invalidContent.length}${invalidContent.length ? ` (${invalidContent.join(', ')})` : ''}`)
  console.log(`  unsafe values:    ${unsafe.length}${unsafe.length ? ` (${unsafe.join(', ')})` : ''}`)
  console.log(`  no fallback:      ${noResolution.length}${noResolution.length ? ` (${noResolution.join(', ')})` : ''}`)

  const ok =
    missing.length === 0 &&
    unknown.length === 0 &&
    !duplicates &&
    invalidContent.length === 0 &&
    unsafe.length === 0 &&
    noResolution.length === 0 &&
    rows.length === SITE_PAGE_DEFS.length

  if (ok) {
    console.log('\nSITE PAGES VERIFY OK: all slugs present/unique/valid/safe; public fallback resolves.')
  } else {
    console.error('\nSITE PAGES VERIFY FAILED')
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
