/**
 * AURELIA — Admin shell (Этап 18A; hardened 18B; shell 20A)
 *
 * Wraps every /admin route. When a valid admin session exists it renders the
 * full admin shell — persistent sidebar (navigation) + topbar (current admin +
 * logout) + content area. When there is NO session it renders children bare, so
 * the login screen stays clean and is never wrapped in the authenticated shell.
 *
 * This layout does NOT enforce auth — each admin page and the mutation action
 * call ensureLocalAdmin() + requireAdminSession() themselves (defense in depth).
 * It only chooses the chrome based on whether a session is present.
 *
 * It also sets `noindex/nofollow` as the DEFAULT for every /admin route, so a
 * future admin page can never be accidentally indexed if it forgets robots
 * metadata.
 */

import type { Metadata } from 'next'
import { getAdminSession } from '../../src/lib/admin/auth'
import { logoutAction } from '../../src/lib/admin/auth-actions'
import { AdminNav } from './_components/AdminNav'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession()

  // Unauthenticated (e.g. /admin/login) → render bare, no shell chrome.
  if (!session) return <>{children}</>

  return (
    <div className="au-adm-shell">
      <aside className="au-adm-sidebar">
        <div className="au-adm-brand">AURELIA</div>
        <div className="au-adm-brand-sub">Админка</div>
        <AdminNav />
      </aside>

      <div className="au-adm-main">
        <header className="au-adm-topbar">
          <span className="au-adm-topbar-id">
            Админ: <strong>{session.sub}</strong>
          </span>
          <form action={logoutAction}>
            <button className="au-btn au-btn--ghost au-adm-bar-logout" type="submit">
              Выйти
            </button>
          </form>
        </header>

        <main className="au-adm-content">{children}</main>
      </div>
    </div>
  )
}
