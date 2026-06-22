/**
 * AURELIA — Admin customers list (Этап 68A)
 *
 * Local/dev-only customer list (guarded by ensureLocalAdmin + requireAdminSession). A safe
 * support overview — search by email/name + filter by verified / has-orders / has-wishlist.
 * READ-ONLY: no create/edit/delete/impersonate. Shows only safe fields (short id, email, name,
 * phone, verified status, dates, counts) — never a password hash, token, cookie, or email body.
 * Not linked from public navigation; noindex (admin layout default).
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import {
  getAdminCustomers,
  getAdminCustomersSummary,
} from '../../../src/lib/admin/customers'

export const metadata: Metadata = {
  title: 'Админ · Покупатели — AURELIA',
  robots: { index: false, follow: false },
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium' })

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; verified?: string; hasOrders?: string; hasWishlist?: string }>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { q, verified, hasOrders, hasWishlist } = await searchParams
  const [customers, summary] = await Promise.all([
    getAdminCustomers({ query: q, verified, hasOrders, hasWishlist }),
    getAdminCustomersSummary(),
  ])

  const activeVerified = verified === 'verified' || verified === 'unverified' ? verified : ''
  const hasFilters = Boolean(q || activeVerified || hasOrders === '1' || hasWishlist === '1')

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Покупатели</h1>
          <span className="au-adm-sub">
            Локальная админка (dev). Только просмотр и поддержка — без редактирования и удаления
            аккаунтов. Персональные секреты (пароли, токены) не показываются.
          </span>
        </div>
      </div>

      <div className="au-adm-kpis">
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Всего аккаунтов</span>
          <span className="au-adm-kpi-value">{summary.total}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">E-mail подтверждён</span>
          <span className="au-adm-kpi-value">{summary.verified}</span>
        </div>
        <div className="au-adm-kpi">
          <span className="au-adm-kpi-label">Не подтверждён</span>
          <span className="au-adm-kpi-value">{summary.unverified}</span>
        </div>
      </div>

      <form className="au-adm-toolbar" method="get" action="/admin/customers">
        <input
          className="au-adm-input"
          type="search"
          name="q"
          placeholder="Поиск: e-mail или имя"
          defaultValue={q ?? ''}
        />
        <select className="au-adm-select" name="verified" defaultValue={activeVerified}>
          <option value="">E-mail: любой</option>
          <option value="verified">Подтверждён</option>
          <option value="unverified">Не подтверждён</option>
        </select>
        <select className="au-adm-select" name="hasOrders" defaultValue={hasOrders === '1' ? '1' : ''}>
          <option value="">Заказы: любые</option>
          <option value="1">Есть заказы</option>
        </select>
        <select className="au-adm-select" name="hasWishlist" defaultValue={hasWishlist === '1' ? '1' : ''}>
          <option value="">Избранное: любое</option>
          <option value="1">Есть избранное</option>
        </select>
        <button className="au-btn au-btn--primary" type="submit">
          Применить
        </button>
        {hasFilters && (
          <Link className="au-btn au-btn--ghost" href="/admin/customers">
            Сбросить
          </Link>
        )}
      </form>

      {customers.length === 0 ? (
        <div className="au-adm-empty">
          <p className="au-adm-empty-title">Покупателей нет</p>
          <p className="au-adm-empty-sub">
            {hasFilters
              ? 'Ничего не найдено по выбранным условиям.'
              : 'Аккаунты появятся здесь после регистрации на витрине. Гостевые заказы аккаунт не создают.'}
          </p>
        </div>
      ) : (
        <div className="au-adm-tablewrap">
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>E-mail</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>E-mail</th>
                <th>Статус</th>
                <th>Заказы</th>
                <th>Отзывы</th>
                <th>Избранное</th>
                <th>Поиски</th>
                <th>Ожид.</th>
                <th>Посл. заказ</th>
                <th>Регистрация</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link className="au-adm-link" href={`/admin/customers/${c.id}`}>
                      {c.shortId}
                    </Link>
                  </td>
                  <td>{c.email}</td>
                  <td>{c.name ?? '—'}</td>
                  <td>{c.phone ?? '—'}</td>
                  <td>
                    {c.emailVerified ? (
                      <span className="au-adm-badge au-adm-badge--approved">Подтверждён</span>
                    ) : (
                      <span className="au-adm-badge au-adm-badge--pending">Не подтверждён</span>
                    )}
                  </td>
                  <td>{c.engagementLabel}</td>
                  <td>{c.orderCount}</td>
                  <td>{c.reviewCount}</td>
                  <td>{c.wishlistCount}</td>
                  <td>{c.savedSearchCount}</td>
                  <td>{c.activeInterestCount}</td>
                  <td>{c.lastOrderAt ? dateFmt.format(c.lastOrderAt) : '—'}</td>
                  <td>{dateFmt.format(c.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
