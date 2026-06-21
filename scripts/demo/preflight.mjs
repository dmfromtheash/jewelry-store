/**
 * AURELIA — Public-demo preflight & security gate (Этап 52A)
 *
 * A dependency-free, LOCAL, READ-ONLY gate to run BEFORE any public-demo / tunnel /
 * deploy decision. Same style as scripts/smoke/route-smoke.mjs (Node built-ins only).
 *
 * It makes it hard to accidentally expose the project in an unsafe state by asserting
 * the security posture is intact (admin stays local-only by construction, durable auth
 * rate limiting + session revocation are present, the DB target is the isolated 6700 —
 * never dm-bot's 5432) and that the safety tooling/docs exist.
 *
 * It does NOT deploy, NOT create a tunnel, NOT start a server, NOT touch any DB, and
 * NEVER reads or prints `.env` / secrets. It only ever reads repo files + git metadata,
 * and (in --full) runs the two SAFE child checks that need no live server (typecheck,
 * prisma validate). DB/server-dependent checks are PRINTED for the operator to run.
 *
 * Modes:
 *   node scripts/demo/preflight.mjs          # static gate (default)
 *   node scripts/demo/preflight.mjs --full   # static gate + typecheck + prisma validate
 *
 * Exit code 1 if any hard FAIL; WARN/INFO never fail the gate (they need a human look).
 */

import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const FULL = process.argv.includes('--full')

let fails = 0
let warns = 0

function emit(level, label, detail) {
  const tag = level === 'OK' ? 'OK  ' : level
  console.log(`  ${tag} ${label}${detail ? `  (${detail})` : ''}`)
  if (level === 'FAIL') fails++
  else if (level === 'WARN') warns++
}
const ok = (l, d) => emit('OK', l, d)
const warn = (l, d) => emit('WARN', l, d)
const fail = (l, d) => emit('FAIL', l, d)
const section = (name) => console.log(`\n${name}`)

function readText(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
}

