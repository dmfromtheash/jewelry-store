# Final Freeze Audit & Project Handoff — AURELIA (Stage 57A; refreshed at 59A, 60A, 62A, 63A, 64A, 65A, 68A, 69A, 70A)

> **Freeze point + handoff snapshot** after the 49A–56A sale/demo/security/readiness/
> architecture cycle, **refreshed after Stage 59A** (trust & operations foundation:
> moderated reviews, manual delivery branch/comment fields, and a no-send email outbox
> foundation) **and Stage 60A** (email ops & account recovery foundation: no-send email
> provider facade + outbox processing, and a hashed single-use token foundation for
> password reset + email verification — all additive, design unchanged). The honest
> one-line status: **a strong, verified, sale-ready local demo MVP; real commercial launch
> is blocked by owner/provider/legal decisions.**
>
> **Stage 60A note.** 60A is an additive feature superblock (one migration
> `add_email_account_recovery`; DB backed up first). It makes email/account recovery
> **provider-ready without crossing any owner-gated line**: **no** real email sending, **no**
> provider (SendGrid/Mailgun/SMTP), **no** DNS auth (SPF/DKIM/DMARC), **no** payment/carrier
> API, **no** deploy. Reset/verification tokens are hashed + single-use, and a reset bumps
> `sessionVersion` (revokes old sessions). See §§3–4, §6, §13 below (updated).
>
> Index: [`README.md`](./README.md) · start-here: [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md)
> · readiness: [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md)
> · launch architecture: [`COMMERCIAL_LAUNCH_ARCHITECTURE.md`](./COMMERCIAL_LAUNCH_ARCHITECTURE.md)
> · honest limits: [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).

---

## 1. Project identity & strategy

AURELIA — a **Ukraine-first, sale-ready demo MVP** online store for a small jewelry /
accessories / gifts brand. Currency **₴ (UAH)**; stack **Next.js 15 / React 19 / TypeScript /
Prisma / PostgreSQL**. Honest **manual** payment + delivery model. **Showable and adaptable —
not a live shop taking money.** Sold as a *technical foundation + adaptation package*, not a
launched business. **Design is locked.**

## 2. Current baseline

- Branch `main`; prior freeze baseline **`fb9a2a6` docs: add final freeze audit handoff**. HEAD
  advances through the **Stage 59A** commit *(`feat: add trust and operations foundation`)* to
  the **Stage 60A** commit *(`feat: add email account recovery foundation`)*.
- AURELIA PostgreSQL: **localhost:6700 only**. dm-bot PostgreSQL **localhost:5432 — never touched**.

## 3. What is implemented (now, in code)

- **Storefront** (Ukrainian): home, categories (`bijouterie`/`gifts`), product pages with
  **variants** + gallery, search, favorites, info pages — catalog on PostgreSQL, UAH.
- **Cart + guest checkout**: variant-aware lines; server-authoritative pricing (minor units);
  inline order confirmation (`AUR-XXXXXXXX`).
- **Manual payment** (`cash_on_delivery` / `manual_online`) + **manual delivery**
  (`self_pickup`/`nova_poshta`/`ukrposhta`/`local_courier` + manual branch/comment fields +
  free-text note).
- **Trust & operations foundation** (59A): **moderated reviews** (1–5 rating; pending→approved;
  approved-only public + average/count; guest or logged-in submit; admin moderation at
  `/admin/reviews`, audited); **manual delivery branch/comment** (`deliveryBranch`/
  `deliveryComment`, validated, shown in admin + account) — **no carrier API/TTN**; an **email
  outbox foundation** (`EmailOutbox` + template slots + `/admin/email-outbox`) that **sends
  nothing** (records `skipped`; no provider, no tokens, no body stored).
- **Customer accounts** (47A–47C): registration/login/logout (scrypt), separate httpOnly
  session cookie, profile editing, password change with **stale-session invalidation**
  (`sessionVersion`/`passwordChangedAt`), order history + **own** order detail; guest checkout
  preserved.
- **Auth security** (49A–51A): **customer-auth audit log** (`customer.*` in the admin audit
  page; no PII/secrets) + **durable DB-backed rate limiting** (`CustomerAuthThrottle`, survives
  restart; single-instance).
