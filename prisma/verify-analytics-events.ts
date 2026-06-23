/**
 * AURELIA — Analytics events + insights verification (Этап 73A)
 *
 * Non-destructive check for the first-party analytics layer:
 *   - the taxonomy allowlist accepts the known events (incl. the new 73A
 *     engagement events) and rejects unknown ones;
 *   - the sanitizer strips PII-looking payload keys (email/phone/token/address/…)
 *     and drops nested objects — verified WITHOUT touching the DB;
 *   - the AnalyticsEvent model carries NO identity column (no ip / userAgent /
 *     cookie / password / email / phone / secret / raw token) — asserted from the
 *     Prisma datamodel;
 *   - the PURE insights helpers aggregate correctly (event counts, funnel +
 *     conversion, top-N by name, and a recent projection that omits session/user
 *     ids) — pure, no DB;
 *   - the write path stores the new events and reads them back via groupBy INSIDE
 *     a transaction that is ALWAYS rolled back (a sentinel error aborts it), so NO
 *     event is ever committed and there is no test pollution.
 *
 * Run with: npm run db:verify:analytics-events
 */

import { Prisma, PrismaClient } from '@prisma/client'
import { ANALYTICS_EVENTS, normalizeEventName, sanitizePayload } from '../src/lib/analytics/events'
import {
  buildFunnel,
  projectRecentEvent,
  rankEventCounts,
  rankNamed,
  toEventCountMap,
  totalEvents,
} from '../src/lib/analytics/insights'

const prisma = new PrismaClient()
const ROLLBACK_SENTINEL = '__AURELIA_ANALYTICS_EVENTS_ROLLBACK__'

const problems: string[] = []
const pass = (cond: boolean, msg: string) => {
  if (!cond) problems.push(msg)
}

/** 1) Allowlist accepts known events (old + new) and rejects unknown names. */
function checkAllowlist() {
  const known = [
    ANALYTICS_EVENTS.productView,
    ANALYTICS_EVENTS.categoryView,
    ANALYTICS_EVENTS.searchPerformed,
    ANALYTICS_EVENTS.addToCart,
    ANALYTICS_EVENTS.beginCheckout,
    ANALYTICS_EVENTS.draftOrderCreated,
    ANALYTICS_EVENTS.reviewSubmitted,
    ANALYTICS_EVENTS.promoApplied,
    ANALYTICS_EVENTS.wishlistAdded,
    ANALYTICS_EVENTS.wishlistRemoved,
    ANALYTICS_EVENTS.savedSearchCreated,
    ANALYTICS_EVENTS.productInterestAdded,
  ]
  for (const e of known) {
    pass(normalizeEventName(e) === e, `allowlist rejected known event "${e}"`)
  }
  pass(normalizeEventName('  PRODUCT_VIEW ') === ANALYTICS_EVENTS.productView, 'normalize trim/lowercase failed')
  for (const bad of ['totally_made_up', 'drop table', 'review_submited', '', '   ']) {
    pass(normalizeEventName(bad) === null, `allowlist accepted unknown event "${bad}"`)
  }
}

/** 2) Sanitizer strips PII-looking keys and nested objects; keeps safe primitives. */
function checkSanitizer() {
  const sanitized = sanitizePayload({
    itemCount: 2,
    result: 'applied',
    productSlug: 'ring-01',
    rating: 5,
    email: 'a@b.com',
    phone: '+380000000000',
    sessionToken: 'abc',
    apiKey: 'k',
    customerName: 'John Doe',
    homeAddress: 'Main st 1',
    postalCode: '01001',
    cardNumber: '4111',
    clientIp: '127.0.0.1',
  })
  const kept = Object.keys(sanitized ?? {}).sort()
  const expected = ['itemCount', 'productSlug', 'rating', 'result']
  pass(JSON.stringify(kept) === JSON.stringify(expected), `sanitizer kept unexpected keys: ${JSON.stringify(kept)}`)

  const nested = sanitizePayload({ ok: 1, nested: { phone: 'x' }, arr: [1, 2] })
  pass(!!nested && !('nested' in nested) && !('arr' in nested), 'sanitizer kept a nested object/array')
}

