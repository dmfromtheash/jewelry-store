/**
 * AURELIA — Admin Help-question inbox (Этап 79A)
 *
 * Local/dev-only, session-gated triage + answering of general Help questions. Lists questions
 * (new first) with category, subject, message, masked reply email, status and date, plus an
 * answer form and status-change actions wired to the server actions. Read + moderate only —
 * no delete, no email is sent. The raw reply email is NEVER shown (masked partial only). noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../../src/lib/admin/auth'
import {
  getAdminHelpQuestions,
  HELP_QUESTION_STATUS_LABELS,
} from '../../../../src/lib/admin/help-questions'
import {
  answerHelpQuestionAction,
  setHelpQuestionStatusAction,
} from '../../../../src/lib/admin/help-question-actions'

export const metadata: Metadata = {
  title: 'Админ · Вопросы помощи — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

// Status transitions offered in the inbox. `published` is intentionally omitted: public Help
// Q&A surfacing is a documented follow-up (the Help Center is curated static content in v1).
const STATUS_ACTIONS: { status: string; label: string }[] = [
  { status: 'triaged', label: 'В работу' },
  { status: 'archived', label: 'В архив' },
  { status: 'rejected', label: 'Отклонить' },
  { status: 'spam', label: 'Спам' },
]

export default async function AdminHelpQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { status } = await searchParams
  const questions = await getAdminHelpQuestions({ status })

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Вопросы помощи</h1>
          <span className="au-adm-sub">
            Обращения из формы «Поставити запитання». Ответы — вручную. Письма не отправляются
            (почтовый сервис не подключён). E-mail показан замаскированно (макс. 200).
          </span>
        </div>
        <Link className="au-btn au-btn--ghost" href="/admin/help">
          ← Помощь
        </Link>
      </div>

      {questions.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Вопросов пока нет</p>
          <p className="au-adm-empty-sub">Обращения с витрины появятся здесь.</p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Категория</th>
                <th>Тема / сообщение</th>
                <th>Контакт</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {questions.map((q) => (
                <tr key={q.id}>
                  <td>{dateFmt.format(q.createdAt)}</td>
                  <td>{q.categoryName}</td>
                  <td>
                    <strong>{q.subject}</strong>
                    <div className="au-adm-sub">{q.message}</div>
                    {(q.productRef || q.orderRef) && (
                      <div className="au-adm-sub">
                        {q.productRef && <>товар: {q.productRef} </>}
                        {q.orderRef && <>заказ: {q.orderRef}</>}
                      </div>
                    )}
                    {q.answer && (
                      <div className="au-adm-sub">Ответ: {q.answer}</div>
                    )}
                  </td>
                  <td>
                    {q.hasEmail ? q.emailMasked : <span className="au-adm-sub">без e-mail</span>}
                    {!q.customerId && <div className="au-adm-sub">гость</div>}
                  </td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${q.status}`}>
                      {HELP_QUESTION_STATUS_LABELS[q.status]}
                    </span>
                  </td>
                  <td>
                    <form action={answerHelpQuestionAction} className="au-adm-answer-form">
                      <input type="hidden" name="id" value={q.id} />
                      <textarea
                        name="answer"
                        rows={2}
                        defaultValue={q.answer ?? ''}
                        placeholder="Ответ покупателю"
                        className="au-co-select"
                      />
                      <button className="au-btn au-btn--ghost" type="submit">
                        Сохранить ответ
                      </button>
                    </form>
                    <div className="au-adm-actions">
                      {STATUS_ACTIONS.filter((a) => a.status !== q.status).map((a) => (
                        <form action={setHelpQuestionStatusAction} key={a.status}>
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
