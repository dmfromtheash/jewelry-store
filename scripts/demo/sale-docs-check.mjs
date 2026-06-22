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
 *   - Reviews are MODERATED demo content (no purchase verification); delivery is a manual
 *     branch/comment note (no carrier API / no TTN / no tracking); email is a FOUNDATION
 *     that sends NOTHING (no provider). Password reset + email verification have a HASHED
 *     single-use TOKEN foundation (Этап 60A) but NO email delivery, NO provider
 *     (SendGrid/Mailgun/SMTP), and NO DNS auth (SPF/DKIM/DMARC). So "verified customer
 *     reviews" / "TTN generated" / "emails are sent" / "password reset works via email" /
 *     "email verification delivered" / "SMTP configured" are all FALSE.
 *   - Catalog UX / SEO / server-side account wishlist exist (Этап 62A: honest approved-only
 *     ratings, product/category metadata + Product JSON-LD, URL filters/sorting, DB-backed
 *     wishlist).
 *   - A MANUAL-checkout promo/discount foundation exists (Этап 63A: admin promo codes +
 *     server-authoritative percent/fixed discount on the order). So "promo/discount foundation
 *     implemented" is HONEST now. But gift cards, marketing automation/CRM, STACKABLE
 *     promotions, automatic campaigns, and payment-provider-level discounts are NOT built — so
 *     "gift cards implemented" / "stackable promotions" / "marketing automation live" are FALSE.
 *   - Advanced catalog discovery exists (Этап 64A: URL price-range + material/coating facet +
 *     richer LOCAL search + honest approved-review rating sort). So "catalog filters / price
 *     range / rating sort / richer local search implemented" is HONEST. But there is NO AI/
 *     semantic search, NO external search engine (Algolia/Elastic/…), and NO merchandising
 *     automation — so claiming those is FALSE.
 *   - An admin OPERATIONS DASHBOARD exists (Этап 65A: read-only overview + "needs attention"
 *     queue + owner-gated readiness warnings + links). So "admin operations dashboard
 *     implemented" is HONEST. But the web admin CANNOT execute shell/CLI commands (command
 *     names are documentation text only) and NO external analytics/BI platform is integrated —
 *     so claiming either is FALSE.
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
  // Shipped security features (49A/51A) must not be presented as missing/deferred. Self-
  // contained (the deferral word is part of the match), so no negation guard is applied.
  { re: /(durable\s+rate[-\s]?limit\w*|(?:customer[-\s]?auth\s+|auth\s+)audit\s+log\w*)\b.{0,45}\b(deferred|planned|still\s+missing|not\s+(yet\s+)?(implemented|done|supported|available)|—?\s*later\b)/i, why: 'durable single-instance rate limiting (51A) + customer-auth audit logging (49A) ARE implemented' },
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
  // Trust & operations foundation (Этап 59A) — these are FOUNDATIONS, not the real thing.
  { re: /\b(verified|genuine|authentic|real)\s+(customer\s+|purchase\s+)?reviews\b/i, why: 'reviews are demo/moderated — there is NO purchase verification' },
  { re: /\b(ttn|tracking\s+number|tracking\s+code)\s+(is\s+|are\s+)?(generated|created|implemented|integrated|available|provided)\b/i, why: 'no TTN/tracking is generated (manual delivery only)' },
  { re: /\border\s+tracking\s+(is\s+)?(implemented|available|live|enabled)\b/i, why: 'no order tracking is implemented (manual delivery only)' },
  { re: /\be?-?mails?\s+(notifications?\s+)?(are\s+)?(sent|delivered|dispatched|being\s+sent|enabled|active)\b/i, why: 'no emails are sent — email is a foundation/stub only (no provider)' },
  { re: /password\s+reset\s+(via\s+e?-?mail\s+)?(works|is\s+(live|implemented|enabled|available|functional))\b/i, why: 'password reset email DELIVERY is NOT implemented (token foundation only, owner/provider-gated)' },
  // Email-ops foundation (Этап 60A) — token/outbox foundation exists, but DELIVERY and any
  // provider/DNS setup do NOT. Affirmative + negation-guarded (honest "not configured" is fine).
  { re: /email\s+verification\s+(emails?\s+)?(is\s+|are\s+)?(delivered|sent|works|live|functional)\b/i, why: 'email verification delivery is NOT implemented (token foundation only)' },
  { re: /\b(sendgrid|mailgun|postmark|amazon\s*ses|smtp)\s+(is\s+)?(configured|integrated|connected|wired|live|enabled|set\s*up)\b/i, why: 'no email provider (SendGrid/Mailgun/SMTP/…) is configured — owner-gated' },
  { re: /\b(spf|dkim|dmarc)\b.{0,30}\b(configured|set\s*up|done|complete|passing|in\s+place)\b/i, why: 'no email DNS auth (SPF/DKIM/DMARC) is set up — owner-gated' },
  { re: /\bemail\s+provider\s+(integration\s+)?(is\s+)?(live|implemented|integrated|connected|wired)\b/i, why: 'no email provider integration is live — foundation only' },
  // Promotions (Этап 63A): a MANUAL-checkout promo/discount foundation IS implemented (admin
  // promo codes + server-authoritative discount). So "promo/discount foundation implemented"
  // is now honest and must NOT be flagged. What is still NOT built — and must not be claimed —
  // is gift cards, marketing automation/CRM, STACKABLE promotions, automatic campaigns, and any
  // payment-provider-level discount. Affirmative + negation-guarded (honest "no …" lines pass).
  { re: /\bgift\s*cards?\s+(are\s+)?(implemented|supported|available|live|enabled|sold|issued)\b/i, why: 'no gift cards are implemented' },
  { re: /\b(marketing\s+automation|email\s+marketing|drip\s+campaign\w*|crm\s+integration)\s+(is\s+|are\s+)?(implemented|integrated|live|enabled|connected|available)\b/i, why: 'no marketing automation / email marketing / CRM integration is implemented' },
  { re: /\bstackable\s+(promotions?|discounts?|coupons?|campaigns?)\s+(are\s+)?(implemented|supported|available|enabled|live)\b/i, why: 'promo codes do NOT stack (one code per order); stackable promotions are not implemented' },
  { re: /\b(automatic|scheduled)\s+(marketing\s+)?(promo\w*|discount|campaign)s?\s+(are\s+)?(implemented|live|running|automated|enabled)\b/i, why: 'no automatic/scheduled marketing campaigns (manual promo codes only)' },
  { re: /\b(payment|provider|gateway|acquirer)[-\s]?(level\s+)?(discounts?|coupons?|promotions?)\s+(are\s+)?(integrated|implemented|connected|live)\b/i, why: 'no payment-provider/gateway discounts (manual checkout promo codes only)' },
  // Catalog discovery (Этап 64A): local DB-backed filters/search/rating-sort ARE implemented,
  // so "catalog filters / price range / rating sort / richer local search implemented" is honest.
  // What is NOT built: AI search, an external search ENGINE/service, and merchandising automation.
  // Affirmative + negation-guarded (honest "no AI search" lines pass).
  { re: /\b(ai|ml|semantic|vector|neural|llm)[-\s]?(powered\s+)?search\s+(is\s+)?(implemented|integrated|live|enabled|available|added)\b/i, why: 'no AI/semantic search is implemented (local DB-backed search only)' },
  { re: /\b(elasticsearch|elastic\s+search|algolia|meilisearch|typesense|opensearch|solr)\s+(is\s+)?(integrated|implemented|connected|configured|live|enabled)\b/i, why: 'no external search engine/service is integrated (local search only)' },
  { re: /\bexternal\s+search\s+(engine|service|provider)\s+(is\s+)?(integrated|implemented|connected|live|enabled)\b/i, why: 'no external search engine/service is integrated (local search only)' },
  { re: /\b(merchandising|personalization|recommendation)\s+(automation|engine|ai)\s+(is\s+)?(implemented|integrated|live|enabled|automated)\b/i, why: 'no merchandising/recommendation automation is implemented' },
  // Admin operations dashboard (Этап 65A): the dashboard IS implemented (read-only overview +
  // owner-gated warnings + links). What must NOT be claimed: that the web admin can EXECUTE
  // shell/CLI commands, or that an external analytics/BI platform is integrated. Negation-guarded.
  { re: /\badmin\s+(panel\s+|ui\s+|dashboard\s+)?(can\s+)?(run|runs|execute|executes|trigger|triggers)\s+(shell|terminal|cli|npm|bash|server)\b/i, why: 'the web admin cannot run shell/CLI commands — command names are shown as text only' },
  { re: /\b(shell|terminal|cli)\s+commands?\s+(can\s+be\s+)?(run|executed|triggered)\s+from\s+(the\s+)?(web\s+)?admin\b/i, why: 'no shell/CLI execution from the web admin' },
  { re: /\b(external\s+)?(analytics|bi|business\s+intelligence)\s+(platform|provider|service|suite|integration)\s+(is\s+)?(integrated|implemented|connected|live|enabled)\b/i, why: 'no external analytics/BI platform is integrated (local counts only)' },
  // Admin customers + support view (Этап 68A): a READ-ONLY admin customer list/detail + support
  // summary + safe aggregates IS implemented, so "admin customer support view / customer summary /
  // safe customer aggregates implemented" is HONEST and must NOT be flagged. What is NOT built —
  // and must not be claimed: a full CRM platform, an external support-desk/helpdesk integration,
  // customer impersonation, public customer admin, and any visibility/management of token VALUES.
  // Affirmative + negation-guarded (honest "no CRM" / "not a support desk" lines pass).
  { re: /\b(full\s+|complete\s+)?crm\s+(platform|system|suite)?\s*(is\s+)?(implemented|integrated|built|live|available|ready)\b/i, why: 'no CRM platform — admin has a read-only customer support view only' },
  { re: /\b(support\s+desk|help\s*desk|helpdesk|ticketing|zendesk|intercom|freshdesk)\s+(integration\s+)?(is\s+)?(integrated|implemented|connected|live|enabled)\b/i, why: 'no external support-desk/helpdesk integration (read-only support summary only)' },
  { re: /\b(customer\s+)?impersonat\w+\s+(is\s+|are\s+)?(implemented|available|supported|enabled|possible|allowed|live|added|built)\b/i, why: 'no customer impersonation — the admin customer area is strictly read-only' },
  { re: /\b(log|sign)\s*in\s+as\s+(a\s+)?customer\s+(is\s+)?(implemented|available|supported|enabled|possible|allowed|works|works\s+now)\b/i, why: 'no "log in as customer" — the admin customer area is strictly read-only' },
  { re: /\b(customer\s+)?(reset|verification|recovery|account)\s+tokens?\s+(values?\s+)?(are\s+)?(visible|shown|displayed|exposed|editable|manageable|revealed)\b/i, why: 'customer token VALUES are never visible/managed — only hashed, reported as counts' },
  { re: /\bpublic\s+customer\s+admin\s+(is\s+)?(ready|available|live|enabled|exposed)\b/i, why: 'the customer admin is local-only by design; never public' },
]

