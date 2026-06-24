/**
 * AURELIA — Admin product-question moderation (Этап 79A)
 *
 * Local/dev-only, session-gated moderation of product Q&A. Lists questions (pending first) with
 * product, question body, masked reply email, status and date, plus an answer form and
 * status-change actions. A question becomes PUBLIC on the PDP only when it is `published` AND
 * carries an answer. Read + moderate only — no delete, no email is sent. noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import {
  getAdminProductQuestions,
  PRODUCT_QUESTION_STATUS_LABELS,
} from '../../../src/lib/admin/product-questions'
import {
  answerProductQuestionAction,
  setProductQuestionStatusAction,
} from '../../../src/lib/admin/product-question-actions'

export const metadata: Metadata = {
  title: 'Админ · Вопросы о товаре — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: 'published', label: 'Опубликовать' },
  { status: 'archived', label: 'В архив' },
  { status: 'rejected', label: 'Отклонить' },
  { status: 'spam', label: 'Спам' },
]

export default async function AdminProductQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { status } = await searchParams
  const questions = await getAdminProductQuestions({ status })

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Вопросы о товаре</h1>
          <span className="au-adm-sub">
            Модерация пред-продажных вопросов. Публично показываются только опубликованные с
            ответом. Это не отзывы. Письма не отправляются. E-mail замаскирован (макс. 200).
          </span>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Вопросов пока нет</p>
          <p className="au-adm-empty-sub">Вопросы, заданные на витрине, появятся здесь.</p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Товар</th>
                <th>Вопрос / ответ</th>
                <th>Контакт</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>{dateFmt.format(q.createdAt)}</td>
                  <td>
                    <Link className="au-adm-link" href={`/product/${q.product.slug}`}>
                      {q.product.name}
                    </Link>
                  </td>
                  <td>
                    <strong>{q.authorName}</strong>
                    {q.isDemo && <span className="au-adm-sub"> · демо</span>}
                    <div>{q.body}</div>
                    {q.answer && <div className="au-adm-sub">Ответ: {q.answer}</div>}
                  </td>
                  <td>
                    {q.hasEmail ? q.emailMasked : <span className="au-adm-sub">без e-mail</span>}
                    {!q.customerId && <div className="au-adm-sub">гость</div>}
                  </td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${q.status}`}>
                      {PRODUCT_QUESTION_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td>
                    <form action={answerProductQuestionAction} className="au-adm-answer-form">
                      <input type="hidden" name="id" value={q.id} />
                      <textarea
                        name="answer"
                        rows={2}
                        defaultValue={q.answer ?? ''}
                        placeholder="Ответ на вопрос"
                        className="au-co-select"
                      />
                      <button className="au-btn au-btn--ghost" type="submit">
                        Сохранить ответ
                      </button>
                    </form>
                    <div className="au-adm-actions">
                      {STATUS_ACTIONS.filter((a) => a.status !== q.status).map((a) => (
                        <form action={setProductQuestionStatusAction} key={a.status}>
                          <input type="hidden" name="id" value={q.id} />
                          <input type="hidden" name="status" value={a.status} />
                          <button className="au-btn au-btn--ghost" type="submit">
                            {a.label}
                          </button>
                        </form>
                      ))}
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
