/**
 * AURELIA — Info pages backfill (Этап 46E)
 *
 * Idempotent backfill for the SitePage table from the static defaults in
 * src/data/info-pages.ts. For each known slug:
 *   - CREATE the row from its default content when missing;
 *   - when it already exists, LEAVE IT UNTOUCHED (admin edits are preserved).
 *
 * So re-running is always safe: it only fills gaps, never overwrites edited
 * content, never deletes, and never touches Product/Order/SiteSetting.
 *
 * Prints only safe counts + slugs. Run with: npm run db:seed:site-pages
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { SITE_PAGE_DEFS, getDefaultInfoPage } from '../src/lib/site-pages/defaults'

const prisma = new PrismaClient()

async function main() {
  console.log('▶ Backfilling AURELIA info pages (idempotent)…')

  let created = 0
  let preserved = 0
  const createdSlugs: string[] = []

  for (const def of SITE_PAGE_DEFS) {
    const existing = await prisma.sitePage.findUnique({
      where: { slug: def.slug },
      select: { id: true },
    })

    if (existing) {
      preserved += 1
      continue // never overwrite admin-edited content
    }

    const fallback = getDefaultInfoPage(def.slug)
    if (!fallback) {
      console.error(`  ! no default content for "${def.slug}" — skipped`)
      continue
    }

    await prisma.sitePage.create({
      data: {
        slug: def.slug,
        title: fallback.title,
        metaTitle: fallback.metaTitle,
        metaDescription: fallback.metaDescription,
        intro: fallback.intro ?? null,
        notice: fallback.notice ?? null,
        sections: fallback.sections as unknown as Prisma.InputJsonValue,
        isPublished: true,
      },
    })
    created += 1
    createdSlugs.push(def.slug)
  }

  console.log('Info pages:')
  console.log(`  known slugs: ${SITE_PAGE_DEFS.length}`)
  console.log(`  created:     ${created}${createdSlugs.length ? ` (${createdSlugs.join(', ')})` : ''}`)
  console.log(`  preserved:   ${preserved} (existing content untouched)`)
  console.log('\nSITE PAGES SEED OK')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