const NEGATION = /❌|\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bmust not\b|\binstead of\b|\bisn'?t\b|\baren'?t\b|\bplaceholder\b|\bdeferred\b|\bnot yet\b|\bnothing\b|\bplanning only\b|\bdemo only\b|\bno real\b/i

// Owner-gated LAUNCH architecture docs (operator/meta — they DISCUSS providers as future).
// They must never bare-claim a provider API/deploy is implemented (false-feature scan, with
// the negation guard so honest "when integrated"/"not implemented" lines are fine), AND they
// must carry the owner-gate language so the gate can't be silently stripped (Stage 56A).
const LAUNCH_DOCS = ['docs/sale/COMMERCIAL_LAUNCH_ARCHITECTURE.md']
const GATE_MARKERS = [/owner[-\s]?gated|owner\s+checklist/i, /do\s+not\s+implement|until\b.*\bgreen|blocked\b/i]

let fails = 0
let warns = 0
let scanned = 0

/** Flags affirmative false-feature claims on a line (skips honest negations). */
function scanFalseFeatures(rel, line, ln) {
  if (NEGATION.test(line)) return
  for (const { re, why } of FALSE_FEATURES) {
    if (re.test(line)) {
      console.log(`  FAIL  ${rel}:${ln} — false claim: ${why}`)
      console.log(`        > ${line.trim().slice(0, 120)}`)
      fails++
    }
  }
}

function checkBuyerDocs() {
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
      scanFalseFeatures(rel, line, ln)
    })
  }
}

function checkLaunchDocs() {
  for (const rel of LAUNCH_DOCS) {
    const abs = join(ROOT, rel)
    if (!existsSync(abs)) continue // optional — only checked when present
    scanned++
    const text = readFileSync(abs, 'utf8')
    text.split(/\r?\n/).forEach((line, i) => scanFalseFeatures(rel, line, i + 1))
    // The owner-gate language must be present (the doc cannot drift into claiming the
    // owner-gated work is implementable now).
    if (!GATE_MARKERS.every((re) => re.test(text))) {
      console.log(`  FAIL  ${rel} — missing owner-gated / "do not implement until green" gate language`)
      fails++
    }
  }
}

function main() {
  console.log('AURELIA sale-docs consistency check\n')
  checkBuyerDocs()
  checkLaunchDocs()
  console.log('')
  if (fails === 0) {
    console.log(`SALE-DOCS OK: ${scanned} doc(s) scanned (buyer + launch); no contradicting claims found (${warns} warning(s)).`)
  } else {
    console.error(`SALE-DOCS FAILED: ${fails} contradicting claim(s), ${warns} warning(s).`)
    process.exit(1)
  }
}

main()