- **Email ops & account recovery foundation** (60A): a **no-send email provider facade**
  (`NoSendEmailProvider`) + outbox **processing** (`queued → skipped_no_provider/failed_validation`,
  attempts/processedAt); a **hashed single-use token** model (`CustomerAccountToken`) powering
  **password reset** (generic no-enumeration request, IP rate-limited, session-revoking confirm;
  `/account/recover` + `/account/reset`) and **email verification** (`Customer.emailVerifiedAt`,
  account-page status). **Nothing is sent** — no provider; reset/verification links are **not
  delivered**. Admin email-outbox shows attempts + safe token **counts** (no values).
- **Catalog UX / SEO / account wishlist** (62A): **honest approved-only ratings** on the PDP
  (no fake 5-star when there are 0 approved reviews); **product/category SEO metadata** +
  **Product JSON-LD** (UAH offers; `aggregateRating` only when approved reviews exist —
  never faked); **URL-param catalog filters/sorting** (price ↑/↓, newest-by-`createdAt`,
  availability; invalid params fall back safely); and a **server-side account wishlist**
  (`CustomerWishlistItem`, `customerId`-scoped, published-only, idempotent) with a `/account`
  «Обране» section — **guest localStorage favourites preserved unchanged**. No design/CSS change.
- **Promotions / discounts** (63A — manual checkout, NO payment provider): admin promo codes
  (`/admin/promotions`: percent/fixed, min subtotal, max-discount cap, validity window, usage
  limit, activate/deactivate, **soft-archive — no hard delete**, audited) + **server-authoritative**
  discount on checkout (client sends only the code string; subtotal + discount recomputed from
  the catalog; money in integer minor units; **total never negative**; percent rounded + capped;
  fixed ≤ subtotal). `usedCount` increments **transactionally** inside the order commit (usage
  limit race-safe); cancellation does NOT decrement (documented). Discount snapshot shown in
  admin/customer order detail + confirmation. Pre-63A orders unchanged (discount 0).
- **Advanced catalog discovery** (64A — local, no external services): URL-driven **price-range**
  (`minPrice`/`maxPrice`, validated: negative/NaN/huge ignored, min>max swapped), a **material/
  coating facet** derived from real product data (no invented values), **richer local search**
  (name/description/SKU/category/tags/specs/material; normalized, markup-safe), and an **honest
  rating sort** (`rating-desc`/`reviews-desc`) computed from **approved reviews only** (pending/
  rejected excluded; no-review products sort last, never faked), plus active-filter summary +
  reset. No AI/semantic search, no external search engine, no merchandising automation.
- **Admin** (local-only by design — 404s in production): catalog CRUD, publish/hide, gallery +
  variants + stock, inventory/restock, orders inbox + detail, order lifecycle
  (`submitted→processing→completed/cancelled` with restock-on-cancel), site settings + info-page
  CMS, audit log.
- **Admin operations dashboard** (65A): `/admin/dashboard` upgraded into a real-data command
  center — orders/reviews/promos/email-outbox/catalog-health/customer overview cards, a single
  **"Needs attention" queue** (severity action/warn/info + links), and honest **owner-gated
  readiness warnings** (email not configured / no payment provider / no carrier API / not
  deployed / admin local-only / placeholder imagery / no external BI). Safe aggregates only —
  no secrets/tokens/email bodies/PII; command names are documentation text (NO execution from
  the web admin). Admin-local CSS only (3 severity badge classes).
- **Admin customers + support** (68A): `/admin/customers` (list with email/name search + verified/
  has-orders/has-wishlist filters) and `/admin/customers/[id]` (profile, counts, recent orders/
  reviews/wishlist, email-outbox SAFE metadata, account-token COUNTS, and a support-indicator
  summary). **Read-only** — no edit/delete/impersonate; never shows a password hash, token value/
  hash, cookie/session, email body, or recipient. Linked from admin nav + dashboard.
- **Customer account polish + loyalty foundation** (69A): upgraded `/account` overview (profile/
  activity summary, **non-financial** engagement label, wishlist, **saved catalog searches**,
  **back-in-stock product-interest** tracking, order history, own-reviews summary); additive
  `CustomerSavedSearch` + `CustomerProductInterest` models. Saved searches store **validated
  fields only** (no raw URL); interest is **login-gated record-keeping** that sends **nothing**
  (no provider). Engagement label is informational — **no points/cashback/credit**, never affects
  price/total/discount. Admin customer list/detail + dashboard show the safe counts/label.
  Existing storefront classes only — no design/CSS change.
