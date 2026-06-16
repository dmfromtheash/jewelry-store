/**
 * AURELIA — Admin security (Этап 20A placeholder)
 *
 * Navigation target only. Login activity and the admin audit log are not
 * implemented here yet. Local/dev-only + session-gated; noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AdminPlaceholder } from '../_components/AdminPlaceholder'

export const metadata: Metadata = {
  title: 'Админ · Безопасность — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminSecurityPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <AdminPlaceholder
      title="Безопасность"
      lead="Активность входов и журнал изменений админки."
      stage="21A"
      planned={[
        'Успешные и неуспешные входы, всплески неудачных попыток.',
        'Управление сессиями администратора.',
        'Журнал аудита изменений состояния (AdminAuditLog).',
      ]}
    />
  )
}
