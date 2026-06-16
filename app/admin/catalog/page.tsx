/**
 * AURELIA — Admin catalog (Этап 20A placeholder)
 *
 * Navigation target only. Catalog management (products/variants/categories) is
 * not implemented here yet. Local/dev-only + session-gated; noindex.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { AdminPlaceholder } from '../_components/AdminPlaceholder'

export const metadata: Metadata = {
  title: 'Админ · Каталог — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminCatalogPage() {
  await ensureLocalAdmin()
  await requireAdminSession()

  return (
    <AdminPlaceholder
      title="Каталог"
      lead="Управление товарами, вариантами и категориями."
      stage="26A"
      planned={[
        'Создание и редактирование товаров и вариантов.',
        'Управление категориями, ценами и наличием.',
        'Контроль качества данных: изображения, описания, SEO-поля.',
      ]}
    />
  )
}
