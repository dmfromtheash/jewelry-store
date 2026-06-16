/**
 * AURELIA — Admin layout (Этап 18A; hardened 18B)
 *
 * Renders a slim admin bar (signed-in user + logout) ONLY when a valid session
 * exists, so the login screen stays clean. This layout does not enforce auth —
 * each admin page and the mutation action call requireAdminSession themselves
 * (defense in depth).
 *
 * It also sets `noindex/nofollow` as the DEFAULT for every /admin route, so a
 * future admin page can never be accidentally indexed if it forgets robots
 * metadata (individual pages may still set their own title).
 */

import type { Metadata } from 'next'
import { getAdminSession } from '../../src/lib/admin/auth'
import { logoutAction } from '../../src/lib/admin/auth-actions'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()

  return (
    <>
      {session && (
        <div className="au-adm-bar au-container">
          <span className="au-adm-bar-id">
            Админ: <strong>{session.sub}</strong>
          </span>
          <form action={logoutAction}>
            <button className="au-btn au-btn--ghost au-adm-bar-logout" type="submit">
              Выйти
            </button>
          </form>
        </div>
      )}
      {children}
    </>
  )
}
