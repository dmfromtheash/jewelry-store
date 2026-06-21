/**
 * AURELIA — Admin email outbox (Этап 59A) — FOUNDATION VIEW, NO SENDING
 *
 * Local/dev-only, session-gated view of the email outbox foundation. AURELIA does NOT
 * send email (no provider integrated), so every row is recorded as `skipped` — this
 * screen exists to make that honest + visible. Read-only: it lists recent rows with the
 * template, status, recipient, subject and note. The rendered email BODY is never stored
 * (could embed PII), so it is never shown; no tokens/secrets are ever recorded. noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getRecentEmailOutbox } from '../../../src/lib/email/outbox'
import { EMAIL_TEMPLATE_LABELS, type EmailTemplateId } from '../../../src/lib/email/templates'

export const metadata: Metadata = {
  title: 'Админ · Письма — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminEmailOutboxPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const rows = await getRecentEmailOutbox(50)

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Письма (outbox)</h1>
          <span className="au-adm-sub">
            Основа для будущих писем. Реальная отправка НЕ подключена — каждая запись
            помечается «skipped» (записано, не отправлено). Тело письма не хранится.
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Записей пока нет</p>
          <p className="au-adm-empty-sub">
            Записи о намеченных письмах (например, подтверждение заказа) появятся здесь.
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Шаблон</th>
                <th>Статус</th>
                <th>Получатель</th>
                <th>Тема</th>
                <th>Объект</th>
                <th>Примечание</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{dateFmt.format(r.createdAt)}</td>
                  <td>{EMAIL_TEMPLATE_LABELS[r.template as EmailTemplateId] ?? r.template}</td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${r.status}`}>{r.status}</span>
                  </td>
                  <td>{r.recipientEmail ?? '—'}</td>
                  <td>{r.subject}</td>
                  <td>{r.relatedType ? `${r.relatedType}: ${r.relatedId ?? '—'}` : '—'}</td>
                  <td>{r.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
