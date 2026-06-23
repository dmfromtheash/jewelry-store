# AURELIA — Jewelry Store Demo MVP

## What this is

Ukraine-first, **sale-ready demo MVP** online store for a small jewelry /
accessories / gifts brand. Currency **₴ (UAH)**. Stack: Next.js 15 / React 19 /
TypeScript / Prisma / PostgreSQL.

It is an honest **demo / handoff** project: a working Ukrainian storefront +
admin + end-to-end order flow with a **manual** payment/delivery model. It is
**not** a live deployed shop and makes **no** real-payment / real-carrier claims.

## Current readiness

Honest ranges (from the buyer-handoff audit):

| Dimension | Readiness |
|---|---|
| Buyer / demo package | **~90%** |
| Technical MVP | **~80–85%** |
| Ukrainian localization | **~95%** |
| Real launch | **~25–30%** |
| Payment / delivery APIs | **~10–15%** |

Demoable now; **not** launch-ready. The gap to launch is owner / legal /
provider decisions + imagery — not core engineering.

## What is implemented

- Ukrainian storefront & catalog (home, categories, product pages, info pages)
- Product variants (real selector; price/stock aware)
- Client cart (guest, variant-aware lines)
- Checkout with **manual** payment & delivery, server-authoritative pricing
- Inline order confirmation (`AUR-…` code)
- Admin: catalog / orders / variants / stock, order lifecycle, audit log
- Customer accounts: registration / login / logout, profile editing, password change
  with stale-session invalidation, order history + own order detail (guest checkout preserved)
- Catalog UX & SEO (62A): honest approved-only product ratings, product/category metadata +
  Product JSON-LD, URL-param filters/sorting, and a **server-side account wishlist**
  (`customerId`-scoped; guest localStorage favourites preserved)
- Manual-checkout **promo codes / discounts** (63A): admin-managed percent/fixed codes,
  server-authoritative discount (total never negative), usage-limit-safe, audited
- Advanced catalog discovery (64A): URL-driven **price range** + **material/coating filter**,
  richer local search, and an **honest rating sort** (approved reviews only) — shareable URLs
- Admin **operations dashboard** (65A): real-data overview (orders/reviews/promos/email/catalog/
  customers) + a **"needs attention" queue** + owner-gated readiness warnings (local, safe aggregates)
- Admin **customers + support view** (68A): read-only `/admin/customers` list + per-customer support
  summary (orders/reviews/wishlist/email status + indicators); safe aggregates only — no secrets/tokens
- Customer **account polish + loyalty foundation** (69A): upgraded `/account` overview, **saved catalog
  searches**, **back-in-stock product-interest** tracking (records interest, **sends nothing**), and a
  **non-financial** engagement label (no points/money; never affects price/total)
- **Inventory & stock operations** (70A): `/admin/inventory` — stock health (out/low/healthy/negative),
  **safe manual stock adjustments** (validated, race-safe, audited) + an append-only **movement ledger**
  (order/cancel/manual); single-store stock only — **no** WMS/supplier/barcode/multi-location/ERP
- **Product content readiness** (71A): `/admin/readiness` — a read-only per-product content checker
  (levels: local/buyer/public demo → real sale) with placeholder/photo-gap detection. Real product
  photos are owner-provided; **no** photo generation/download/scraping, **no** auto SEO/copy generation
- **SEO & marketing foundation** (72A): dynamic **`/sitemap.xml`** (published+available products only)
  + **`/robots.txt`** (admin/account/cart/checkout/api disallowed), centralized canonical/site-URL
  policy (query-stripped; search `noindex`), Open Graph/Twitter cards (real product photo only — **no**
  fake/placeholder OG image), honest **Organization/WebSite/Breadcrumb/Product** JSON-LD, and an
  **`/admin/seo`** readiness view. **No** pixels/ads/CRM, **no** public deploy — owner-gated
- **First-party analytics insights** (73A): own **no-PII** event stream (strict allowlist + payload
  sanitizer) — storefront view/cart/checkout + engagement events (review/promo/wishlist/saved-search/
  product-interest) reusing existing columns (**no migration**), a DB-backed **`/admin/analytics`**
  (counts/funnel/top-products/engagement/devices/recent) + dashboard summary, and client **Do-Not-Track**
  respect. **No** Google Analytics/Meta Pixel/external BI, **no** unique-visitor/profiling/fingerprinting,
  **no** analytics cookies, **no** IP/UA/token storage — owner-gated production privacy review
- Screenshots and sale/handoff docs

## What is not implemented yet

- Real online **payment acquiring** (no LiqPay / WayForPay / webhooks / "paid" state)
- **Carrier API / TTN / tracking** (delivery is a manual choice + note)
- **Production deploy** (no live hosted shop)
- **Fiscalization (РРО/ПРРО)** / legal launch package
- **Real product photos** (placeholders are intentional for now)
- **Real email delivery** (email / SMS) — no provider (SendGrid/Mailgun/SMTP), no
  sender-domain DNS (SPF/DKIM/DMARC). Email has an outbox + **no-send processing**
  foundation, and password reset + email verification have a **hashed single-use token**
  foundation with session-revoking reset (59A/60A) — but **no email/link is actually
  delivered** until a provider is configured (owner-gated)
- **Further account hardening** — guest-order linking, per-device session management, and
  **multi-instance** rate limiting (deferred). *(Durable single-instance rate limiting and
  customer-auth audit logging are already done — 49A/51A.)*
- **Gift cards, stackable promotions, automatic/marketing campaigns, CRM/email marketing,
  payment-provider discounts** (deferred). *(Manual-checkout promo codes / discounts are already
  done — 63A; they do not stack — one code per order.)*
