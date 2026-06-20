/**
 * AURELIA — Admin settings (Этап 46C — Site Settings foundation)
 *
 * First real Admin CMS surface: edit the v1 PUBLIC site settings (brand, contacts,
 * social links, footer copy). Local/dev-only + session-gated; noindex. Storefront
 * integration is the separate 46D stage — saving here persists values but does NOT
 * change the storefront yet. No design/CSS changes: built from existing admin
 * primitives only.
 */

import type { Metadata } from 'next'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { requireAdminSession } from '../../../src/lib/admin/auth'
import { getSiteSettingsForAdmin } from '../../../src/lib/site-settings/server'
import { SettingsForm } from './_components/SettingsForm'

export const metadata: Metadata = {
  title: 'Админ · Настройки — AURELIA',
  robots: { index: false, follow: false },
}

const OK_NOTICES: Record<string, string> = {
  saved: 'Настройки сохранены.',
  noop: 'Изменений нет.',
}

const ERR_REASONS: Record<string, string> = {
  required: 'Заполните обязательное поле',
  length: 'Слишком длинное значение',
  email: 'Некорректный e-mail',
  url: 'Ссылка должна начинаться с https:// и быть корректной',
  phone: 'Телефон может содержать только цифры, пробелы и + - ( )',
  html: 'HTML и небезопасные ссылки запрещены',
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

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await ensureLocalAdmin()
  await requireAdminSession()

  const sp = await searchParams
  const notice = resolveNotice(sp)
  const settings = await getSiteSettingsForAdmin()

  return (
    <div className="au-container au-adm">
      <div className="au-adm-head">
        <div>
          <h1 className="au-adm-title">Настройки</h1>
          <span className="au-adm-sub">
            Публичные данные магазина: бренд, контакты, соцсети, футер. Значения
            сохраняются в БД; вывод на витрину подключается отдельно (этап 46D).
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

      <SettingsForm settings={settings} />
    </div>
  )
}
