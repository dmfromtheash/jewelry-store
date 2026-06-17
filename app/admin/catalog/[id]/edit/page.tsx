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
  getAdminProductGalleryImages,
  getAdminProductVariants,
} from '../../../../../src/lib/admin/catalog'
import {
  addGalleryImageAction,
  deleteGalleryImageAction,
  updateProductAction,
} from '../../../../../src/lib/admin/catalog-actions'
import { ProductForm } from '../../_components/ProductForm'
import { ProductVariants, resolveVariantNotice } from '../../_components/ProductVariants'

export const metadata: Metadata = {
  title: 'Админ · Редактирование товара — AURELIA',
  robots: { index: false, follow: false },
}

/** Gallery action feedback (Этап 29A), kept separate from the form's ?err= codes. */
const GALLERY_NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  added: { kind: 'ok', text: 'Изображение галереи добавлено.' },
  removed: { kind: 'ok', text: 'Изображение галереи удалено.' },
  upload: { kind: 'err', text: 'Не удалось загрузить файл: разрешены JPG, PNG, WEBP до 5 МБ.' },
  notfound: { kind: 'err', text: 'Изображение не найдено.' },
  primary: { kind: 'err', text: 'Основное фото управляется на странице «Каталог · изображения».' },
}

function resolveGalleryNotice(sp: Record<string, string | string[] | undefined>) {
  const ok = typeof sp.gok === 'string' ? GALLERY_NOTICES[sp.gok] : undefined
  const err = typeof sp.gerr === 'string' ? GALLERY_NOTICES[sp.gerr] : undefined
  return ok ?? err ?? null
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

  // Gallery (Этап 29A): primary slot (position 0) is read-only here — it is
  // managed on the «Каталог · изображения» page (26F). Only secondary images
  // (position > 0) can be added/removed below.
  const galleryImages = await getAdminProductGalleryImages(id)
  const secondaryImages = galleryImages.filter((img) => !img.isPrimary && img.position !== 0)
  const galleryNotice = resolveGalleryNotice(sp)

  // Variants (Этап 30C): admin add/edit/delete + default. Storefront selector 30D.
  const variants = await getAdminProductVariants(id)
  const variantNotice = resolveVariantNotice(sp)

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

      <div className="au-adm-card" style={{ marginTop: 20 }}>
        <h2 className="au-adm-title">Галерея товара</h2>
        <span className="au-adm-sub">
          Дополнительные фото для галереи на странице товара. Основное фото
          управляется отдельно на странице «Каталог · изображения». JPG / PNG / WEBP, до 5 МБ.
        </span>

        {galleryNotice && (
          <p
            className="au-adm-note"
            style={{ color: galleryNotice.kind === 'err' ? '#b42318' : undefined }}
          >
            {galleryNotice.text}
          </p>
        )}

        {secondaryImages.length > 0 ? (
          <table className="au-adm-table">
            <thead>
              <tr>
                <th>Фото</th>
                <th>Позиция</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {secondaryImages.map((img) => (
                <tr key={img.id}>
                  <td>
                    {img.url ? (
                      <img
                        src={img.url}
                        alt={img.alt ?? product.name}
                        style={{
                          width: 56,
                          height: 56,
                          objectFit: 'cover',
                          borderRadius: 6,
                          display: 'block',
                        }}
                      />
                    ) : (
                      <span className="au-adm-sub">Пусто</span>
                    )}
                  </td>
                  <td>{img.position}</td>
                  <td>
                    <form action={deleteGalleryImageAction}>
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="imageId" value={img.id} />
                      <button className="au-btn au-btn--ghost" type="submit">
                        Удалить
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="au-adm-sub">Дополнительных фото пока нет.</p>
        )}

        <form
          action={addGalleryImageAction}
          style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}
        >
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            required
          />
          <button className="au-btn au-btn--primary" type="submit">
            Добавить фото
          </button>
        </form>
      </div>

      <ProductVariants productId={product.id} variants={variants} notice={variantNotice} />
    </div>
  )
}