- **Loyalty points / cashback / store credit / wallet, automatic or personalized discounts,
  real back-in-stock emails/notifications** (deferred). *(Saved searches, a back-in-stock
  product-interest foundation that sends nothing, and a non-financial engagement label are
  already done — 69A; the label carries no money and never changes an order total.)*
- **AI/semantic search, external search engine (Algolia/Elasticsearch/…), merchandising
  automation** (deferred). *(Local DB-backed price/material filters, richer search, and an
  approved-review rating sort are already done — 64A.)*
- **External analytics/BI** and **running commands from the web admin** (not built / not
  allowed). *(An admin operations dashboard with safe local aggregates is already done — 65A;
  readiness commands are text-only documentation.)*
- **Google Analytics / Meta Pixel / external analytics-BI, unique-visitor or user profiling,
  fingerprinting, analytics cookies, ad pixels (Meta/Google/TikTok), retargeting, paid ads, affiliate
  programme, marketing automation/CRM, auto-generated SEO copy, a live public domain / Search Console
  submission** (deferred). *(First-party **no-PII** analytics events + a DB-backed `/admin/analytics`
  with Do-Not-Track respect are already done — 73A; production analytics still needs a privacy/legal
  review. The SEO foundation — sitemap/robots, canonical/meta, OG/Twitter, honest structured data, and
  `/admin/seo` — is already done — 72A; canonical/sitemap use a local/demo URL until the owner deploys.)*

These are deliberate, separately-scoped next steps — not hidden defects.

## Start here

- [`docs/sale/FINAL_BUYER_HANDOFF.md`](docs/sale/FINAL_BUYER_HANDOFF.md) — top-level handoff (start here)
- [`docs/sale/FINAL_FREEZE_AUDIT_AND_HANDOFF.md`](docs/sale/FINAL_FREEZE_AUDIT_AND_HANDOFF.md) — freeze snapshot, readiness %, and a copy-paste session HANDOFF block
- [`docs/sale/README.md`](docs/sale/README.md) — sale package index & reading order
- [`docs/sale/DEMO_RUNBOOK.md`](docs/sale/DEMO_RUNBOOK.md) — how to run the local demo
- [`docs/sale/FEATURES_AND_LIMITS.md`](docs/sale/FEATURES_AND_LIMITS.md) — honest works-vs-deferred list
- [`docs/sale/OWNER_DECISION_CHECKLIST.md`](docs/sale/OWNER_DECISION_CHECKLIST.md) — what the owner must decide before launch
- [`docs/sale/LIVE_DEMO_DEPLOY_READINESS.md`](docs/sale/LIVE_DEMO_DEPLOY_READINESS.md) — deploy-readiness audit (planning only — nothing is deployed)
- [`docs/sale/LOCAL_TUNNEL_DEMO_RUNBOOK.md`](docs/sale/LOCAL_TUNNEL_DEMO_RUNBOOK.md) — safe temporary-tunnel demo runbook (docs-only — no tunnel is created)

## Local demo

- Run the demo via [`docs/sale/DEMO_RUNBOOK.md`](docs/sale/DEMO_RUNBOOK.md) (verify script names against `package.json`).
- **Before any public-demo / tunnel / deploy decision**, run the read-only gate: `npm run demo:preflight` (security posture + tooling check; no deploy, no DB, no secrets), or `npm run demo:rehearsal` for the full local demo/sale rehearsal — see [`scripts/demo/README.md`](scripts/demo/README.md) and [`docs/sale/DEMO_SALE_READINESS_REPORT.md`](docs/sale/DEMO_SALE_READINESS_REPORT.md).
- **Do not** make production claims — this is a local demo with a manual payment/delivery model.
- **Do not** expose a public tunnel without explicit owner approval — see the tunnel runbook.

## Important safety notes

- **No secrets** in the repo or in chat; never open or print `.env` / `.env.local`.
- **Do not** run DB reset / drop / seed casually.
- The **dm-bot PostgreSQL on `:5432`** is unrelated and must **not** be touched.
- AURELIA's local DB is the isolated instance on **port `6700`**.
- The **admin is local / internal by design** — it returns **404 under `NODE_ENV=production`** (`ensureLocalAdmin`), so a hosted demo serves the storefront only.

## Current snapshot

- **Customer-accounts audited baseline:** `e9c7664 feat: harden customer session security`
  (customer accounts 47A–47C).
- **Local `main` also includes since then:** customer-auth audit + abuse protection (49A),
  pre-public demo smoke (50A), durable DB-backed rate limiting (51A), the public-demo
  preflight gate (52A), and the complete demo/sale readiness checks (53A) — honest summary in
  [`docs/sale/DEMO_SALE_READINESS_REPORT.md`](docs/sale/DEMO_SALE_READINESS_REPORT.md).
- **And, additively since 53A (current HEAD `144d6f6`):** trust & ops foundation (59A), email
  ops + account-recovery token foundation (60A), catalog UX/SEO/wishlist (62A), manual promo/
  discount (63A), advanced catalog discovery (64A), admin operations dashboard (65A), cleanup
  hygiene (67A), admin customers/support (68A), account loyalty foundation (69A), inventory
  operations (70A), product content readiness (71A), SEO/marketing foundation (72A), and
  first-party analytics insights (73A) — all re-audited at 74A (docs/checks only, no behaviour
  change). See [`docs/sale/FINAL_FREEZE_AUDIT_AND_HANDOFF.md`](docs/sale/FINAL_FREEZE_AUDIT_AND_HANDOFF.md).
- *This tracks formally-audited milestones, not every commit — refresh it at handoff milestones.*
