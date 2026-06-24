/**
 * AURELIA — Help Center verification (Этап 79A)
 *
 * Non-destructive checks for the Help Center: the curated STATIC content integrity, the pure
 * local search/filter, the ask-a-question validation, and the DB-backed HelpQuestion lifecycle
 * exercised inside an ALWAYS-ROLLED-BACK transaction (a sentinel error aborts the tx) so NOTHING
 * is committed. The HelpQuestion count is asserted unchanged afterwards.
 *
 * Run with: npm run db:verify:help-center
 */

import { PrismaClient } from '@prisma/client'
import { HELP_CATEGORIES, HELP_ARTICLES, isHelpCategorySlug } from '../src/lib/help/content'
import { searchHelp, normalizeQuery } from '../src/lib/help/search'
import { validateHelpQuestion } from '../src/lib/help/question-validate'
import { hasUnsafeMarkup } from '../src/lib/customer/validate'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_HELP_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const before = await prisma.helpQuestion.count()
  console.log('Help Center:')
  console.log(`  help questions in DB: ${before}`)

  // --- 1) Static content integrity (pure) ---
  const catSlugs = HELP_CATEGORIES.map((c) => c.slug)
  check('category slugs are unique', new Set(catSlugs).size === catSlugs.length)
  const artSlugs = HELP_ARTICLES.map((a) => a.slug)
  check('article slugs are unique', new Set(artSlugs).size === artSlugs.length)
  check('every article maps to a known category', HELP_ARTICLES.every((a) => isHelpCategorySlug(a.categorySlug)))
  check('no unsafe markup in category names/descriptions', HELP_CATEGORIES.every((c) => !hasUnsafeMarkup(c.name) && !hasUnsafeMarkup(c.description)))
  check('no unsafe markup in article titles/bodies', HELP_ARTICLES.every((a) => !hasUnsafeMarkup(a.title) && !hasUnsafeMarkup(a.body)))

  // --- 2) Search / filter (pure) ---
  check('normalizeQuery drops 1-char + markup tokens', JSON.stringify(normalizeQuery('a <b> розмір')) === JSON.stringify(['розмір']))
  const all = searchHelp({})
  check('empty filter returns all articles', all.articles.length === HELP_ARTICLES.length)
  const careOnly = searchHelp({ category: 'care' })
  check('category filter narrows to that category', careOnly.articles.length > 0 && careOnly.articles.every((a) => a.categorySlug === 'care'))
  check('invalid category falls back to all', searchHelp({ category: 'nope' }).activeCategory === null)
  const promo = searchHelp({ query: 'промокод' })
  check('query matches by keyword/body (prefix)', promo.articles.some((a) => a.categorySlug === 'promos'))
  check('no-match query returns empty list', searchHelp({ query: 'zzzzнічого' }).articles.length === 0)

  // --- 3) Ask-a-question validation (pure) ---
  check('unknown category rejected', !!validateHelpQuestion({ categorySlug: 'nope', subject: 'Тема', message: 'Достатньо довге повідомлення.' }).errors.categorySlug)
  check('short subject rejected', !!validateHelpQuestion({ categorySlug: 'orders', subject: 'aa', message: 'Достатньо довге повідомлення.' }).errors.subject)
  check('short message rejected', !!validateHelpQuestion({ categorySlug: 'orders', subject: 'Тема', message: 'коротко' }).errors.message)
  check('unsafe markup in message rejected', !!validateHelpQuestion({ categorySlug: 'orders', subject: 'Тема', message: '<script>alert(1)</script>' }).errors.message)
  check('email without consent rejected', !!validateHelpQuestion({ categorySlug: 'orders', subject: 'Тема', message: 'Достатньо довге повідомлення.', email: 'a@b.com' }).errors.consent)
  check('email with consent accepted', !!validateHelpQuestion({ categorySlug: 'orders', subject: 'Тема', message: 'Достатньо довге повідомлення.', email: 'a@b.com', consent: true }).value)
  const noEmail = validateHelpQuestion({ categorySlug: 'orders', subject: 'Тема', message: 'Достатньо довге повідомлення.' })
  check('valid question without email accepted (email null)', !!noEmail.value && noEmail.value.email === null && noEmail.value.consentGiven === false)

  // --- 4) DB: default `new` + status transition + consent storage (rolled back) ---
  let defaultsNew = false
  let publishStamps = false
  let consentStored = false
  let noConsentNoEmail = false
  try {
    await prisma.$transaction(async (tx) => {
      const created = await tx.helpQuestion.create({
        data: { categorySlug: 'orders', subject: 'verify', message: 'verify message (rolled back)' },
        select: { id: true, status: true },
      })
      defaultsNew = created.status === 'new'

      const published = await tx.helpQuestion.update({
        where: { id: created.id },
        data: { status: 'published', publishedAt: new Date() },
        select: { status: true, publishedAt: true },
      })
      publishStamps = published.status === 'published' && published.publishedAt !== null

      const withEmail = await tx.helpQuestion.create({
        data: { categorySlug: 'orders', subject: 'verify', message: 'verify', recipientEmail: 'a@b.com', emailHash: 'deadbeef', consentAt: new Date() },
        select: { recipientEmail: true, emailHash: true, consentAt: true },
      })
      consentStored = withEmail.recipientEmail === 'a@b.com' && withEmail.emailHash === 'deadbeef' && withEmail.consentAt !== null

      const guest = await tx.helpQuestion.create({
        data: { categorySlug: 'orders', subject: 'verify', message: 'verify' },
        select: { recipientEmail: true, emailHash: true, consentAt: true },
      })
      noConsentNoEmail = guest.recipientEmail === null && guest.emailHash === null && guest.consentAt === null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('submitted Help question defaults to `new`', defaultsNew)
  check('publish stamps publishedAt', publishStamps)
  check('consented email + hash + consentAt stored together', consentStored)
  check('no email → no recipientEmail/hash/consent stored', noConsentNoEmail)

  // --- 5) Nothing committed ---
  const after = await prisma.helpQuestion.count()
  check('no test Help questions committed', after === before)

  if (failures === 0) {
    console.log('\nHELP CENTER VERIFY OK: static content, search, validation, default-new + publish + privacy all pass; nothing committed.')
  } else {
    console.error(`\nHELP CENTER VERIFY FAILED (${failures} check(s)).`)
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
