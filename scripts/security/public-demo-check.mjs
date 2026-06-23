/**
 * AURELIA — Public-demo hardening check (Этап 76A)
 *
 * A dependency-free, LOCAL, READ-ONLY static check that the public-demo browser-security
 * hardening (closing 75A findings F1 + F6) is in place and has not silently regressed. Same
 * Node-built-ins style as scripts/demo/preflight.mjs — it starts NO server, touches NO DB,
 * makes NO network call, and NEVER reads `.env` / secrets. It only reads repo source files.
 *
 * It asserts:
 *   A. Security headers — next.config.ts defines a `headers()` block emitting CSP (with
 *      `frame-ancestors 'none'`), X-Frame-Options: DENY, X-Content-Type-Options: nosniff,
 *      Referrer-Policy, and Permissions-Policy; and the CSP does NOT whitelist any external
 *      analytics / pixel / payment / email domain (no tracker creep).
 *   B. JSON-LD escaping — src/lib/seo/site.ts exports `serializeJsonLd` and it escapes `<`
 *      (emits the < escape); and NO inline ld+json sink in app/ uses a bare
 *      `JSON.stringify` (which would leave a literal `<` and risk a `</script>` break-out).
 *   C. Docs — docs/security/PUBLIC_DEMO_HARDENING_76A.md exists, carries the honest
 *      "still NOT real launch" / owner-gated language, and never claims the public launch is
 *      ready.
 *
 * Exit 1 on any FAIL. Run: npm run security:public-demo
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

let fails = 0
let warns = 0

function ok(label, detail) {
  console.log(`  OK   ${label}${detail ? `  (${detail})` : ''}`)
}
function fail(label, detail) {
  console.log(`  FAIL ${label}${detail ? `  (${detail})` : ''}`)
  fails++
}
function warn(label, detail) {
  console.log(`  WARN ${label}${detail ? `  (${detail})` : ''}`)
  warns++
}
function section(name) {
  console.log(`\n${name}`)
}

function read(rel) {
  try {
    return readFileSync(join(ROOT, rel), 'utf8')
  } catch {
    return null
  }
}

/** Recursively lists files under a dir matching a predicate (relative paths). */
function walk(relDir, match, out = []) {
  const abs = join(ROOT, relDir)
  if (!existsSync(abs)) return out
  for (const entry of readdirSync(abs)) {
    const absEntry = join(abs, entry)
    const rel = relative(ROOT, absEntry).split('\\').join('/')
    if (statSync(absEntry).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(rel, match, out)
    } else if (match(rel)) {
      out.push(rel)
    }
  }
  return out
}

