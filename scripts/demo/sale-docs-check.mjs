/**
 * AURELIA — Sale-docs consistency check (Этап 53A)
 *
 * Dependency-free, read-only scan of the BUYER-FACING sale docs for claims that
 * contradict the current implementation, so the sale package can't drift out of sync
 * with the code. It NEVER rewrites docs — it only reports.
 *
 * Reality as of 53A (what the docs must NOT contradict):
 *   - Customer ACCOUNTS exist (registration / login / personal cabinet / order history,
 *     47A–47C) — alongside guest checkout. So "guest checkout only" / "no customer
 *     account" / "no order history" are FALSE now.
 *   - Payment + delivery are MANUAL (no provider/carrier API). So "payment API
 *     implemented" / "delivery API integrated" are FALSE.
 *   - Nothing is deployed / hosted; admin is local-only. So "deployed to production" /
 *     "public admin is ready" are FALSE.
 *   - Product imagery is placeholder. So "real product photos complete" is FALSE.
 *
 * Lines that are clearly NEGATIONS / honest disclaimers (contain ❌, "no ", "not",
 * "without", "must not", "never", "instead of", "isn't") are SKIPPED for the
 * false-feature patterns, so honest "no payment API" wording is not flagged.
 *
 * Exit 1 on any FAIL. WARN/INFO never fail the check.
 */

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// Buyer-facing docs a prospective buyer actually reads. Operator/meta docs
// (PRE_PUBLIC_DEMO_READINESS, LIVE_DEMO_DEPLOY_READINESS, LOCAL_TUNNEL_DEMO_RUNBOOK,
// DEMO_SALE_READINESS_REPORT, OWNER_DECISION_CHECKLIST, PAYMENT_DELIVERY_PROVIDER_RESEARCH,
// …) legitimately DISCUSS these limitations and are intentionally NOT scanned here.
const BUYER_DOCS = [
  'docs/sale/README.md',
  'docs/sale/SELLER_OFFER_ONE_PAGER.md',
  'docs/sale/BUYER_DEMO_SCRIPT.md',
  'docs/sale/FEATURES_AND_LIMITS.md',
  'docs/sale/FINAL_BUYER_HANDOFF.md',
  'docs/sale/SETUP_AND_HANDOFF_CHECKLIST.md',
  'docs/sale/DEMO_RUNBOOK.md',
  'README.md',
]

// STALE NEGATIVES — true before 47A, FALSE now that customer accounts exist.
// These are positive false statements (no negation guard applies).
const STALE_NEGATIVES = [
  { re: /guest[-\s]?checkout[-\s]?only|only\s+guest\s+checkout|guest[-\s]only/i, why: 'customer accounts exist (guest checkout is not the only option)' },
  { re: /\bno\s+(customer\s+)?account(s)?\b/i, why: 'customer accounts are implemented (47A–47C)' },
  { re: /\bno\s+(personal\s+)?(cabinet|account\s+system)\b/i, why: 'a customer cabinet (/account) exists' },
  { re: /\bno\s+order\s+history\b/i, why: 'customer order history is implemented' },
  { re: /\bno\s+(login|registration|sign[-\s]?in|sign[-\s]?up)\b/i, why: 'login/registration are implemented' },
  { re: /accounts?\s+(are\s+|is\s+)?not\s+(yet\s+)?(implemented|supported|available)/i, why: 'customer accounts ARE implemented' },
]

// FALSE FEATURE CLAIMS — features that are NOT built. Tight, AFFIRMATIVE patterns
// (so doc index lines / disclaimers don't trip them). Skipped on negation lines too.
const FALSE_FEATURES = [
  { re: /payment(s)?\s+(provider|gateway|acquir\w+|api)\s+(is\s+|are\s+)?(integrated|implemented|connected|live)\b/i, why: 'no payment provider/API is integrated (manual payment only)' },
  { re: /\b(liqpay|wayforpay|fondy|stripe|google\s*pay|apple\s*pay)\s+(is\s+)?(integrated|implemented|connected|live|enabled)\b/i, why: 'no payment acquirer is integrated' },
  { re: /(delivery|carrier|shipping)\s+(api|integration)\s+(is\s+|are\s+)?(integrated|implemented|connected|live)\b/i, why: 'no carrier/delivery API is integrated (manual delivery note only)' },
  { re: /(nova\s*poshta|ukrposhta)\s+(api|integration)\s+(is\s+)?(integrated|implemented|connected)\b/i, why: 'no carrier API is integrated' },
  { re: /\bdeployed\s+to\s+production\b|\bin\s+production\s+(now|already|today)\b|\blive\s+(production\s+)?(site|shop|store)\b|\bproduction\s+(site|shop|store)\s+is\s+(live|up|ready)\b/i, why: 'nothing is deployed/hosted — local demo only' },
  { re: /public\s+admin\s+(is\s+)?(ready|available|live|enabled|exposed)\b/i, why: 'admin is local-only by design; never public' },
  { re: /real\s+(product\s+)?(photos|images|imagery)\s+(are\s+)?(complete|done|added|finished|in\s+place)\b/i, why: 'product imagery is placeholder (demo limitation)' },
]

const NEGATION = /❌|\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bmust not\b|\binstead of\b|\bisn'?t\b|\baren'?t\b|\bplaceholder\b|\bdeferred\b|\bnot yet\b|\bnothing\b|\bplanning only\b|\bdemo only\b|\bno real\b/i

let fails = 0
let warns = 0
let scanned = 0

function check() {
  for (const rel of BUYER_DOCS) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) {
      console.log(`  WARN  missing buyer doc: ${rel}`)
      warns++
      continue
    }
    scanned++
    const lines = readFileSync(abs, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      const ln = i + 1
      // Stale negatives: these ARE the false claim, so we do NOT skip on negation.
      for (const { re, why } of STALE_NEGATIVES) {
        if (re.test(line)) {
          console.log(`  FAIL  ${rel}:${ln} — stale claim: ${why}`)
          console.log(`        > ${line.trim().slice(0, 120)}`)
          fails++
        }
      }
      // False-feature claims: skip honest negations/disclaimers.
      if (NEGATION.test(line)) return
      for (const { re, why } of FALSE_FEATURES) {
        if (re.test(line)) {
          console.log(`  FAIL  ${rel}:${ln} — false claim: ${why}`)
          console.log(`        > ${line.trim().slice(0, 120)}`)
          fails++
        }
      }
    })
  }
}

function main() {
  console.log('AURELIA sale-docs consistency check\n')
  check()
  console.log('')
  if (fails === 0) {
    console.log(`SALE-DOCS OK: ${scanned} buyer-facing doc(s) scanned; no contradicting claims found (${warns} warning(s)).`)
  } else {
    console.error(`SALE-DOCS FAILED: ${fails} contradicting claim(s) in buyer-facing docs, ${warns} warning(s).`)
    process.exit(1)
  }
}

main()
