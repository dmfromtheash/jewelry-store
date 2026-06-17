/**
 * AURELIA — Admin catalog · edit product (Этап 26I)
 *
 * Local/dev-only, session-gated form to edit a product's scalar fields. Images
 * (26F) and variants are managed separately and are not touched here. noindex;
 * no redesign of the storefront.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureLocalAdmin } from '../../../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../../../src/lib/admin/auth'
import {
  getAdminCategoriesForSelect,
  getAdminProductForEdit,
} from '../../../../../src/lib/admin/catalog'
import { updateProductAction } from '../../../../../src/lib/admin/catalog-actions'
import { ProductForm } from '../../_components/ProductForm'

export const metadata: Metadata = {
  title: 'Админ · Редактирование товара — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminCatalogEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { id } = await params
  const product = await getAdminProductForEdit(id)
  if (!product) notFound()

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
          <h1 className="au-adm-title">Редактирование: {product.name}</h1>
          <span className="au-adm-sub">
            Изображение управляется отдельно на странице «Каталог · изображения».
          </span>
        </div>
      </div>

      <ProductForm
        action={updateProductAction}
        submitLabel="Сохранить изменения"
        categories={categories}
        errorCode={errorCode}
        product={product}
      />
    </div>
  )
}