/** 3) The model has no identity / PII column. */
function checkModelHasNoPiiColumns() {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === 'AnalyticsEvent')
  pass(!!model, 'AnalyticsEvent model not found in datamodel')
  if (!model) return
  const fields = model.fields.map((f) => f.name)
  // anonymousSessionId is an OPAQUE non-identifying id (allowed); these patterns
  // target the genuinely forbidden columns.
  const forbidden = /(useragent|user_agent|cookie|password|secret|\bemail\b|phone|ipaddr|ip_address|\bip\b|fingerprint|rawtoken)/i
  const offenders = fields.filter((f) => forbidden.test(f))
  pass(offenders.length === 0, `AnalyticsEvent has forbidden column(s): ${offenders.join(', ')}`)
}

/** 4) Pure insights aggregation: counts, funnel, top-N, safe recent projection. */
function checkInsights() {
  const map = toEventCountMap([
    { eventName: ANALYTICS_EVENTS.productView, count: 100 },
    { eventName: ANALYTICS_EVENTS.addToCart, count: 40 },
    { eventName: ANALYTICS_EVENTS.beginCheckout, count: 20 },
    { eventName: ANALYTICS_EVENTS.draftOrderCreated, count: 10 },
    { eventName: ANALYTICS_EVENTS.reviewSubmitted, count: 5 },
  ])
  pass(totalEvents(map) === 175, 'totalEvents miscount')

  const ranked = rankEventCounts(map)
  pass(ranked[0].name === ANALYTICS_EVENTS.productView && ranked[0].count === 100, 'rankEventCounts ordering wrong')

  const funnel = buildFunnel(map)
  pass(funnel.length === 4, 'funnel should have 4 steps')
  pass(funnel[0].rate === 100, 'funnel top rate should be 100')
  pass(funnel[1].count === 40 && funnel[1].rate === 40, 'funnel add_to_cart rate wrong')
  pass(funnel[3].count === 10 && funnel[3].rate === 10, 'funnel order rate wrong')

  // Division-by-zero safety: empty map → all rates 0, no NaN.
  const emptyFunnel = buildFunnel({})
  pass(emptyFunnel.every((s) => s.rate === 0 && s.count === 0), 'empty funnel must be all-zero (no NaN)')

  const top = rankNamed(
    [
      { id: 'ring-01', count: 3 },
      { id: 'neck-02', count: 7 },
      { id: 'gone-09', count: 1 },
    ],
    { 'ring-01': 'Кольцо', 'neck-02': 'Колье' },
    2,
  )
  pass(top.length === 2 && top[0].id === 'neck-02' && top[0].name === 'Колье', 'rankNamed ordering/resolve wrong')
  // Unknown id falls back to the id (never invented) — and is excluded by the limit here.
  const top3 = rankNamed([{ id: 'gone-09', count: 1 }], {}, 5)
  pass(top3[0].name === 'gone-09', 'rankNamed should fall back to id for unknown name')

  // Recent projection must NEVER carry identity fields even if present on the row.
  const view = projectRecentEvent({
    id: 'evt1',
    eventName: ANALYTICS_EVENTS.wishlistAdded,
    createdAt: new Date(),
    pagePath: '/product/ring-01',
    deviceType: 'mobile',
    // Intentionally smuggling forbidden keys to prove they are dropped from the projection.
    payload: { productSlug: 'ring-01', anonymousSessionId: 'deadbeef', userId: 'u1', ip: '1.2.3.4' },
  })
  const detail = view.detail ?? ''
  pass(
    !/anonymousSessionId|userId|\bip\b|1\.2\.3\.4|deadbeef|u1/.test(detail),
    `recent projection leaked an identity field: "${detail}"`,
  )
  pass(detail.includes('productSlug'), 'recent projection dropped the safe productSlug')
  pass(!('anonymousSessionId' in (view as object)) && !('userId' in (view as object)), 'recent view exposed an identity field')
}