/** Runs a read-only command, returns trimmed stdout or null (never throws). */
function gitOut(args) {
  try {
    return execSync(`git ${args}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return null
  }
}

/** Asserts a file exists. */
function assertFile(rel, hard = true) {
  if (existsSync(join(ROOT, rel))) ok(`file present: ${rel}`)
  else (hard ? fail : warn)(`file MISSING: ${rel}`)
}

/** Asserts a repo file contains every one of `needles`. */
function assertContains(rel, needles, hard = true) {
  const text = readText(rel)
  if (text === null) {
    ;(hard ? fail : warn)(`cannot read: ${rel}`)
    return
  }
  for (const n of needles) {
    const found = typeof n === 'string' ? text.includes(n) : n.test(text)
    const label = typeof n === 'string' ? n : String(n)
    if (found) ok(`${rel} contains ${label}`)
    else (hard ? fail : warn)(`${rel} MISSING ${label}`)
  }
}

function checkGit() {
  section('Git hygiene (soft — a human decides):')
  const branch = gitOut('rev-parse --abbrev-ref HEAD')
  if (branch === null) {
    warn('git not available / not a repo')
    return
  }
  branch === 'main' ? ok('on branch main') : warn('not on branch main', branch)

  const porcelain = gitOut('status --porcelain')
  porcelain === '' ? ok('working tree clean') : warn('working tree has uncommitted changes')

  const counts = gitOut('rev-list --left-right --count origin/main...HEAD')
  if (counts) {
    const [behind, ahead] = counts.split(/\s+/)
    if (behind === '0' && ahead === '0') ok('in sync with origin/main')
    else warn('local diverges from origin/main', `behind ${behind}, ahead ${ahead}`)
  } else {
    warn('cannot compare with origin/main (no remote ref?)')
  }
}

function checkScripts() {
  section('Safety tooling — package scripts (hard):')
  const text = readText('package.json')
  let pkg = {}
  try {
    pkg = JSON.parse(text ?? '{}')
  } catch {
    fail('package.json is not valid JSON')
    return
  }
  const scripts = pkg.scripts ?? {}
  for (const name of [
    'typecheck',
    'build',
    'smoke:routes',
    'db:verify:customer-auth',
    'db:start',
    'db:stop',
  ]) {
    scripts[name] ? ok(`npm script present: ${name}`) : fail(`npm script MISSING: ${name}`)
  }
}

function checkFiles() {
  section('Required files & docs (hard):')
  assertFile('scripts/smoke/route-smoke.mjs')
  assertFile('docs/sale/PRE_PUBLIC_DEMO_READINESS.md')
  assertFile('docs/sale/LIVE_DEMO_DEPLOY_READINESS.md')
  assertFile('docs/sale/LOCAL_TUNNEL_DEMO_RUNBOOK.md')
}

function checkSecurityPosture() {
  section('Security posture in code (hard):')
  // Durable rate limiting + session revocation + audit are all present in the schema.
  assertContains('prisma/schema.prisma', [
    'model CustomerAuthThrottle',
    'model Customer',
    'model AdminAuditLog',
    'sessionVersion',
    'passwordChangedAt',
    // Trust & operations foundation (Этап 59A): moderated reviews, manual delivery
    // branch fields, and the no-send email outbox foundation.
    'model ProductReview',
    'model EmailOutbox',
    'deliveryBranch',
    // Account recovery / email verification token foundation (Этап 60A): hashed,
    // single-use tokens + verification status. NO real email sending (owner-gated).
    'model CustomerAccountToken',
    'emailVerifiedAt',
  ])
  // Admin is local-only BY CONSTRUCTION: 404 in production / non-localhost.
  assertContains('src/lib/admin/guard.ts', ['ensureLocalAdmin', 'notFound', 'production'])
}

function checkDbTarget() {
  section('Database target safety (isolated 6700, never dm-bot 5432):')
  // Only ever read the PORT from DATABASE_URL (if the process even has it) — never the
  // user/password/host. We print the port number ONLY.
  const url = process.env.DATABASE_URL
  if (url) {
    const m = url.match(/@[^/]*?:(\d{2,5})(?:[/?]|$)/) || url.match(/:(\d{2,5})\//)
    const port = m ? m[1] : null
    if (port === '6700') ok('DATABASE_URL points at the isolated AURELIA DB', 'port 6700')
    else if (port === '5432') fail('DATABASE_URL points at port 5432 — that is dm-bot, STOP')
    else warn('DATABASE_URL port not recognized', port ? `port ${port}` : 'unparsed')
  } else {
    warn('DATABASE_URL not loaded in this process', 'Prisma/Next load it at runtime — informational only')
  }

  // App code must never hard-target 5432. git grep exits non-zero (throws) when clean.
  try {
    const hits = execSync('git grep -nI "5432" -- src prisma', {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
    warn('"5432" appears in app code (src/prisma) — review', hits.split('\n')[0])
  } catch {
    ok('no "5432" reference in app code (src/prisma)')
  }
}

function checkHonestClaims() {
  section('Docs carry honest gating language (soft):')
  // The readiness doc must NOT over-claim: payment is owner/provider-gated and admin is
  // local-only. We assert the honest wording is present (not absent).
  const rel = 'docs/sale/PRE_PUBLIC_DEMO_READINESS.md'
  const text = (readText(rel) ?? '').toLowerCase()
  const phrases = [
    ['owner-gated decision language', ['owner']],
    ['payment not-implemented note', ['payment']],
    ['admin local-only note', ['admin', 'local']],
    ['deploy disclaimer', ['not', 'deploy']],
  ]
  for (const [label, needles] of phrases) {
    needles.every((n) => text.includes(n))
      ? ok(`${rel}: ${label} present`)
      : warn(`${rel}: ${label} MISSING — review for honesty`)
  }
}

function runFullChildren() {
  section('Full checks — safe child commands (no live server needed):')
  const run = (label, cmd) => {
    try {
      execSync(cmd, { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'], timeout: 240000 })
      ok(label)
    } catch {
      fail(`${label} FAILED — run \`${cmd}\` to see details`)
    }
  }
  run('npm run typecheck', 'npm run typecheck')
  run('npx prisma validate', 'npx prisma validate')

  section('Run these WITH the AURELIA DB (6700) + dev server up — NOT auto-run here:')
  console.log('  •  npm run db:start && npm run db:verify:customer-auth   # then npm run db:stop')
  console.log('  •  npm run dev   (separate terminal)  &&  npm run smoke:routes')
  console.log('  •  npm run build')
}

function reminders() {
  section('Reminders — this gate is NOT a deployment:')
  console.log('  •  Preflight does NOT deploy, tunnel, or expose anything.')
  console.log('  •  A public demo still needs EXPLICIT owner approval, per-demo.')
  console.log('  •  A live/production demo needs a separate DB + secrets + access plan.')
  console.log('  •  Admin must NOT be exposed publicly without a security review.')
  console.log('  •  Payment / delivery / legal remain owner / provider / lawyer-gated.')
  console.log('  •  Product imagery remains a demo/sale limitation until the owner supplies')
  console.log('     licensed images.')
}

function main() {
  console.log(`AURELIA public-demo preflight${FULL ? ' (--full)' : ''}`)

  checkGit()
  checkScripts()
  checkFiles()
  checkSecurityPosture()
  checkDbTarget()
  checkHonestClaims()
  if (FULL) runFullChildren()
  reminders()

  console.log('')
  if (fails === 0) {
    console.log(`PREFLIGHT OK — no blocking failures (${warns} warning(s) to review).`)
    console.log('This is a readiness gate, not approval to deploy.')
  } else {
    console.error(`PREFLIGHT FAILED — ${fails} blocking failure(s), ${warns} warning(s).`)
    process.exit(1)
  }
}

main()