// ── A. Security headers ────────────────────────────────────────────────────────────────────
function checkHeaders() {
  section('A. Browser security headers (next.config.ts):')
  const cfg = read('next.config.ts')
  if (cfg === null) {
    fail('next.config.ts is missing')
    return
  }
  const must = [
    ['headers() block', /async\s+headers\s*\(/],
    ['Content-Security-Policy header', /Content-Security-Policy/],
    ["CSP frame-ancestors 'none'", /frame-ancestors\s+'none'/],
    ['X-Frame-Options: DENY', /X-Frame-Options[\s\S]{0,40}DENY/],
    ['X-Content-Type-Options: nosniff', /X-Content-Type-Options[\s\S]{0,40}nosniff/],
    ['Referrer-Policy', /Referrer-Policy[\s\S]{0,60}strict-origin-when-cross-origin/],
    ['Permissions-Policy', /Permissions-Policy/],
    ["default-src 'self'", /default-src\s+'self'/],
    ["object-src 'none'", /object-src\s+'none'/],
  ]
  for (const [label, re] of must) {
    re.test(cfg) ? ok(`config has ${label}`) : fail(`config MISSING ${label}`)
  }

  // No tracker/payment/email domain may sneak into the CSP allow-list.
  const FORBIDDEN_DOMAINS = [
    'google-analytics.com',
    'googletagmanager.com',
    'connect.facebook.net',
    'facebook.com',
    'analytics.tiktok.com',
    'doubleclick.net',
    'hotjar.com',
    'sentry.io',
    'liqpay',
    'wayforpay',
    'stripe.com',
  ]
  const sneaked = FORBIDDEN_DOMAINS.filter((d) => cfg.includes(d))
  sneaked.length === 0
    ? ok('CSP allows no external analytics/pixel/payment/email domain')
    : fail('CSP whitelists a forbidden external domain', sneaked.join(', '))

  // HSTS must NOT be forced in the local config (it belongs at the prod HTTPS/proxy layer).
  const hasHsts = /Strict-Transport-Security/i.test(cfg)
  hasHsts
    ? warn('Strict-Transport-Security present in next.config.ts — confirm it is only for prod HTTPS')
    : ok('no HSTS forced locally (documented as a prod/hosting-layer header)')
}

// ── B. JSON-LD escaping ────────────────────────────────────────────────────────────────────
function checkJsonLd() {
  section('B. JSON-LD escaping (src/lib/seo/site.ts + sinks):')
  const site = read('src/lib/seo/site.ts')
  if (site === null) {
    fail('src/lib/seo/site.ts is missing')
  } else {
    const hasHelper = /export function serializeJsonLd/.test(site)
    const escapesLt = site.includes('\\u003c')
    hasHelper ? ok('site.ts exports serializeJsonLd') : fail('site.ts does NOT export serializeJsonLd')
    escapesLt
      ? ok('serializeJsonLd escapes "<" → \\u003c')
      : fail('serializeJsonLd does NOT emit the \\u003c escape for "<"')
  }

  // Every inline ld+json sink in app/ must use serializeJsonLd — never a bare JSON.stringify.
  const tsx = walk('app', (rel) => rel.endsWith('.tsx'))
  const ldFiles = tsx.filter((rel) => (read(rel) ?? '').includes('application/ld+json'))
  if (ldFiles.length === 0) {
    warn('no application/ld+json sink found in app/ — nothing to verify')
  }
  const unsafe = /dangerouslySetInnerHTML\s*=\s*\{\{\s*__html:\s*JSON\.stringify/
  for (const rel of ldFiles) {
    const text = read(rel) ?? ''
    if (unsafe.test(text)) {
      fail(`${rel} uses a bare JSON.stringify in a ld+json sink`, 'use serializeJsonLd')
    } else if (text.includes('serializeJsonLd')) {
      ok(`${rel} serialises ld+json via serializeJsonLd`)
    } else {
      warn(`${rel} has a ld+json sink but no serializeJsonLd reference — review`)
    }
  }
}

// ── C. Docs ────────────────────────────────────────────────────────────────────────────────
function checkDocs() {
  section('C. Public-demo hardening doc (docs/security/PUBLIC_DEMO_HARDENING_76A.md):')
  const rel = 'docs/security/PUBLIC_DEMO_HARDENING_76A.md'
  const doc = read(rel)
  if (doc === null) {
    fail(`${rel} is missing`)
    return
  }
  ok(`${rel} present`)
  const lc = doc.toLowerCase()
  // Honest gating language must be present.
  const gates = [
    ['owner-gated language', ['owner']],
    ['not-real-launch disclaimer', ['not', 'real launch']],
    ['production-build / HTTPS requirement', ['production', 'https']],
    ['admin stays non-public note', ['admin']],
  ]
  for (const [label, needles] of gates) {
    needles.every((n) => lc.includes(n)) ? ok(`doc carries ${label}`) : warn(`doc MISSING ${label} — review`)
  }
  // The doc must NOT claim the public launch is fully ready.
  const FALSE_CLAIMS = [
    /public\s+launch\s+(is\s+)?(fully\s+)?(ready|complete|done)/i,
    /ready\s+for\s+(real\s+)?(production|launch)\b/i,
    /deployed\s+to\s+production/i,
  ]
  const offending = FALSE_CLAIMS.filter((re) => re.test(doc))
  offending.length === 0
    ? ok('doc makes no "public launch ready" claim')
    : fail('doc over-claims launch readiness', `${offending.length} pattern(s) matched`)
}

function main() {
  console.log('AURELIA public-demo hardening check (Этап 76A)')
  checkHeaders()
  checkJsonLd()
  checkDocs()
  console.log('')
  if (fails === 0) {
    console.log(`PUBLIC-DEMO HARDENING OK — no blocking failures (${warns} warning(s) to review).`)
  } else {
    console.error(`PUBLIC-DEMO HARDENING FAILED — ${fails} blocking failure(s), ${warns} warning(s).`)
    process.exit(1)
  }
}

main()
