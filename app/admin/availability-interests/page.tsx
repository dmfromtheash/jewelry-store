/**
 * AURELIA — Admin availability-interest queue (Этап 79A)
 *
 * Local/dev-only, session-gated back-in-stock queue. Shows status counts and a list with the
 * product, its CURRENT availability, masked reply email, status and date. Actions: change
 * status, or "prepare" a NO-SEND notification (records an outbox row that never sends). The raw
 * email is NEVER shown (masked partial only). No reservation/hold anywhere. noindex.
 */

import type { Metadata } from 'next'
import {
  getAdminAvailabilityInterests,
  getAvailabilityStatusCounts,
  AVAILABILITY_STATUS_LABELS,
} from '../../../src/lib/admin/availability-interests'
import {
  setAvailabilityStatusAction,
  prepareAvailabilityNotificationAction,
} from '../../../src/lib/admin/availability-interest-actions'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AvailabilityInterestStatus } from '@prisma/client'

export const metadata: Metadata = {
  title: 'Админ · Ожидание наличия — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })

export default async function AdminAvailabilityInterestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { status } = await searchParams
  const [interests, counts] = await Promise.all([
    getAdminAvailabilityInterests({ status }),
    getAvailabilityStatusCounts(),
  ])

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Ожидание наличия</h1>
          <span className="au-adm-sub">
            Запросы «Повідомити про наявність». Это НЕ бронирование и НЕ резерв склада. Письма не
            отправляются — «подготовить уведомление» лишь создаёт запись (skipped_no_provider).
            E-mail замаскирован (макс. 200).
          </span>
        </div>
      </div>

      <div className="au-adm-sub" style={{ marginBottom: '1rem' }}>
        {Object.values(AvailabilityInterestStatus).map((s) => (
          <span key={s} style={{ marginRight: '1rem' }}>
            {AVAILABILITY_STATUS_LABELS[s]}: <strong>{counts[s] ?? 0}</strong>
          </span>
        ))}
      </div>

      {interests.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Запросов пока нет</p>
          <p className="au-adm-empty-sub">
            Запросы наличия, оставленные на витрине, появятся здесь.
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Товар</th>
                <th>Наличие</th>
                <th>Контакт</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {interests.map((it) => (
                <tr key={it.id}>
                  <td>{dateFmt.format(it.createdAt)}</td>
                  <td>
                    {it.productName}
                    {it.variantId && <div className="au-adm-sub">вариант: {it.variantId}</div>}
                  </td>
                  <td>
                    {it.productAvailable ? (
                      <span className="au-adm-badge au-adm-badge--approved">в наличии</span>
                    ) : (
                      <span className="au-adm-sub">нет</span>
                    )}
                  </td>
                  <td>
                    {it.hasEmail ? it.emailMasked : <span className="au-adm-sub">без e-mail</span>}
                    {!it.customerId && <div className="au-adm-sub">гость</div>}
                  </td>
                  <td>
                    <span className={`au-adm-badge au-adm-badge--${it.status}`}>
                      {AVAILABILITY_STATUS_LABELS[it.status]}
                    </span>
                  </td>
                  <td>
                    <div className="au-adm-actions">
                      {it.productAvailable &&
                        it.status !== AvailabilityInterestStatus.notification_prepared &&
                        it.status !== AvailabilityInterestStatus.cancelled && (
                          <form action={prepareAvailabilityNotificationAction}>
                            <input type="hidden" name="id" value={it.id} />
                            <button className="au-btn au-btn--ghost" type="submit">
                              Подготовить уведомление
                            </button>
                          </form>
                        )}
                      {it.status !== AvailabilityInterestStatus.cancelled && (
                        <form action={setAvailabilityStatusAction}>
                          <input type="hidden" name="id" value={it.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <button className="au-btn au-btn--ghost" type="submit">
                            Отменить
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
