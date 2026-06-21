/**
 * AURELIA — Screenshot capture helper (Этап 55A)
 *
 * Dependency-free screenshot capture for buyer/demo evidence, using the ALREADY-
 * INSTALLED Microsoft Edge (Chromium) in headless mode — NO Playwright/Puppeteer, no
 * npm dependency. It runs against an ALREADY-RUNNING local dev server.
 *
 * SCOPE — UNAUTHENTICATED pages only. Edge's `--screenshot` flag does a single GET and
 * cannot carry a session cookie, so it can only capture pages that render without a
 * login (storefront, the logged-out `/account` cabinet prompt, `/admin/login`). The
 * AUTHENTICATED proofs (logged-in account, order history/detail, admin audit-log with
 * `customer.*` events) are captured via the MANUAL checklist in
 * docs/sale/SCREENSHOT_INVENTORY.md — automating them would need a CDP driver plus
 * committed demo data, which this stage deliberately does not force.
 *
 * Safety: GET-only, local only, never starts a server/DB, never deploys, never reads or
 * prints `.env`/secrets, and only writes the PNGs listed in TARGETS. It does NOT
 * overwrite the curated historical screenshots — it writes the specific new files named
 * below. Re-running is idempotent (overwrites only its own targets).
 *
 *   npm run demo:capture            # capture the default target set
 *
 * Env: CAPTURE_BASE_URL (default http://127.0.0.1:5000), EDGE_PATH (override Edge exe).
 */

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SHOTS_DIR = join(ROOT, 'docs', 'sale', 'screenshots')
const BASE = (process.env.CAPTURE_BASE_URL || 'http://127.0.0.1:5000').replace(/\/$/, '')

const EDGE_CANDIDATES = [
  process.env.EDGE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean)

/** New, UNAUTHENTICATED evidence this stage adds. Curated historical shots are not
 *  touched. width/height are the headless viewport. */
const TARGETS = [
  // The customer cabinet entry point (logged-out prompt) — NEW visual proof post-47A.
  { file: 'account-login-prompt.png', path: '/account', width: 1280, height: 900 },
]

function findEdge() {
  for (const p of EDGE_CANDIDATES) if (p && existsSync(p)) return p
  return null
}

async function serverUp() {
  try {
    const res = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(8000) })
    return !!res.status
  } catch {
    return false
  }
}

function capture(edge, target, udd) {
  const out = join(SHOTS_DIR, target.file)
  execFileSync(
    edge,
    [
      '--headless',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      `--window-size=${target.width},${target.height}`,
      `--user-data-dir=${udd}`,
      '--virtual-time-budget=5000', // let the page paint before the shot
      `--screenshot=${out}`,
      `${BASE}${target.path}`,
    ],
    { stdio: ['ignore', 'ignore', 'ignore'], timeout: 60000 },
  )
  if (!existsSync(out) || statSync(out).size === 0) {
    throw new Error(`no PNG written for ${target.path}`)
  }
  return { out, bytes: statSync(out).size }
}

async function main() {
  console.log(`AURELIA screenshot capture (Edge headless) against ${BASE}\n`)

  const edge = findEdge()
  if (!edge) {
    console.error(
      'Microsoft Edge not found. Set EDGE_PATH to msedge.exe, or capture the targets\n' +
        'manually per docs/sale/SCREENSHOT_INVENTORY.md.',
    )
    process.exit(1)
  }

  if (!(await serverUp())) {
    console.error(
      `Dev server not reachable at ${BASE} — start it first:\n` +
        '  npm run db:start && npm run dev   (then re-run npm run demo:capture)',
    )
    process.exit(1)
  }

  if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true })
  const udd = mkdtempSync(join(tmpdir(), 'aurelia-capture-'))

  let failures = 0
  try {
    for (const t of TARGETS) {
      try {
        const { bytes } = capture(edge, t, udd)
        console.log(`  OK   ${t.file}  (${t.path}, ${bytes} bytes)`)
      } catch (e) {
        console.log(`  FAIL ${t.file}  (${t.path}) — ${e instanceof Error ? e.message : 'error'}`)
        failures++
      }
    }
  } finally {
    rmSync(udd, { recursive: true, force: true })
  }

  console.log('')
  console.log('Note: authenticated screens (logged-in account, order history/detail, admin')
  console.log('audit-log customer.* events) are captured MANUALLY — see')
  console.log('docs/sale/SCREENSHOT_INVENTORY.md. This helper does unauthenticated pages only.')

  if (failures === 0) {
    console.log(`\nCAPTURE OK: ${TARGETS.length} unauthenticated target(s) written to docs/sale/screenshots/.`)
  } else {
    console.error(`\nCAPTURE FAILED: ${failures}/${TARGETS.length} target(s).`)
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
