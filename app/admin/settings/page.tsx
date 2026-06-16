/**
 * AURELIA — Admin settings (Этап 20A placeholder)
 *
 * Navigation target only. Store/admin settings are not implemented here yet.
 * Local/dev-only + session-gated; noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AdminPlaceholder } from '../_components/AdminPlaceholder'

export const metadata: Metadata = {
  title: 'Админ · Настройки — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminSettingsPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <AdminPlaceholder
      title="Настройки"
      lead="Конфигурация магазина и админки."
      planned={[
        'Параметры магазина и отображения витрины.',
        'Настройки доставки и оплаты (когда появятся).',
        'Роли и доступы администраторов (будущая модель AdminUser).',
      ]}
    />
  )
}
