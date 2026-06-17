/**
 * AURELIA — Admin catalog · create product (Этап 26I)
 *
 * Local/dev-only, session-gated form to create a catalog product. Scalar fields
 * only — images (26F) and variants are managed separately. noindex; no redesign
 * of the storefront.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../../src/lib/admin/auth'
import { getAdminCategoriesForSelect } from '../../../../src/lib/admin/catalog'
import { createProductAction } from '../../../../src/lib/admin/catalog-actions'
import { ProductForm } from '../_components/ProductForm'

export const metadata: Metadata = {
  title: 'Админ · Новый товар — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminCatalogNewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const sp = await searchParams
  const errorCode = typeof sp.err === 'string' ? sp.err : undefined
  const categories = await getAdminCategoriesForSelect()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <Link className="au-adm-link" href="/admin/catalog">
            ← Каталог
          </Link>
          <h1 className="au-adm-title">Новый товар</h1>
          <span className="au-adm-sub">
            Изображение можно добавить после создания на странице «Каталог · изображения».
          </span>
        </div>
      </div>

      <ProductForm
        action={createProductAction}
        submitLabel="Создать товар"
        categories={categories}
        errorCode={errorCode}
      />
    </div>
  )
}
