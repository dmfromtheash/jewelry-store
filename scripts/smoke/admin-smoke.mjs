/**
 * AURELIA — Authenticated admin smoke (Этап 53A)
 *
 * Local-only render smoke for the AUTHENTICATED admin surfaces, run against an
 * ALREADY-RUNNING dev server (admin exists in dev only — `ensureLocalAdmin` 404s
 * under NODE_ENV=production). Dependency-free (Node built-ins); GET-only.
 *
 * How it authenticates WITHOUT weakening anything or leaking secrets:
 *   - It loads `.env` into THIS process via Node's built-in `process.loadEnvFile()`
 *     (same vars Next/Prisma load at runtime) and mints a valid `au_admin_session`
 *     cookie locally, mirroring src/lib/admin/auth.ts (HMAC-SHA256 over a base64url
 *     payload, 12h TTL). The secret, the token, and admin page bodies are NEVER
 *     printed. The minted cookie is sent only to localhost.
 *   - It does NOT touch `ensureLocalAdmin` (the dev server still enforces
 *     localhost + dev), does NOT expose admin, and writes nothing.
 *   - If ADMIN_USERNAME / ADMIN_SESSION_SECRET are not configured, it SKIPS cleanly
 *     (exit 0) with a note — there is no way to mint a session and that is fine.
 *
 * For each surface it asserts BOTH:
 *   - WITH the session cookie  → HTTP 200 + the authenticated shell marker
 *     (`au-adm-shell`, only rendered by app/admin/layout.tsx when a session exists);
 *   - WITHOUT the cookie        → still GATED (redirect to /admin/login), proving the
 *     cookie is what authorizes and admin is not accidentally open.
 *
 * Base URL: $SMOKE_BASE_URL (default http://127.0.0.1:5000). Exit 1 on any failure.
 */

import { createHmac } from 'node:crypto'

const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000)

const ADMIN_SESSION_COOKIE = 'au_admin_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // mirrors src/lib/admin/auth.ts
const MIN_SECRET_LENGTH = 32
const SHELL_MARKER = 'au-adm-shell' // only present in the authenticated admin layout

let failures = 0
const results = []
function record(label, ok, detail) {
  results.push({ label, ok, detail })
  if (!ok) failures++
}

/** Mirrors createToken() in src/lib/admin/auth.ts — never logs the token/secret. */
function mintAdminToken(sub, secret) {
  const now = Math.floor(Date.now() / 1000)
  const payload = { sub, iat: now, exp: now + SESSION_TTL_SECONDS }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

async function get(path, { cookie, redirect = 'follow' } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const headers = { accept: 'text/html', 'user-agent': 'aurelia-admin-smoke/1.0' }
    if (cookie) headers.cookie = cookie
    const res = await fetch(`${BASE}${path}`, { redirect, signal: ctrl.signal, headers })
    const text = redirect === 'manual' ? '' : await res.text()
    return { status: res.status, location: res.headers.get('location') || '', text }
  } finally {
    clearTimeout(t)
  }
}

/** Authenticated GET: must render the admin shell (200 + marker), not the login page. */
async function expectAuthedRender(path, cookie) {
  try {
    const { status, text } = await get(path, { cookie })
    const ok = status === 200 && text.includes(SHELL_MARKER)
    // Never print the body — only a boolean + status.
    const detail = ok
      ? `200, admin shell rendered`
      : status === 200
        ? 'FAIL: 200 but no admin shell (session not accepted?)'
        : `status ${status}`
    record(`authed  ${path}`, ok, detail)
  } catch (e) {
    record(`authed  ${path}`, false, e instanceof Error ? e.message : 'request failed')
  }
}

/** Unauthenticated GET: following redirects must NEVER reach the admin shell — it lands
 *  on the login page (or 404 in prod). This is stronger than checking one redirect hop:
 *  e.g. /admin → /admin/dashboard → /admin/login is correctly "gated" (no shell leaks). */
async function expectGated(path) {
  try {
    const { status, text } = await get(path) // no cookie; follow redirects to the end
    const leaked = text.includes(SHELL_MARKER)
    const ok = !leaked && (status === 200 || status === 404)
    const detail = leaked
      ? 'FAIL: admin shell rendered without a session!'
      : status === 404
        ? 'absent (404, prod)'
        : 'no admin shell without a session'
    record(`gated   ${path}`, ok, detail)
  } catch (e) {
    record(`gated   ${path}`, false, e instanceof Error ? e.message : 'request failed')
  }
}

function loadEnvQuietly() {
  // Built-in, dependency-free. Loads .env THEN .env.local (Next's precedence order: a
  // value in .env.local wins) into process.env so we can mint a LOCAL session. We only
  // READ these files into memory (never modify them) and NEVER print any value.
  for (const file of ['.env', '.env.local']) {
    try {
      process.loadEnvFile(file)
    } catch {
      /* file absent / unsupported — fall back to whatever is already in process.env */
    }
  }
}

async function main() {
  console.log(`Admin smoke against ${BASE}\n`)
  loadEnvQuietly()

  const username = process.env.ADMIN_USERNAME
  const secret = process.env.ADMIN_SESSION_SECRET

  if (!username || !secret || secret.length < MIN_SECRET_LENGTH) {
    console.log(
      '  SKIP  authenticated admin smoke — ADMIN_USERNAME / ADMIN_SESSION_SECRET not configured.',
    )
    console.log(
      '        Set them (>= 32-char secret) in .env to mint a LOCAL admin session and smoke the\n' +
        '        authenticated surfaces. (The unauthenticated gate is covered by `npm run smoke:routes`.)',
    )
    console.log('\nADMIN SMOKE SKIPPED (no admin credentials configured) — not a failure.')
    return
  }

  // Fail fast if the server is not up.
  try {
    await get('/')
  } catch (e) {
    console.error(
      `Server unreachable at ${BASE} — start it first (npm run dev) and the AURELIA DB (npm run db:start).\n  ${e instanceof Error ? e.message : e}`,
    )
    process.exit(1)
  }

  const cookie = `${ADMIN_SESSION_COOKIE}=${mintAdminToken(username, secret)}`

  const surfaces = [
    '/admin',
    '/admin/dashboard',
    '/admin/orders',
    '/admin/catalog',
    '/admin/reviews',
    '/admin/customers',
    '/admin/promotions',
    '/admin/email-outbox',
    '/admin/settings',
    '/admin/content',
    '/admin/audit-log',
  ]

  for (const s of surfaces) {
    await expectAuthedRender(s, cookie)
    await expectGated(s)
  }

  for (const { label, ok, detail } of results) {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`)
  }

  console.log('')
  if (failures === 0) {
    console.log(
      `ADMIN SMOKE OK: ${surfaces.length} admin surface(s) render when authenticated and stay gated when not.`,
    )
  } else {
    console.error(`ADMIN SMOKE FAILED: ${failures}/${results.length} check(s).`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
