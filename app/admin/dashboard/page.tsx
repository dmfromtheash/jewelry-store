/**
 * AURELIA — Admin dashboard / Command Center (Этап 20A)
 *
 * Minimal landing screen for the admin shell. Intentionally shows NO metrics
 * yet — KPI widgets arrive in a later stage (24A). For now it just orients the
 * admin and links to the one section that is actually functional (Orders).
 * Local/dev-only (ensureLocalAdmin) + session-gated; noindex.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'

export const metadata: Metadata = {
  title: 'Админ · Дашборд — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminDashboardPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Дашборд</h1>
          <span className="au-adm-sub">
            Центр управления магазином. Локальная админка (dev).
          </span>
        </div>
      </div>

      <div className="au-adm-card">
        <h2 className="au-adm-card-title">Что доступно сейчас</h2>
        <p className="au-adm-note">
          KPI-виджеты и аналитика появятся позже (этап 24A). Пока готов модуль
          работы с заказами.
        </p>
        <p className="au-adm-cta">
          <Link className="au-btn au-btn--primary" href="/admin/orders">
            Перейти к заказам
          </Link>
        </p>
      </div>

      <div className="au-adm-card">
        <h2 className="au-adm-card-title">Планируется</h2>
        <ul className="au-adm-planned">
          <li>Ключевые KPI: выручка, заказы, средний чек, конверсия.</li>
          <li>Оповещения о том, что требует внимания прямо сейчас.</li>
          <li>Быстрые переходы к проблемным разделам.</li>
        </ul>
      </div>
    </div>
  )
}
