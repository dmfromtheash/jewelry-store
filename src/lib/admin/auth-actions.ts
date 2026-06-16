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
  clearLoginThrottle,
  endAdminSession,
  getLoginClientKey,
  isLoginThrottled,
  registerFailedLogin,
  sanitizeNextPath,
  startAdminSession,
  verifyAdminCredentials,
} from './auth'

export async function loginAction(formData: FormData) {
  await ensureLocalAdmin()

  // Best-effort brute-force speed-bump (in-memory; see auth.ts). Refuse without
  // even checking credentials once the failure budget is exhausted.
  const clientKey = await getLoginClientKey()
  if (isLoginThrottled(clientKey)) redirect('/admin/login?error=throttled')

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

  if (!ok) {
    registerFailedLogin(clientKey)
    redirect('/admin/login?error=invalid')
  }

  clearLoginThrottle(clientKey)
  await startAdminSession(username)
  redirect(next)
}

export async function logoutAction() {
  await ensureLocalAdmin()
  await endAdminSession()
  redirect('/admin/login')
}
