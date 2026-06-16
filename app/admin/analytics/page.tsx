/**
 * AURELIA — Admin analytics (Этап 20A placeholder)
 *
 * Navigation target only. Analytics capture, aggregation and dashboards are not
 * implemented here yet. Local/dev-only + session-gated; noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AdminPlaceholder } from '../_components/AdminPlaceholder'

export const metadata: Metadata = {
  title: 'Админ · Аналитика — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminAnalyticsPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <AdminPlaceholder
      title="Аналитика"
      lead="Поведение покупателей, воронка продаж и эффективность товаров."
      stage="23A–30A"
      planned={[
        'Воронка: просмотр → корзина → оформление → заказ.',
        'Аналитика товаров, поиска и источников трафика.',
        'Только агрегированные, обезличенные данные — без PII.',
      ]}
    />
  )
}
