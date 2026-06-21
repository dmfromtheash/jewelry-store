/**
 * AURELIA — Admin review moderation (Этап 59A)
 *
 * Local/dev-only, session-gated moderation of product reviews. Lists reviews
 * (pending first) with product, rating, author, body, status and date, plus
 * approve/reject forms wired to the server actions. Read + moderate only — no
 * delete, no content editing. noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getAdminReviews, REVIEW_STATUS_LABELS } from '../../../src/lib/admin/reviews'
import {
  approveReviewAction,
  rejectReviewAction,
} from '../../../src/lib/admin/review-actions'

export const metadata: Metadata = {
  title: 'Админ · Отзывы — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminReviewsPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const reviews = await getAdminReviews()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Отзывы</h1>
          <span className="au-adm-sub">
            Модерация отзывов покупателей. Публично показываются только одобренные
            (макс. 200).
          </span>
        </div>
      </div>

      {reviews.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Отзывов пока нет</p>
          <p className="au-adm-empty-sub">
            Отзывы, отправленные на витрине, появятся здесь для модерации.
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Товар</th>
                <th>Оценка</th>
                <th>Автор</th>
                <th>Отзыв</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>{dateFmt.format(r.createdAt)}</td>
                  <td>
                    <Link className="au-adm-link" href={`/product/${r.product.slug}`}>
                      {r.product.name}
                    </Link>
                  </td>
                  <td>{'★'.repeat(r.rating)}<span className="au-adm-sub"> ({r.rating})</span></td>
                  <td>
                    {r.authorName}
                    {r.isDemo && <span className="au-adm-sub"> · демо</span>}
                    {!r.customerId && <span className="au-adm-sub"> · гость</span>}
                  </td>
                  <td>{r.body}</td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${r.status}`}>
                      {REVIEW_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td>
                    <div className="au-adm-actions">
                      {r.status !== 'approved' && (
                        <form action={approveReviewAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="au-btn au-btn--ghost" type="submit">
                            Одобрить
                          </button>
                        </form>
                      )}
                      {r.status !== 'rejected' && (
                        <form action={rejectReviewAction}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="au-btn au-btn--ghost" type="submit">
                            Отклонить
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
