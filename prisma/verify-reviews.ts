/**
 * AURELIA — Review foundation verification (Этап 59A)
 *
 * Non-destructive checks for the moderated product-review system. Pure validation +
 * aggregate math, plus DB behaviour exercised inside ALWAYS-ROLLED-BACK transactions
 * (a sentinel error aborts each tx) so NOTHING is ever committed. The review count is
 * asserted unchanged afterwards.
 *
 * Covered:
 *   - validation: rating bounds (reject 0 / 6 / fractional), unsafe HTML in name/body
 *     rejected, logged-in fallback name used when the field is blank, guest name required;
 *   - aggregate: summarizeRatings average (1-decimal) + count, empty → 0;
 *   - DB (rolled back): a submitted review defaults to `pending`; the public read
 *     (status = approved) shows approved only — pending/rejected are never returned;
 *     count + average computed over approved only; moderation flips status + stamps
 *     moderatedAt; nothing is committed.
 *
 * Run with: npm run db:verify:reviews
 */

import { PrismaClient } from '@prisma/client'
import { validateReviewInput, summarizeRatings } from '../src/lib/reviews/validate'

const prisma = new PrismaClient()
const ROLLBACK = '__AURELIA_REVIEWS_ROLLBACK__'

let failures = 0
function check(label: string, ok: boolean) {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}`)
  if (!ok) failures++
}

async function main() {
  const reviewCountBefore = await prisma.productReview.count()
  console.log('Reviews:')
  console.log(`  reviews in DB: ${reviewCountBefore}`)

  // --- 1) Validation (pure) ---
  check('rating 0 rejected', !!validateReviewInput({ productSlug: 'x', rating: 0, authorName: 'A', body: 'Good ring' }).errors.rating)
  check('rating 6 rejected', !!validateReviewInput({ productSlug: 'x', rating: 6, authorName: 'A', body: 'Good ring' }).errors.rating)
  check('fractional rating rejected', !!validateReviewInput({ productSlug: 'x', rating: 4.5, authorName: 'Ann', body: 'Good ring' }).errors.rating)
  check('valid rating accepted', !validateReviewInput({ productSlug: 'x', rating: 5, authorName: 'Ann', body: 'Good ring' }).errors.rating)
  check('unsafe HTML in body rejected', !!validateReviewInput({ productSlug: 'x', rating: 5, authorName: 'Ann', body: '<script>alert(1)</script>' }).errors.body)
  check('unsafe HTML in name rejected', !!validateReviewInput({ productSlug: 'x', rating: 5, authorName: '<b>x</b>', body: 'Lovely piece' }).errors.authorName)
  check('guest must supply a name', !!validateReviewInput({ productSlug: 'x', rating: 5, authorName: '', body: 'Lovely piece' }).errors.authorName)
  const withFallback = validateReviewInput({ productSlug: 'x', rating: 5, body: 'Lovely piece' }, 'Логін Імʼя')
  check('logged-in fallback name used when blank', withFallback.value?.authorName === 'Логін Імʼя')
  check('valid review normalised + trimmed', validateReviewInput({ productSlug: 'x', rating: 4, authorName: '  Ann  ', body: '  nice  ' }).value?.body === 'nice')

  // --- 2) Aggregate math (pure) ---
  const agg = summarizeRatings([5, 3])
  check('summarizeRatings average is 1-decimal mean', agg.average === 4 && agg.count === 2)
  const agg2 = summarizeRatings([5, 4, 4])
  check('summarizeRatings rounds to one decimal', agg2.average === 4.3 && agg2.count === 3)
  check('summarizeRatings empty → 0/0', summarizeRatings([]).average === 0 && summarizeRatings([]).count === 0)

  // Need a product to attach reviews to (read-only; created reviews are rolled back).
  const product = await prisma.product.findFirst({ select: { id: true, slug: true } })
  if (!product) {
    console.error('\nNo product in DB to attach a review — run the catalog seed first.')
    process.exitCode = 1
    return
  }

  // --- 3) DB: default pending + public approved-only read + moderation (rolled back) ---
  let defaultsPending = false
  let approvedOnlyVisible = false
  let approvedAggregateCorrect = false
  let moderationStampsApproved = false
  let moderationStampsRejected = false
  try {
    await prisma.$transaction(async (tx) => {
      const base = { productId: product.id, authorName: 'Verify', body: 'verify review (rolled back)' }

      // A submitted review defaults to `pending`.
      const submitted = await tx.productReview.create({ data: { ...base, rating: 5 }, select: { status: true } })
      defaultsPending = submitted.status === 'pending'

      // Seed one of each status, then read like the public PDP (approved only).
      const approved = await tx.productReview.create({ data: { ...base, rating: 5, status: 'approved' }, select: { id: true } })
      await tx.productReview.create({ data: { ...base, rating: 4, status: 'approved' } })
      await tx.productReview.create({ data: { ...base, rating: 1, status: 'pending' } })
      await tx.productReview.create({ data: { ...base, rating: 1, status: 'rejected' } })

      const publicReviews = await tx.productReview.findMany({
        where: { status: 'approved', product: { slug: product.slug, isPublished: true } },
        select: { id: true, rating: true, status: true },
      })
      approvedOnlyVisible =
        publicReviews.length === 2 && publicReviews.every((r) => r.status === 'approved')

      const summary = summarizeRatings(publicReviews.map((r) => r.rating))
      // ratings 5 + 4 over approved only (the pending 1 + rejected 1 are excluded).
      approvedAggregateCorrect = summary.count === 2 && summary.average === 4.5

      // Moderation: flips status + stamps moderatedAt.
      const pend = await tx.productReview.create({ data: { ...base, rating: 3 }, select: { id: true } })
      const app = await tx.productReview.update({ where: { id: pend.id }, data: { status: 'approved', moderatedAt: new Date() }, select: { status: true, moderatedAt: true } })
      moderationStampsApproved = app.status === 'approved' && app.moderatedAt !== null
      const rej = await tx.productReview.update({ where: { id: approved.id }, data: { status: 'rejected', moderatedAt: new Date() }, select: { status: true, moderatedAt: true } })
      moderationStampsRejected = rej.status === 'rejected' && rej.moderatedAt !== null

      throw new Error(ROLLBACK)
    })
  } catch (e) {
    if (!(e instanceof Error) || e.message !== ROLLBACK) throw e
  }
  check('submitted review defaults to pending', defaultsPending)
  check('public read returns approved only (pending/rejected hidden)', approvedOnlyVisible)
  check('aggregate computed over approved only (avg 4.5, count 2)', approvedAggregateCorrect)
  check('moderation approve flips status + stamps moderatedAt', moderationStampsApproved)
  check('moderation reject flips status + stamps moderatedAt', moderationStampsRejected)

  // --- 4) Nothing committed ---
  const reviewCountAfter = await prisma.productReview.count()
  check('no test reviews committed', reviewCountAfter === reviewCountBefore)

  if (failures === 0) {
    console.log('\nREVIEWS VERIFY OK: validation, aggregate, default-pending, approved-only visibility + moderation all pass; nothing committed.')
  } else {
    console.error(`\nREVIEWS VERIFY FAILED (${failures} check(s)).`)
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
