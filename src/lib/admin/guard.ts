/**
 * AURELIA — Local/dev admin guard (Этап 17A)
 *
 * This is the local-only gate (NOT identity): admin routes are allowed ONLY in
 * development AND only when served to a localhost host. In production (or any
 * non-local host) the guard calls notFound(), so admin pages simply do not
 * exist there.
 *
 * Identity/sessions are layered on top in ./auth (Этап 18A): protected pages and
 * the mutation action call ensureLocalAdmin() AND requireAdminSession().
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
