/**
 * AURELIA — Product Q&A verification (Этап 79A)
 *
 * Non-destructive checks for the product question system. Pure validation, plus the DB-backed
 * lifecycle exercised inside an ALWAYS-ROLLED-BACK transaction so NOTHING is committed. Proves
 * the public read returns ONLY published+answered questions (a published-but-unanswered one is
 * hidden) — keeping Q&A honest and distinct from reviews. Count asserted unchanged afterwards.
 *
 * Run with: npm run db:verify:product-questions
 */

import { PrismaClient } from '@prisma/client'
import { validateProductQuestion } from '../src/lib/product-qa/validate'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_PQ_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const before = await prisma.productQuestion.count()
  console.log('Product Q&A:')
  console.log(`  product questions in DB: ${before}`)

  // --- 1) Validation (pure) ---
  check('short body rejected', !!validateProductQuestion({ productSlug: 'x', body: 'hi', authorName: 'Ann' }).errors.body)
  check('guest must supply a name', !!validateProductQuestion({ productSlug: 'x', body: 'Який розмір?', authorName: '' }).errors.authorName)
  const withFallback = validateProductQuestion({ productSlug: 'x', body: 'Який розмір каблучки?' }, 'Логін Імʼя')
  check('logged-in fallback name used when blank', withFallback.value?.authorName === 'Логін Імʼя')
  check('unsafe markup in body rejected', !!validateProductQuestion({ productSlug: 'x', body: '<script>x</script>', authorName: 'Ann' }).errors.body)
  check('email without consent rejected', !!validateProductQuestion({ productSlug: 'x', body: 'Який розмір?', authorName: 'Ann', email: 'a@b.com' }).errors.consent)
  check('email with consent accepted', !!validateProductQuestion({ productSlug: 'x', body: 'Який розмір?', authorName: 'Ann', email: 'a@b.com', consent: true }).value?.email)

  const product = await prisma.product.findFirst({ select: { id: true, slug: true } })
  if (!product) {
    console.error('\nNo product in DB to attach a question — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  // --- 2) DB: default pending + public published+answered-only read (rolled back) ---
  let defaultsPending = false
  let publicVisibility = false
  let publishStamps = false
  try {
    await prisma.$transaction(async (tx) => {
      const base = { productId: product.id, authorName: 'Verify', body: 'verify question (rolled back)' }

      const submitted = await tx.productQuestion.create({ data: { ...base }, select: { status: true } })
      defaultsPending = submitted.status === 'pending'

      // Seed a mix: published+answered (public), published+NO answer (hidden), pending, rejected.
      await tx.productQuestion.create({ data: { ...base, status: 'published', answer: 'Відповідь.', answeredAt: new Date() } })
      await tx.productQuestion.create({ data: { ...base, status: 'published', answer: null } }) // must be hidden
      await tx.productQuestion.create({ data: { ...base, status: 'pending' } })
      await tx.productQuestion.create({ data: { ...base, status: 'rejected', answer: 'x' } })

      // Public read like the PDP: published AND answer not null, on a published product.
      const publicRows = await tx.productQuestion.findMany({
        where: { status: 'published', answer: { not: null }, product: { slug: product.slug, isPublished: true } },
        select: { id: true, status: true, answer: true },
      })
      publicVisibility =
        publicRows.length === 1 && publicRows[0].status === 'published' && !!publicRows[0].answer

      const pend = await tx.productQuestion.create({ data: { ...base }, select: { id: true } })
      const pub = await tx.productQuestion.update({ where: { id: pend.id }, data: { status: 'published', answer: 'A', publishedAt: new Date() }, select: { status: true, publishedAt: true } })
      publishStamps = pub.status === 'published' && pub.publishedAt !== null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('submitted question defaults to pending', defaultsPending)
  check('public read returns ONLY published+answered (unanswered/pending/rejected hidden)', publicVisibility)
  check('publish stamps publishedAt', publishStamps)

  // --- 3) Nothing committed ---
  const after = await prisma.productQuestion.count()
  check('no test questions committed', after === before)

  if (failures === 0) {
    console.log('\nPRODUCT Q&A VERIFY OK: validation, default-pending, published+answered-only visibility, publish stamp; nothing committed.')
  } else {
    console.error(`\nPRODUCT Q&A VERIFY FAILED (${failures} check(s)).`)
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