- **Inventory & stock operations** (70A): `/admin/inventory` — stock-health classification across
  products + variants (untracked/out/low ≤5/healthy/negative), a "needs attention" queue, **safe
  manual stock adjustments** (set or signed delta; validated server-side: integer-only, no NaN,
  **no negative final stock**, no delta vs an untracked level, length-capped markup-free note;
  applied race-safely on the exact pre-value; audited), and an append-only **stock-movement
  ledger** (`InventoryStockMovement`, additive migration). Order create / cancel-restock now
  record their stock change as a movement **in the same transaction** (rolls back together).
  Dashboard gained zero/low-stock counts + attention items linking to `/admin/inventory`. **Not** a
  WMS — no supplier/procurement, barcode/scanner, multi-location, or external ERP/WMS. Reuses
  existing admin classes — no storefront design/CSS change.
- **Product content readiness** (71A): `/admin/readiness` — a READ-ONLY per-product content
  checker that scores each card against four honest levels (**local demo → buyer demo → public
  demo → real sale**) with blocker/warning/info issues + a 0–100 score + filters. Pure rules in
  `src/lib/product-readiness/rules.ts` (name/slug/category/price/UAH, description/specs,
  **placeholder photo-gap**, variants/SKU/stock, SEO/meta fallback, legacy-rating honesty). The
  photo truth is explicit: a placeholder is honest for a local/buyer demo but a **gap** for public
  demo / real sale, and a real licensed/owned photo is an **owner-provided** future requirement —
  nothing is generated, downloaded, scraped, or claimed. A small readiness panel is added to the
  product-edit page and a readiness KPI + attention item to `/admin/dashboard`. Never mutates a
  product, never gates checkout, never touches availability. No schema/migration; reuses existing
  admin classes — no storefront design/CSS change.
- **Demo/sale/readiness tooling** (50A/52A/53A/55A): preflight gate, rehearsal, route + admin
  smokes, sale-docs checker, screenshot-capture helper.

## 4. What is verified by automation

All local, safe (GET-only smokes; rolled-back / self-cleaning DB verifies; nothing committed).
Run via `npm run demo:rehearsal` (offline) + the live sequence. At this freeze, **all green:**

| Check | Result |
|---|---|
| `typecheck` · `prisma validate` | pass · schema valid |
| `demo:sale-docs-check` | 9 docs (buyer + launch), 0 contradictions |
| `demo:preflight` · `demo:preflight:full` | pass |
| `db:verify:customer-auth` | 51/51 (hashing, sessions, throttle durable, audit, scoping) |
| `db:verify:orders` · `order-confirmation` · `checkout-options` · `product-variants` · `inventory-lifecycle` | pass |
| `db:verify:reviews` · `delivery-details` · `email-outbox` (59A) | pass (rolled-back; nothing committed) |
| `db:verify:email-ops` (60A) | 33/33 (provider facade, outbox processing, hashed reset + verification tokens, session revocation; nothing committed) |
| `db:verify:catalog-ux` · `db:verify:wishlist` (62A) | pass (rating honesty, JSON-LD, sort/filter; wishlist add/idempotent/remove + isolation + hidden handling, rolled back) |
| `db:verify:promotions` (63A) | pass (discount math round/cap/clamp + no negative total, eligibility, order snapshot, usage-limit concurrency, no-promo compatibility; rolled back) |
| `db:verify:advanced-catalog-ux` (64A) | pass (price parse/filter, material facet, richer search, honest approved-review rating sort, approved-only aggregate excludes pending/rejected/unpublished; rolled back) |
| `db:verify:admin-dashboard` (65A) | pass (promo classification, attention queue, readiness, SAFE email projection, customer counts; rolled back) |
| `db:verify:admin-customers` (68A) | pass (support indicators, list aggregates, SAFE customer/outbox projections, token counts only, support signals; rolled back) |
| `db:verify:customer-loyalty` (69A) | pass (non-financial engagement label, saved-search validation + safe URL, saved-search & product-interest CRUD/isolation, hidden-product rejection, no email/outbox row; rolled back) |
| `db:verify:inventory-operations` (70A) | pass (stock-health + threshold, manual-adjustment validation, race-safe adjust + movement record + product/variant isolation, order-create/cancel movements, tx rollback no orphan, dashboard attention → `/admin/inventory`; self-cleaning) |
| `db:verify:product-readiness` (71A) | pass (readiness rules + level-blocking, placeholder photo-gap honest for demo / gap for sale, untracked-stock allowed, no fake review/rating required, pure detectors, SEO honesty, real-product aggregation **read-only/no mutation**, dashboard attention → `/admin/readiness`; self-cleaning) |
| `smoke:routes` | 26/26 routes render / gated |
| `smoke:admin` | 26/26 (13 admin surfaces incl. dashboard + inventory + readiness + reviews + customers + promotions + email-outbox) render authed + gated unauthed |
| `build` | production build green (needs DB 6700 up) |

