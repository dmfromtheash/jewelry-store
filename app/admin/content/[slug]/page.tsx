/**
 * AURELIA — Admin content · edit info page (Этап 46E)
 *
 * Per-page structured editor for a known info page. Local/dev-only + session-gated;
 * noindex. Built from existing admin primitives — no new CSS, no storefront change.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ensureLocalAdmin } from '../../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../../src/lib/admin/auth'
import { getSitePageForAdmin } from '../../../../src/lib/site-pages/server'
import { SitePageForm } from '../_components/SitePageForm'

export const metadata: Metadata = {
  title: 'Админ · Редактирование страницы — AURELIA',
  robots: { index: false, follow: false },
}

const OK_NOTICES: Record<string, string> = {
  saved: 'Страница сохранена.',
}

const ERR_REASONS: Record<string, string> = {
  title: 'Проверьте заголовок (обязателен, до 120 символов)',
  metaTitle: 'Проверьте SEO title (обязателен, до 160 символов)',
  metaDescription: 'SEO description слишком длинный (до 300 символов)',
  intro: 'Вступление слишком длинное (до 600 символов)',
  notice: 'Уведомление слишком длинное (до 300 символов)',
  sections: 'Проверьте секции (некорректная структура или их слишком много)',
  section: 'Проверьте содержимое секции',
  html: 'HTML и небезопасные ссылки запрещены',
  slug: 'Неизвестная страница',
}

function resolveNotice(sp: Record<string, string | string[] | undefined>) {
  const ok = typeof sp.ok === 'string' ? OK_NOTICES[sp.ok] : undefined
  if (ok) return { kind: 'ok' as const, text: ok }
  const reason = typeof sp.err === 'string' ? ERR_REASONS[sp.err] : undefined
  if (reason) {
    const field = typeof sp.f === 'string' ? sp.f : undefined
    return { kind: 'err' as const, text: field ? `${reason} (${field}).` : `${reason}.` }
  }
  return null
}

export default async function AdminContentEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const { slug } = await params
  const page = await getSitePageForAdmin(slug)
  if (!page) notFound()

  const sp = await searchParams
  const notice = resolveNotice(sp)

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <Link className="au-adm-link" href="/admin/content">
            ← Контент
          </Link>
          <h1 className="au-adm-title">Страница: {page.label}</h1>
          <span className="au-adm-sub">
            Текст и SEO для публичной страницы <Link href={`/${page.slug}`}>/{page.slug}</Link>.
            Дизайн и структура не меняются.
          </span>
        </div>
      </div>

      {notice && (
        <p className="au-adm-note" style={{ color: notice.kind === 'err' ? '#b42318' : undefined }}>
          {notice.text}
        </p>
      )}

      <SitePageForm page={page} />
    </div>
  )
}
