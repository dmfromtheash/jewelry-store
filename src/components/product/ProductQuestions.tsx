/**
 * AURELIA — ProductQuestions (server component) — Этап 79A
 *
 * Renders the product Q&A section on the PDP, DISTINCT from reviews (no rating):
 *   - the published, answered question list (newest first), each with its admin answer and an
 *     honest "Демо" label for seeded sample content;
 *   - an honest empty state when there are none;
 *   - a submission form (client) that posts to the moderation queue (always pending).
 *
 * Public-only by construction: it is given already-filtered published+answered questions from
 * src/lib/product-qa/server.ts. Reuses existing storefront/review classes — no global/card
 * /gallery changes.
 */

import ProductQuestionForm from './ProductQuestionForm'
import type { PublicProductQuestion } from '../../lib/product-qa/types'

const dateFmt = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' })

export default function ProductQuestions({
  productSlug,
  questions,
  initialAuthorName = null,
}: {
  productSlug: string
  questions: PublicProductQuestion[]
  initialAuthorName?: string | null
}) {
  return (
    <section className="au-section">
      <div className="au-section-head">
        <h2 className="au-section-title">Запитання про товар</h2>
        {questions.length > 0 && (
          <span className="au-review-summary-num">
            {questions.length} {questions.length === 1 ? 'запитання' : 'запитань'}
          </span>
        )}
      </div>

      {questions.length === 0 ? (
        <div className="au-reviews-empty">
          <p className="h">Запитань поки немає</p>
          <p className="p">
            Поставте перше запитання про цей товар — ми відповімо після модерації.
          </p>
        </div>
      ) : (
        <ul className="au-review-list au-qa-list">
          {questions.map((q) => (
            <li className="au-review au-qa-item" key={q.id}>
              <div className="au-review-head">
                <span className="au-qa-q-label">Запитання</span>
                <span className="au-review-author">{q.authorName}</span>
                {q.isDemo && <span className="au-review-demo">Демо</span>}
                <span className="au-review-date">{dateFmt.format(new Date(q.createdAt))}</span>
              </div>
              <p className="au-review-body">{q.body}</p>
              <div className="au-qa-answer">
                <span className="au-qa-a-label">Відповідь AURELIA</span>
                <p className="au-review-body">{q.answer}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ProductQuestionForm productSlug={productSlug} initialAuthorName={initialAuthorName} />
    </section>
  )
}
