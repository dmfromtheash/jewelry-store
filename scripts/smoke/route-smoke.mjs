/**
 * AURELIA — Route render smoke (Этап 50A)
 *
 * Dependency-free HTTP smoke for the business-critical routes, run against an
 * ALREADY-RUNNING AURELIA server (start `npm run dev` first; see ./README.md). It
 * uses Node's built-in fetch — NO browser engine, NO new dependency. It only ever
 * issues GET requests, so it never writes data and never submits an order; the
 * order/checkout/auth business logic is covered server-side by the `db:verify:*`
 * scripts (rolled-back transactions).
 *
 * What it asserts per route:
 *   - storefront/account/login pages: HTTP 200 + an HTML body (the page rendered,
 *     no 500). `/account` logged-out renders its in-page login prompt (still 200).
 *   - protected /admin/* pages: correctly GATED — a redirect to /admin/login (dev,
 *     no session) or 404 (production, where admin does not exist). A 200 here would
 *     mean protected admin content leaked without a session → FAIL. A 5xx → FAIL.
 *
 * Base URL: $SMOKE_BASE_URL (default http://127.0.0.1:5000). Exit code 1 on any
 * failure or if the server is unreachable.
 */

const BASE = (process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 20000)

let failures = 0
const results = []

function record(label, ok, detail) {
  results.push({ label, ok, detail })
  if (!ok) failures++
}

async function get(path, { redirect = 'follow' } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${BASE}${path}`, {
      redirect,
      signal: ctrl.signal,
      headers: { accept: 'text/html', 'user-agent': 'aurelia-route-smoke/1.0' },
    })
    const body = redirect === 'manual' ? '' : await res.text()
    return { status: res.status, location: res.headers.get('location') || '', body }
  } finally {
    clearTimeout(t)
  }
}

/** A public page must return 200 with an HTML document. */
async function expectOk(path) {
  try {
    const { status, body } = await get(path)
    const isHtml = /<html[\s>]/i.test(body) || /<!doctype html/i.test(body)
    record(path, status === 200 && isHtml, `status ${status}${isHtml ? '' : ', no <html>'}`)
  } catch (e) {
    record(path, false, e instanceof Error ? e.message : 'request failed')
  }
}

/** A protected admin page must be GATED (redirect→login in dev, or 404 in prod) —
 *  never a 200 render of admin content, never a 5xx. */
async function expectGatedAdmin(path) {
  try {
    const { status, location } = await get(path, { redirect: 'manual' })
    const redirectToLogin = status >= 300 && status < 400 && /\/admin\/login/.test(location)
    const absentInProd = status === 404
    const ok = redirectToLogin || absentInProd
    const detail = ok
      ? redirectToLogin
        ? `gated → ${location}`
        : 'absent (404, prod)'
      : status === 200
        ? 'FAIL: rendered 200 without a session (exposed!)'
        : `unexpected status ${status}`
    record(path, ok, detail)
  } catch (e) {
    record(path, false, e instanceof Error ? e.message : 'request failed')
  }
}

/** Derives a real product URL from the home page so the smoke survives catalog
 *  changes; falls back to a known seeded slug. */
async function resolveProductPath() {
  try {
    const { body } = await get('/')
    const m = body.match(/\/product\/(?!coming-soon)[a-z0-9-]+/i)
    if (m) return m[0]
  } catch {
    /* fall through to the default */
  }
  return '/product/serogi-kaplya'
}

async function main() {
  console.log(`Route smoke against ${BASE}\n`)

  // Fail fast with a clear message if the server is not up.
  try {
    await get('/')
  } catch (e) {
    console.error(
      `Server unreachable at ${BASE} — start it first (npm run dev) and the AURELIA DB (npm run db:start).\n  ${e instanceof Error ? e.message : e}`,
    )
    process.exit(1)
  }

  const productPath = await resolveProductPath()

  const publicRoutes = [
    '/',
    '/category/bijouterie',
    '/category/gifts',
    productPath,
    '/product/coming-soon',
    '/search?q=%D0%BA%D0%B0%D0%B1%D0%BB%D1%83%D1%87%D0%BA%D0%B0',
    '/contacts',
    '/delivery',
    '/help',
    '/returns',
    '/stores',
    '/about',
    '/favorites',
    '/checkout',
    '/checkout/success',
    '/account', // logged-out in-page prompt (still 200)
    '/account/recover', // password-reset request page (Этап 60A)
    '/account/reset', // password-reset confirm page (no token → in-page notice, still 200)
    '/admin/login', // local-only login page renders in dev
  ]

  const adminRoutes = ['/admin/audit-log', '/admin/orders', '/admin/catalog', '/admin/dashboard', '/admin/promotions', '/admin/customers']

  for (const r of publicRoutes) await expectOk(r)
  for (const r of adminRoutes) await expectGatedAdmin(r)

  for (const { label, ok, detail } of results) {
    console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? `  (${detail})` : ''}`)
  }

  console.log('')
  if (failures === 0) {
    console.log(`ROUTE SMOKE OK: ${results.length} routes rendered/gated as expected.`)
  } else {
    console.error(`ROUTE SMOKE FAILED: ${failures}/${results.length} route(s).`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
