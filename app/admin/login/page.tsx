/**
 * AURELIA — Admin login (Этап 18A)
 *
 * Local/dev admin sign-in. Guarded by ensureLocalAdmin (404s outside local dev).
 * A valid session here just bounces to the orders screen, so this never acts as
 * a second login screen. Server component + server action — no client JS, no
 * credentials in the URL. Errors are generic.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ensureLocalAdmin } from '../../../src/lib/admin/guard'
import { getAdminSession, sanitizeNextPath } from '../../../src/lib/admin/auth'
import { loginAction } from '../../../src/lib/admin/auth-actions'

export const metadata: Metadata = {
  title: 'Админ · Вход — AURELIA',
  robots: { index: false, follow: false },
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  await ensureLocalAdmin()

  const { error, next } = await searchParams

  // Already signed in → don't show a second login screen.
  if (await getAdminSession()) redirect(sanitizeNextPath(next))

  const message =
    error === 'config'
      ? 'Вход не настроен. Задайте переменные ADMIN_* в .env (см. .env.example).'
      : error === 'invalid'
        ? 'Неверный логин или пароль.'
        : error === 'throttled'
          ? 'Слишком много попыток входа. Подождите немного и попробуйте снова.'
          : null

  return (
    <div className="au-container au-adm au-adm-login">
      <form className="au-adm-loginbox" action={loginAction}>
        <h1 className="au-adm-login-title">Вход в админку</h1>
        <p className="au-adm-login-sub">Локальная админка AURELIA (только для dev).</p>

        {message && (
          <p className="au-adm-login-error" role="alert">
            {message}
          </p>
        )}

        <input type="hidden" name="next" value={sanitizeNextPath(next)} />

        <div className="au-field">
          <label htmlFor="au-admin-username">Логин</label>
          <input
            id="au-admin-username"
            name="username"
            type="text"
            autoComplete="username"
            required
            autoFocus
          />
        </div>

        <div className="au-field">
          <label htmlFor="au-admin-password">Пароль</label>
          <input
            id="au-admin-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <button className="au-btn au-btn--primary au-btn--block" type="submit">
          Войти
        </button>
      </form>
    </div>
  )
}
