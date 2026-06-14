/**
 * AURELIA — Local/dev admin guard (Этап 17A)
 *
 * This is NOT a real auth system — it is a local-only gate. Admin routes are
 * allowed ONLY in development AND only when served to a localhost host. In
 * production (or any non-local host) the guard calls notFound(), so admin pages
 * simply do not exist there. No secrets, no sessions, no users.
 *
 * A proper admin auth (AdminUser/roles/sessions) is a later, dedicated stage.
 */

import 'server-only'

import { headers } from 'next/headers'
import { notFound } from 'next/navigation'

const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export async function ensureLocalAdmin(): Promise<void> {
  // Hard block anywhere that isn't local development.
  if (process.env.NODE_ENV === 'production') notFound()

  const host = (await headers()).get('host') ?? ''
  const hostname = host.replace(/:\d+$/, '').toLowerCase()

  if (!LOCAL_HOSTNAMES.has(hostname)) notFound()
}
