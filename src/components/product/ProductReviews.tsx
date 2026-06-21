/**
 * AURELIA — ProductReviews (server component) — Этап 59A
 *
 * Renders the moderated review section on the PDP:
 *   - an aggregate summary (average + count) when ≥1 APPROVED review exists;
 *   - the approved review list (newest first), with each review honestly labelled
 *     "Демо" when it is seeded sample content (never passed off as a real purchase);
 *   - the existing <ReviewsEmpty> honest empty state when there are none;
 *   - a submission form (client) that posts to the moderation queue (always pending).
 *
 * Public-only by construction: it is given already-filtered approved reviews from
 * src/lib/reviews/server.ts. Uses existing storefront classes plus a small, isolated
 * review-list style block in product-page.css — no global/card/gallery changes.
 */

import ReviewsEmpty from './ReviewsEmpty'
import ReviewForm from './ReviewForm'
import type { PublicReview, ReviewSummary } from '../../lib/reviews/types'

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' })

/** Five-star glyph row for an integer rating (accessible label carries the number). */
function Stars({ rating }: { rating: number }) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="au-review-stars" role="img" aria-label={`Оцінка ${filled} з 5`}>
      {'★★★★★'.slice(0, filled)}
      <span className="au-review-stars-empty">{'★★★★★'.slice(filled)}</span>
    </span>
  )
}

interface ProductReviewsProps {
  productSlug: string
  reviews: PublicReview[]
  summary: ReviewSummary
  /** Logged-in customer's display name to prefill the form (null for guests). */
  initialAuthorName?: string | null
}

export default function ProductReviews({
  productSlug,
  reviews,
  summary,
  initialAuthorName = null,
}: ProductReviewsProps) {
  return (
    <section className="au-section">
      <div className="au-section-head">
        <h2 className="au-section-title">Відгуки</h2>
        {summary.count > 0 && (
          <span className="au-review-summary">
            <Stars rating={summary.average} />
            <span className="au-review-summary-num">
              {summary.average.toFixed(1)} · {summary.count}{' '}
              {summary.count === 1 ? 'відгук' : 'відгуків'}
            </span>
          </span>
        )}
      </div>

      {reviews.length === 0 ? (
        <ReviewsEmpty />
      ) : (
        <ul className="au-review-list">
          {reviews.map((r) => (
            <li className="au-review" key={r.id}>
              <div className="au-review-head">
                <Stars rating={r.rating} />
                <span className="au-review-author">{r.authorName}</span>
                {r.isDemo && <span className="au-review-demo">Демо</span>}
                <span className="au-review-date">{dateFmt.format(new Date(r.createdAt))}</span>
              </div>
              <p className="au-review-body">{r.body}</p>
            </li>
          ))}
        </ul>
      )}

      <ReviewForm productSlug={productSlug} initialAuthorName={initialAuthorName} />
    </section>
  )
}
