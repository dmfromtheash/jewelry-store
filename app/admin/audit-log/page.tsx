/**
 * AURELIA — Admin audit log (Этап 21A; customer auth events 49A)
 *
 * Local/dev-only, session-gated view of recent admin/security events (admin login
 * success/failure, logout, order status changes) AND customer auth/security events
 * (customer register/login/logout, profile + password change, throttled attempts —
 * Этап 49A). Read-only: it lists the 50 most recent events and never dumps raw
 * metadata JSON. noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AUDIT_ACTION_LABELS, getRecentAuditEvents } from '../../../src/lib/admin/audit'
import { CUSTOMER_AUDIT_ACTION_LABELS } from '../../../src/lib/customer/audit-actions'

// Admin + customer auth events share the AdminAuditLog table; merge both label maps
// so customer `customer.*` actions render with a readable label (49A).
const ACTION_LABELS: Record<string, string> = {
  ...AUDIT_ACTION_LABELS,
  ...CUSTOMER_AUDIT_ACTION_LABELS,
}

export const metadata: Metadata = {
  title: 'Админ · Журнал аудита — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminAuditLogPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  const events = await getRecentAuditEvents(50)

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Журнал аудита</h1>
          <span className="au-adm-sub">
            Последние действия администратора и клиентов, события безопасности (макс. 50).
          </span>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Событий пока нет</p>
          <p className="au-adm-empty-sub">
            Вход, выход, смена статуса заказа и события входа клиентов появятся здесь по
            мере действий.
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Время</th>
                <th>Действие</th>
                <th>Кто</th>
                <th>Объект</th>
                <th>Описание</th>
                <th>Результат</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>{dateFmt.format(e.createdAt)}</td>
                  <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                  <td>{e.actor}</td>
                  <td>{e.entityType ? `${e.entityType}: ${e.entityId ?? '—'}` : '—'}</td>
                  <td>{e.summary}</td>
                  <td>
                    <span
                      className={`au-adm-badge ${e.success ? 'au-adm-badge--ok' : 'au-adm-badge--fail'}`}
                    >
                      {e.success ? 'Успех' : 'Ошибка'}
                    </span>
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
