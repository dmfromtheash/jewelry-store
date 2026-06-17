/**
 * AURELIA — Admin catalog · product images (Этап 26F)
 *
 * Minimal admin manager for product photos: upload, replace and delete the
 * primary image of each catalog product. Local/dev-only + session-gated; noindex.
 * Deliberately scoped to image management (not full product CRUD) and built from
 * the existing admin UI primitives — no redesign.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getAdminProductsForImages } from '../../../src/lib/admin/catalog'
import {
  uploadProductImageAction,
  deleteProductImageAction,
} from '../../../src/lib/admin/catalog-actions'

export const metadata: Metadata = {
  title: 'Админ · Каталог — AURELIA',
  robots: { index: false, follow: false },
}

const NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  uploaded: { kind: 'ok', text: 'Изображение сохранено.' },
  removed: { kind: 'ok', text: 'Изображение удалено.' },
  noop: { kind: 'ok', text: 'Изменений нет.' },
  missing: { kind: 'err', text: 'Не указан товар.' },
  notfound: { kind: 'err', text: 'Товар не найден.' },
  upload: { kind: 'err', text: 'Не удалось загрузить файл: разрешены JPG, PNG, WEBP до 5 МБ.' },
}

function resolveNotice(sp: Record<string, string | string[] | undefined>) {
  const ok = typeof sp.ok === 'string' ? NOTICES[sp.ok] : undefined
  const err = typeof sp.err === 'string' ? NOTICES[sp.err] : undefined
  return ok ?? err ?? null
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const sp = await searchParams
  const notice = resolveNotice(sp)
  const products = await getAdminProductsForImages()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Каталог · изображения</h1>
          <span className="au-adm-sub">
            Загрузка, замена и удаление основного фото товара. JPG / PNG / WEBP, до 5 МБ.
          </span>
        </div>
      </div>

      {notice && (
        <p
          className="au-adm-note"
          style={{ color: notice.kind === 'err' ? '#b42318' : undefined }}
        >
          {notice.text}
        </p>
      )}

      <div className="au-adm-card">
        <table className="au-adm-table">
          <thead>
            <tr>
              <th>Фото</th>
              <th>Товар</th>
              <th>Артикул</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      style={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 6,
                        display: 'block',
                      }}
                    />
                  ) : (
                    <span className="au-adm-sub">Нет фото</span>
                  )}
                </td>
                <td>{p.name}</td>
                <td>{p.sku ?? '—'}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <form
                      action={uploadProductImageAction}
                      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
                    >
                      <input type="hidden" name="productId" value={p.id} />
                      <input
                        type="file"
                        name="image"
                        accept="image/jpeg,image/png,image/webp"
                        required
                      />
                      <button className="au-btn au-btn--primary" type="submit">
                        {p.imageUrl ? 'Заменить' : 'Загрузить'}
                      </button>
                    </form>
                    {p.imageUrl && (
                      <form action={deleteProductImageAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <button className="au-btn au-btn--ghost" type="submit">
                          Удалить
                        </button>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
