/**
 * AURELIA — Admin Help overview (Этап 79A)
 *
 * Local/dev-only, session-gated overview of the Help Center. The Help categories + articles are
 * CURATED STATIC content (src/lib/help/content.ts) — the v1 source of truth — so this page lists
 * them read-only and links to the customer-question inbox. Full DB article authoring is a
 * documented follow-up. noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { HELP_CATEGORIES, HELP_ARTICLES } from '../../../src/lib/help/content'
import { getOpenHelpQuestionCount } from '../../../src/lib/admin/help-questions'

export const metadata: Metadata = {
  title: 'Админ · Помощь — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminHelpPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const openQuestions = await getOpenHelpQuestionCount()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Помощь</h1>
          <span className="au-adm-sub">
            Справочный центр витрины. Категории и статьи — курируемый статический контент
            (src/lib/help/content.ts). Вопросы покупателей — в отдельном разделе.
          </span>
        </div>
        <Link className="au-btn au-btn--primary" href="/admin/help/questions">
          Вопросы покупателей{openQuestions > 0 ? ` (${openQuestions})` : ''}
        </Link>
      </div>

      <div className="au-adm-tablewrap">
        <table className="au-adm-table">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Slug</th>
              <th>Статей</th>
              <th>Описание</th>
            </tr>
          </thead>
          <tbody>
            {HELP_CATEGORIES.map((c) => {
              const count = HELP_ARTICLES.filter((a) => a.categorySlug === c.slug).length
              return (
                <tr key={c.slug}>
                  <td>{c.name}</td>
                  <td><code>{c.slug}</code></td>
                  <td>{count}</td>
                  <td>{c.description}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="au-adm-sub" style={{ marginTop: '1rem' }}>
        Полноценное создание/редактирование статей через БД — документированный следующий шаг
        (см. docs/support/HELP_CENTER_PRODUCT_QA_RESERVATION_SPEC_78A.md). Реальная отправка писем
        и 24-часовое бронирование — НЕ реализованы (вне объёма этого этапа).
      </p>
    </div>
  )
}