## 5. Key commands

```sh
npm run db:start            # AURELIA PostgreSQL on 6700 (never 5432)
npm run dev                 # http://127.0.0.1:5000  (admin exists in dev only)
npm run demo:rehearsal      # offline readiness gate + prints the live sequence
npm run demo:preflight      # static security/posture gate (no DB, no deploy)
npm run smoke:routes        # storefront + admin-gating (server up)
npm run smoke:admin         # authenticated admin surfaces (server up; ADMIN_* in .env.local)
npm run db:verify:customer-auth   # 51/51, nothing committed
npm run build               # needs DB 6700 up (product/[slug] generateStaticParams)
npm run db:stop             # stop AURELIA DB when done
```

## 6. Final readiness assessment (honest ranges)

Ranges, not promises. Bumped from the older 40A buyer/MVP audit where 49A–56A improved things.

| Area | Readiness | Reasoning |
|---|---|---|
| Sale-ready **demo package** | **~92–95%** | docs, screenshots, claims matrix, readiness tooling — coherent + checker-guarded |
| **Technical MVP** | **~80–85%** | full storefront→order→admin + accounts; payment/delivery are manual by design |
| **Ukrainian storefront/catalog** | **~95%** | uk-UA storefront + catalog; admin chrome stays Russian by design |
| **Checkout / manual order flow** | **~90%** | end-to-end, server-authoritative; manual payment/delivery model + manual branch/comment fields |
| **Reviews / social proof (59A)** | **~80%** | moderated reviews end-to-end (submit→moderate→public); no purchase verification / photos |
| **Catalog UX / SEO (62A)** | **~80%** | honest approved-only ratings, product/category meta + Product JSON-LD, URL filters/sorting; no promo/discount engine |
| **Account wishlist (62A)** | **~85%** | DB-backed, customerId-scoped, published-only, guest preserved; no card-level state, no notifications |
| **Promotions / discounts (63A)** | **~75%** | manual-checkout promo codes (%/fixed), server-authoritative, admin-managed, usage-limit-safe; no gift cards / stackable / marketing automation / provider discounts |
| **Catalog discovery / search (64A)** | **~80%** | price + material filters, richer local search, honest approved-review rating sort, shareable URLs; no AI/external search engine / merchandising automation |
| **Admin operations dashboard (65A)** | **~85%** | real-data overview + attention queue + owner-gated warnings; safe aggregates only; no external BI, no command execution from UI |
| **Admin customers + support (68A)** | **~80%** | read-only customer list/detail + support indicators; safe aggregates, no secrets/tokens; not a CRM, no impersonation, no support-desk integration |
| **Customer account polish + loyalty foundation (69A)** | **~80%** | account overview + saved searches + back-in-stock interest foundation + non-financial engagement label; customerId-scoped; **no points/money**, no real interest emails, no marketing automation/CRM |
| **Inventory & stock operations (70A)** | **~80%** | stock health + safe manual adjustments (validated, race-safe, audited) + append-only movement ledger + dashboard integration; single-store stock only — **no** WMS/supplier/barcode/multi-location/ERP |
| **Product content readiness (71A)** | **~80%** | read-only per-product content scoring + levels (local/buyer/public demo, real sale) + placeholder/photo-gap detection + admin dashboard/edit-panel integration; **does not** create real photos/content — real photos are owner-provided, no generation/scraping |
| **Customer auth / account** | **~90%** | login/profile/password/history/audit/durable rate-limit; reset/verification = hashed-token foundation (60A), no email delivery |
| **Admin CMS / site management** | **~85–90%** | catalog/orders/lifecycle/settings/CMS/audit; local-only |
| **Security / readiness tooling** | **~90%** | durable rate-limit, audit, preflight/rehearsal/smokes, sale-docs guard |
| **Visual evidence package** | **~85%** | storefront/cart/checkout/admin + cabinet entry; authed account/audit shots are a manual/deferred polish item |
| **Public demo readiness** | **~60–70%** | local demo + gates ready; public URL needs owner-gated hosting/secrets/access; throttle durable single-instance only |
| **Real payment integration** | **~10–15%** | architecture/SPEC only; no provider code |
| **Delivery / carrier integration** | **~15–20%** | manual branch/comment fields shipped (59A); carrier API/TTN still SPEC only |
| **Email / account operations** | **~30–35%** | outbox + no-send processing + provider facade + hashed reset/verification **token** foundation shipped (59A/60A); **nothing sent** — provider/SPF/DKIM/DMARC still owner-gated |
| **Real launch readiness** | **~25–30%** | gated by owner/legal/provider decisions, not engineering |

