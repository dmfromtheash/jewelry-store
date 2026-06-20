/**
 * AURELIA — Admin content · info pages (Этап 46E)
 *
 * Lists the known public info pages (delivery / returns / stores / help / about /
 * contacts) with their DB state, linking to the per-page editor. Local/dev-only +
 * session-gated; noindex. Built from existing admin primitives — no new CSS.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getSitePagesForAdmin } from '../../../src/lib/site-pages/server'

export const metadata: Metadata = {
  title: 'Админ · Контент — AURELIA',
  robots: { index: false, follow: false },
}

const NOTICES: Record<string, { kind: 'ok' | 'err'; text: string }> = {
  slug: { kind: 'err', text: 'Неизвестная страница.' },
}

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const sp = await searchParams
  const notice = typeof sp.err === 'string' ? NOTICES[sp.err] : undefined
  const pages = await getSitePagesForAdmin()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Контент · инфо-страницы</h1>
          <span className="au-adm-sub">
            Редактирование текста публичных страниц. Структура и дизайн неизменны;
            пустая/снятая с публикации страница показывает статичный текст по умолчанию.
          </span>
        </div>
      </div>

      {notice && (
        <p className="au-adm-note" style={{ color: notice.kind === 'err' ? '#b42318' : undefined }}>
          {notice.text}
        </p>
      )}

      <div className="au-adm-card">
        <table className="au-adm-table">
          <thead>
            <tr>
              <th>Страница</th>
              <th>Slug</th>
              <th>Источник</th>
              <th>Статус</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => (
              <tr key={p.slug}>
                <td>{p.label}</td>
                <td>
                  <Link href={`/${p.slug}`}>/{p.slug}</Link>
                </td>
                <td>
                  <span className="au-adm-sub">{p.hasRow ? 'БД' : 'По умолчанию'}</span>
                </td>
                <td>
                  <span className="au-adm-sub">
                    {p.hasRow ? (p.isPublished ? 'Опубликовано' : 'Скрыто (fallback)') : '—'}
                  </span>
                </td>
                <td>
                  <Link className="au-btn au-btn--ghost" href={`/admin/content/${p.slug}`}>
                    Редактировать
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
