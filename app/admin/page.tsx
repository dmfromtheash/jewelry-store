/**
 * AURELIA — Admin index (Этап 21A)
 *
 * Bare /admin entry: local-only gate, then redirect to the dashboard landing.
 * Auth itself is enforced by /admin/dashboard (requireAdminSession), which
 * bounces to /admin/login when there is no session.
 */

import { redirect } from 'next/navigation'
import { ensureLocalAdmin } from '../../src/lib/admin/guard'

export default async function AdminIndexPage() {
  await ensureLocalAdmin()
  redirect('/admin/dashboard')
}
