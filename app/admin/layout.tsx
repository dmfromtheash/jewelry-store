/**
 * AURELIA — Admin layout (Этап 18A)
 *
 * Renders a slim admin bar (signed-in user + logout) ONLY when a valid session
 * exists, so the login screen stays clean. This layout does not enforce auth —
 * each admin page and the mutation action call requireAdminSession themselves
 * (defense in depth).
 */

import { getAdminSession } from '../../src/lib/admin/auth'
import { logoutAction } from '../../src/lib/admin/auth-actions'

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
