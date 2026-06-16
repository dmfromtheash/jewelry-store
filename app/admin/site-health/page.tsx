/**
 * AURELIA — Admin site health (Этап 20A placeholder)
 *
 * Navigation target only. Error/404/performance monitoring is not implemented
 * here yet. Local/dev-only + session-gated; noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AdminPlaceholder } from '../_components/AdminPlaceholder'

export const metadata: Metadata = {
  title: 'Админ · Состояние сайта — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminSiteHealthPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <AdminPlaceholder
      title="Состояние сайта"
      lead="Надёжность и производительность витрины с одного экрана."
      stage="32A"
      planned={[
        'Серверные ошибки, 404 и сбои API/БД.',
        'Медленные запросы и Core Web Vitals (LCP, CLS, INP).',
        'Проверка корректности структурированных данных.',
      ]}
    />
  )
}
