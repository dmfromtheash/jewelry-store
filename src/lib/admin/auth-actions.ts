'use server'

/**
 * AURELIA — Admin auth server actions (Этап 18A)
 *
 * Login / logout for the local admin. Both re-check the local-only guard first.
 * Login verifies env credentials (constant-time) and, on success, issues the
 * signed httpOnly session cookie. Errors are generic (no user/secret disclosure)
 * and nothing sensitive is logged.
 */

import { redirect } from 'next/navigation'
import { ensureLocalAdmin } from './guard'
import {
  AdminAuthConfigError,
  endAdminSession,
  sanitizeNextPath,
  startAdminSession,
  verifyAdminCredentials,
} from './auth'

export async function loginAction(formData: FormData) {
  await ensureLocalAdmin()

  const username = String(formData.get('username') ?? '')
  const password = String(formData.get('password') ?? '')
  const next = sanitizeNextPath(String(formData.get('next') ?? ''))

  let ok: boolean
  try {
    ok = verifyAdminCredentials(username, password)
  } catch (err) {
    if (err instanceof AdminAuthConfigError) redirect('/admin/login?error=config')
    throw err
  }

  if (!ok) redirect('/admin/login?error=invalid')

  await startAdminSession(username)
  redirect(next)
}

export async function logoutAction() {
  await ensureLocalAdmin()
  await endAdminSession()
  redirect('/admin/login')
}