/** 5) Write path stores the new events + reads them back — ALWAYS rolled back. */
async function checkWritePathRolledBack(): Promise<{ writeOk: boolean; committedNothing: boolean }> {
  const before = await prisma.analyticsEvent.count()
  let writeOk = false

  const seed = [
    { eventName: ANALYTICS_EVENTS.productView, payload: { productSlug: 'ring-01' } },
    { eventName: ANALYTICS_EVENTS.productView, payload: { productSlug: 'ring-01' } },
    { eventName: ANALYTICS_EVENTS.addToCart, payload: { productSlug: 'ring-01', quantity: 1 } },
    { eventName: ANALYTICS_EVENTS.reviewSubmitted, productId: 'p-smoke', payload: { rating: 5 } },
    { eventName: ANALYTICS_EVENTS.promoApplied, payload: { result: 'applied', code: 'SMOKE10' } },
    { eventName: ANALYTICS_EVENTS.wishlistAdded, payload: { productSlug: 'ring-01' } },
  ]

  try {
    await prisma.$transaction(async (tx) => {
      for (const s of seed) {
        await tx.analyticsEvent.create({
          data: {
            eventName: s.eventName,
            anonymousSessionId: 'smoke00000000000000000000000000',
            productId: 'productId' in s ? (s as { productId?: string }).productId ?? null : null,
            payload: sanitizePayload(s.payload),
          },
        })
      }
      const groups = await tx.analyticsEvent.groupBy({
        by: ['eventName'],
        where: { anonymousSessionId: 'smoke00000000000000000000000000' },
        _count: { _all: true },
      })
      const map = toEventCountMap(groups.map((g) => ({ eventName: g.eventName, count: g._count._all })))
      const funnel = buildFunnel(map)
      writeOk =
        map[ANALYTICS_EVENTS.productView] === 2 &&
        map[ANALYTICS_EVENTS.reviewSubmitted] === 1 &&
        funnel[0].count === 2 &&
        funnel[1].count === 1
      throw new Error(ROLLBACK_SENTINEL)
    })
  } catch (e) {
    if (!(e instanceof Error && e.message === ROLLBACK_SENTINEL)) throw e
  }

  const after = await prisma.analyticsEvent.count()
  return { writeOk, committedNothing: after === before }
}

async function main() {
  checkAllowlist()
  checkSanitizer()
  checkModelHasNoPiiColumns()
  checkInsights()
  const { writeOk, committedNothing } = await checkWritePathRolledBack()
  pass(writeOk, 'write path / in-tx aggregation failed')
  pass(committedNothing, 'test data was committed (expected rollback)')

  console.log('Analytics events + insights verify:')
  console.log(`  taxonomy allowlist:        ${problems.some((p) => p.startsWith('allowlist') || p.startsWith('normalize')) ? 'FAIL' : 'OK'}`)
  console.log(`  payload sanitizer (no PII): ${problems.some((p) => p.startsWith('sanitizer')) ? 'FAIL' : 'OK'}`)
  console.log(`  model has no PII column:    ${problems.some((p) => p.startsWith('AnalyticsEvent')) ? 'FAIL' : 'OK'}`)
  console.log(`  pure insights aggregation:  ${problems.some((p) => /funnel|rank|recent|totalEvents/.test(p)) ? 'FAIL' : 'OK'}`)
  console.log(`  write path (rolled back):   ${writeOk ? 'OK' : 'FAIL'}`)
  console.log(`  no test data committed:     ${committedNothing ? 'OK' : 'FAIL'}`)

  if (problems.length === 0) {
    console.log('\nANALYTICS EVENTS VERIFY OK: allowlist + no-PII sanitizer + insights aggregation + write path (rolled back).')
  } else {
    console.error('\nANALYTICS EVENTS VERIFY FAILED:')
    for (const p of problems) console.error(`  - ${p}`)
    process.exitCode = 1
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