## 7. Owner-gated commercial launch blockers

All blocked until the owner resolves them (see
[`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md) +
[`COMMERCIAL_LAUNCH_ARCHITECTURE.md`](./COMMERCIAL_LAUNCH_ARCHITECTURE.md) §E):
payment provider (LiqPay/WayForPay) + merchant/legal entity (ФОП/ТОВ) + UAH account; delivery
carrier (Nova Poshta/Ukrposhta) + API key + shipping/COD policy; transactional email provider +
SPF/DKIM/DMARC; hosting/public-demo + secrets + access control + cost ceiling; fiscalization
(РРО/ПРРО) + offer/privacy/returns; real licensed product imagery; support/recovery process.

## 8. Security / readiness notes

- Passwords scrypt-hashed (never stored/logged plaintext); generic auth errors (no enumeration);
  separate customer session (distinct signing key); `sessionVersion` revocation.
- **Durable** rate limiting (`CustomerAuthThrottle`) — single-instance; multi-instance atomic
  limiting deferred. Customer-auth **audit** log (no PII/secrets).
- Admin **local-only by construction** (`ensureLocalAdmin` 404s in production / off-localhost) +
  session-gated; **no public admin** without a security review.
- Preflight asserts the DB target is **6700, not dm-bot 5432**; never reads/prints `.env`
  (only the `DATABASE_URL` port).

## 9. Visual evidence status

Curated set (storefront/cart/checkout/confirmation/admin) accurate + buyer-acceptable; new
`account-login-prompt.png` (cabinet entry, 55A). **Missing (manual, deferred):** logged-in
`/account`, order history/detail, admin audit-log `customer.*` shots — captured via the safe
checklist in [`SCREENSHOT_INVENTORY.md`](./SCREENSHOT_INVENTORY.md) §4. A visual-evidence
nicety, not a correctness gap (flows are verified by automation).

## 10. Known limitations

Manual payment/delivery (no acquirer/carrier API; manual branch/comment fields only); **no real
email sending** (outbox foundation only — reset/verification/notifications are honest stubs);
reviews are moderated (no verified-purchase proof / photos); no production deploy/hosting;
single-instance rate limiting; placeholder product imagery; admin Russian/local-only; no browser
E2E (HTTP smokes + `db:verify:*` instead); legacy RU-market payment docs superseded by the
Ukraine-first set.

## 11. What must NOT be promised

No real card payments / acquirer / webhooks / "paid" state; no carrier API / waybills / tracking;
**no real email sending** (no order/notification emails; no working password-reset-by-email — the
outbox foundation records but sends nothing); **no verified-purchase reviews** (reviews are
moderated, no proof of purchase); no hosted/deployed/public production shop; no publicly reachable
admin; no finished real product photography; not "guest-checkout-only" (accounts exist); no
legal/fiscal compliance guarantees. (`npm run demo:sale-docs-check` guards buyer + launch docs
against these.)

## 12. Recommended next superblocks (ONLY once owner input exists)

Do **not** start these without the matching owner decisions green (per §7). When unblocked, the
first concrete block — and the first to need a schema migration + security review — is the
**payment SPEC → `Payment`/`WebhookEvent` model → provider sandbox → signed webhook**, then
delivery, then email, then public deploy. Full sequencing: `COMMERCIAL_LAUNCH_ARCHITECTURE.md` §F.

## 13. HANDOFF block (copy-paste for a new ChatGPT/Claude session)

```text
PROJECT: AURELIA — Ukraine-first, sale-ready demo MVP online jewelry/accessories/gifts store.
GOAL: maintain/extend an honest, sale-ready local demo. NOT a live shop taking money.
ASSISTANT: Claude Code (last worked: Opus 4.8 / claude-code 2.1.x).

REPO: C:\Projects\Jewelry Store  · branch main · HEAD = Stage 59A commit (prior baseline fb9a2a6).
STACK: Next.js 15 / React 19 / TypeScript / Prisma / PostgreSQL. Currency ₴ (UAH).
DESIGN IS LOCKED — do not change CSS/layout/spacing/typography/colors/cards/placeholders/gallery.

DB TOPOLOGY:
- AURELIA PostgreSQL = localhost:6700 ONLY (npm run db:start/db:stop/db:status/db:health/db:backup).
- dm-bot PostgreSQL = localhost:5432 — a SEPARATE system; NEVER touch it.
- `npm run build` needs DB 6700 UP (product/[slug] generateStaticParams).

IMPLEMENTED NOW: UAH storefront + variants + gallery; guest cart + server-authoritative checkout;
MANUAL payment (cash_on_delivery/manual_online) + MANUAL delivery (method + manual branch/comment
fields, NO carrier API); inline order confirmation; customer accounts (register/login/profile/
password+session-revocation/order history) with guest preserved; customer-auth AUDIT log + DURABLE
DB rate limiting (single-instance); MODERATED reviews (1–5, pending→approved, approved-only public,
admin moderation) — 59A; EMAIL OUTBOX FOUNDATION (EmailOutbox + templates + /admin/email-outbox)
that SENDS NOTHING (records skipped) — 59A; local-only admin (catalog/orders/lifecycle+restock/
settings+CMS/audit/reviews/email-outbox); demo readiness tooling.

VERIFY (all green; local + safe, nothing committed):
  npm run typecheck && npx prisma validate && npm run demo:sale-docs-check
  npm run demo:preflight && npm run demo:rehearsal
  npm run db:start && npm run db:verify:customer-auth   # 51/51
  npm run db:verify:reviews && npm run db:verify:delivery-details && npm run db:verify:email-outbox  # 59A
  npm run dev   # then: npm run smoke:routes (21/21) and npm run smoke:admin (16/16)
  npm run build && npm run db:stop

MILESTONES (major blocks, not every commit): 47A–47C customer auth/account/session security ·
49A auth audit + abuse protection · 50A route smoke · 51A durable rate limiting · 52A preflight
gate · 53A admin smoke + sale-docs checker + rehearsal · 54A final buyer handoff · 55A visual
evidence · 56A owner-gated commercial launch architecture · 57A freeze/handoff · 59A trust & ops
foundation (moderated reviews + manual delivery branch/comment + email outbox foundation).

OPEN RISKS: multi-instance rate limiting not done; authed account/audit/reviews screenshots manual;
sale-docs checker is heuristic; build depends on DB 6700; email outbox is a foundation (sends nothing).

OWNER-GATED (blocks real launch — NOT engineering): payment provider + ФОП/ТОВ + UAH account;
carrier API key + shipping/COD policy; email provider + SPF/DKIM/DMARC; hosting/secrets/access;
fiscalization (РРО/ПРРО) + legal texts; real licensed imagery.

NEXT EXACT STEP: 59A shipped — re-FREEZE and wait for owner inputs. Do NOT start a new feature
loop without a brief. When unblocked, the first owner-gated block is the payment SPEC →
Payment/WebhookEvent model (additive migration + security review) per
docs/sale/COMMERCIAL_LAUNCH_ARCHITECTURE.md §F. Real email sending (provider + SPF/DKIM/DMARC +
hashed reset-token model) is the natural follow-on to the 59A email foundation — also owner-gated.

HARD PROHIBITIONS: no deploy/tunnel/cloud without explicit permission; no payment/delivery API
without owner decisions + security review; never print/edit .env/.env.local or secrets; no DB
reset/drop/seed; no design/UI/schema changes; never touch dm-bot 5432; do not push unless asked.

SESSION HYGIENE: this is a clean freeze point — prefer a NEW session (or /clear) for the next
task; /compact only if continuing mid-thread. One stage = one commit; push only when asked.
```

---

*Freeze snapshot — verification + planning only. Not a deployment record, not proof of a live
shop. Re-run the rehearsal and refresh this file at the next handoff milestone.*
