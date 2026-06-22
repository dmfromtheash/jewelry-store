# AURELIA Sale / Demo Package

> Buyer/owner/developer handoff index for **AURELIA** — a sale-ready **MVP** online
> store for a small **Ukraine-first** jewelry / accessories / gifts brand. Currency
> **₴ (UAH)**. Stack: Next.js 15 / React 19 / TypeScript / Prisma / PostgreSQL.
>
> This is an honest **demo/handoff** package: it shows a working storefront + admin +
> end-to-end order flow with a **manual** payment/delivery model. It is **not** a
> live deployed shop and makes no real-payment/real-carrier claims.

---

## 1. Purpose

One place to understand what the package contains, what to read first, which
screenshots exist, what works today, what is intentionally deferred, and what the
owner must decide before a real launch.

---

## 2. Recommended reading order

0. [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) — **start here**: the top-level sale/demo handoff (readiness, what to show, what's deferred, what the owner must provide).
1. [`SELLER_OFFER_ONE_PAGER.md`](./SELLER_OFFER_ONE_PAGER.md) — what the buyer gets, in one page.
2. [`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md) — 10–15 min storyline for showing the project.
3. [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md) — honest list of what works vs. what's deferred.
4. [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) — how to actually run the demo (pre-checks, troubleshooting, demo-URL readiness).
5. [`DEMO_SCREENSHOT_CHECKLIST.md`](./DEMO_SCREENSHOT_CHECKLIST.md) — the screenshot set + how it was captured.
6. [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md) — Ukraine provider research (LiqPay/WayForPay/Nova Poshta/Ukrposhta), official-source based.
7. [`SETUP_AND_HANDOFF_CHECKLIST.md`](./SETUP_AND_HANDOFF_CHECKLIST.md) — turning the demo into the buyer's store (brand → catalog → contacts → providers → deploy).
8. [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) — honest live-demo / deploy-readiness audit (local vs temporary tunnel vs hosted vs production; gates and blockers). **Planning only — nothing is deployed.**
9. [`LOCAL_TUNNEL_DEMO_RUNBOOK.md`](./LOCAL_TUNNEL_DEMO_RUNBOOK.md) — safe runbook for a short, supervised buyer demo over a temporary tunnel (storefront only; admin stays local). **Docs-only — no tunnel is created.**
10. [`PRE_PUBLIC_DEMO_READINESS.md`](./PRE_PUBLIC_DEMO_READINESS.md) — pre-public-demo readiness report with **runnable** automated checks (route render smoke + `db:verify:*`): what's verified, what's manual, what blocks public demo vs. real launch. **Verification only — nothing is deployed.**
11. [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md) — the single honest demo/sale readiness answer: what's ready for a buyer, what the automated checks cover, how to run `npm run demo:rehearsal`, how admin is protected, what's owner-gated, and **what must NOT be promised to a buyer**. **Verification only — nothing is deployed.**
12. [`SCREENSHOT_INVENTORY.md`](./SCREENSHOT_INVENTORY.md) — per-file visual-evidence inventory (what each screenshot proves, freshness, buyer-safe, predates-accounts), how capture works (`npm run demo:capture` for unauthenticated; manual checklist for authenticated), and the honest visual-evidence gap.
13. [`COMMERCIAL_LAUNCH_ARCHITECTURE.md`](./COMMERCIAL_LAUNCH_ARCHITECTURE.md) — **owner-gated** commercial-launch architecture: payment, delivery, public-demo/hosting, email/account ops, the owner **decision matrix**, and the **post-decision roadmap**. **Architecture only — nothing is implemented or deployed.**
14. [`FINAL_FREEZE_AUDIT_AND_HANDOFF.md`](./FINAL_FREEZE_AUDIT_AND_HANDOFF.md) — **freeze point + handoff snapshot**: implemented vs verified vs planned, honest readiness percentages, owner-gated blockers, and a copy-paste **HANDOFF block** for a new ChatGPT/Claude session. **Verification + planning only.**

---

## 3. Screenshot assets

- **Production-build set** — [`screenshots/production/`](./screenshots/production/):
  storefront (home, categories, product+variant), cart-with-variant, filled checkout,
  and order confirmation. Captured against a production build (`npm run build` →
  `npm start`), so they have **no Next.js dev "N" indicator**.
- **Local/dev set** — [`screenshots/`](./screenshots/): the static storefront shots
  (`01-…`–`10-…`) plus the **interactive and admin** screenshots (cart, checkout,
  confirmation, admin dashboard/catalog/product-edit/order-detail). These are dev-mode
  (the "N" indicator is visible) and are kept as working/reference assets.
- **Admin screenshots are dev/local only by design.** The admin panel is gated by a
  local-only guard (`ensureLocalAdmin`) that returns **404 under `NODE_ENV=production`**,
  so there is intentionally no production-build admin screenshot — the dev-mode admin
  shots are the reference. Details: [`DEMO_SCREENSHOT_CHECKLIST.md`](./DEMO_SCREENSHOT_CHECKLIST.md) §5.
- All screenshots are **demo assets on local/demo data** — not proof of a live
  production deployment.
- **Screenshot inventory + currency (Stage 55A):** full per-file audit (what each proves,
  freshness, buyer-safe, predates-accounts) is in
  [`SCREENSHOT_INVENTORY.md`](./SCREENSHOT_INVENTORY.md). The set is **accurate for what it
  shows** (storefront, cart, checkout, confirmation, admin dashboard/catalog/order/
  product-edit) and acceptable for the buyer package. **New in 55A:** `account-login-prompt.png`
  — the **customer cabinet entry** (`/account` logged-out), captured via `npm run demo:capture`
  (headless Edge; no design change). The **logged-in account / order-history / order-detail and
  the audit-log `customer.*` shots are captured manually** (safe local checklist in the
  inventory §4) — an optional polish item, since those flows are verified by the automated
  checks (`db:verify:customer-auth`, `smoke:admin`).
- **Product imagery is still placeholder** (gem empty-state, no real photos) — the
  top remaining visual gap; plan to close it in
  [`PRODUCT_IMAGERY_GAP_PLAN.md`](./PRODUCT_IMAGERY_GAP_PLAN.md).

---

## 4. What is implemented now

- **UAH storefront & catalog** on PostgreSQL (home, categories, product pages, info pages).
- **Product variants**, real variant selector, **client cart**, and **guest checkout**.
- **Manual payment** (оплата при получении / онлайн-оплата по реквизитам) and
  **manual delivery** (Самовывоз / Новая Почта / Укрпочта / Курьер + note).
- **Server-authoritative pricing** (client can't set the price; money in minor units).
- **Inline order confirmation** with order code (`AUR-XXXXXXXX`).
- **Admin**: catalog CRUD, publish/hide, **gallery + variants + stock** management,
  **inventory/restock**, orders inbox + detail, **order lifecycle**
  (`submitted → processing → completed / cancelled`) with **stock return on cancel**,
  audit log, `noindex` + local-only guard.
- **Customer accounts** — registration / login / logout, scrypt password hashing, a
  **separate customer session cookie**, profile editing, password change with
  **stale-session invalidation** (`sessionVersion`/`passwordChangedAt`), order history
  and **own order detail**; a logged-in checkout attaches `customerId`, and **guest
  checkout is preserved**.
- **Auth security & audit** — **durable DB-backed login/register/password/profile rate
  limiting** (49A → 51A, survives restart) and a **customer-auth audit log** (49A,
  `customer.*` events in the admin audit page; no PII/secrets stored).
- **Trust & operations foundation (59A)** — **moderated reviews** (1–5 rating; guest or
  logged-in submit; **approved-only** public + average/count; admin moderation at
  `/admin/reviews`, audited), **manual delivery branch/comment** fields (no carrier API/TTN),
  and an **email outbox foundation** (`/admin/email-outbox`) that **records but sends nothing**.
- **Email ops & account recovery foundation (60A)** — a **no-send email provider facade** +
  outbox **processing** lifecycle, and a **hashed single-use token** foundation for **password
  reset** (session-revoking; `/account/recover` + `/account/reset`) and **email verification**
  (`emailVerifiedAt`; account-page status). **Nothing is sent** — no provider; reset/verification
  links are **not delivered** (owner-gated).
- **Catalog UX, SEO & account wishlist (62A)** — **honest approved-only product ratings**
  (no fake stars), **product/category SEO metadata + Product JSON-LD** (UAH offers;
  `aggregateRating` only with approved reviews), **URL-param filters/sorting**, and a
  **server-side account wishlist** (`/account` «Обране»; `customerId`-scoped; **guest
  localStorage favourites preserved**). No promo/discount engine.
- **Promotions / discounts (63A)** — **manual-checkout promo codes** managed in
  `/admin/promotions` (percent or fixed ₴, min subtotal, max-discount cap, validity window,
  usage limit, activate/deactivate, **soft-archive**). The discount is **server-authoritative**
  (client sends only the code; subtotal + discount recomputed from the catalog; total never
  negative; usage limit race-safe). **No** gift cards / stackable promos / marketing automation
  / payment-provider discounts.
- **Advanced catalog discovery (64A)** — URL-driven **price range** (`minPrice`/`maxPrice`,
  validated) + a **material/coating facet** derived from real product data + **richer local
  search** (name/description/SKU/category/specs/material) + an **honest rating sort** (approved
  reviews only; no-review products last, never faked) + active-filter summary/reset. All
  shareable URLs, fully local — **no** AI/semantic search, external search engine, or
  merchandising automation.
- **Admin operations dashboard (65A)** — `/admin/dashboard` upgraded into a real-data command
  center: overview cards (orders / reviews / promos / email-outbox / catalog health / customer
  accounts), a single **"Needs attention" queue** (severity + links), and honest **owner-gated
  readiness warnings** (email not configured / no payment provider / no carrier API / not
  deployed / admin local-only / placeholder imagery / no external BI). Safe aggregates only —
  no secrets/tokens/email bodies/PII; readiness command names are **documentation text**, the
  web admin never executes anything.
- **Demo/sale readiness tooling** — `demo:preflight`, `demo:rehearsal`, `smoke:routes`,
  `smoke:admin`, `demo:sale-docs-check` (all local, read-only, no deploy; see
  [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md)).
- **Buyer docs + screenshots + demo runbook + provider research** (this package).

---

## 5. What is not implemented yet

- Real online **payment acquiring** (no LiqPay/WayForPay/etc. integration).
- Payment **webhooks / "paid" state / refunds**.
- **Carrier API / TTN (waybill) / tracking** (delivery is a manual choice + manual
  branch/comment fields only — the customer types them; no live lookup).
- **Customer-account extra hardening** — guest-order linking, per-device session management,
  and **multi-instance** rate limiting (core accounts/login/profile/history **are** done;
  **durable single-instance rate limiting (51A)**, **customer-auth audit logging (49A)**, and a
  **hashed-token password-reset + email-verification foundation (60A)** are also done — these
  listed items are the remaining deferred ones).
- **Real email sending / notifications** (email / SMS) and **delivered** reset/verification
  links. An email outbox + no-send processing **foundation** and a reset/verification **token
  foundation** exist (59A/60A) but **nothing is sent** — no provider; no link is delivered.
- **Verified-purchase reviews / photos in reviews** (reviews are **moderated**, no proof of
  purchase) — the moderated review mechanism itself **is** done (59A).
- **Gift cards, stackable promotions, automatic/marketing campaigns, CRM/email marketing,
  payment-provider discounts** — manual-checkout promo codes **are** done (63A; one code per
  order, they do not stack), but these advanced promo features are not built.
- **AI/semantic search, external search engine (Algolia/Elasticsearch/…), merchandising
  automation** — local price/material filters, richer search and an approved-review rating sort
  **are** done (64A), but these advanced discovery features are not built.
- **External analytics/BI integration** and **command execution from the web admin** — an admin
  operations dashboard with safe local aggregates **is** done (65A), but no external BI is wired
  and the admin UI never runs shell/CLI commands (command names are documentation only).
- **Production deploy** (no live hosted shop).
- **Fiscalization (РРО/ПРРО)** / legal-compliance guarantees.
- Full **uk-UA / EN localization** and secondary currencies (storefront copy is
  currently Russian; UAH already used) — see [`UK_UA_LOCALIZATION_READINESS.md`](./UK_UA_LOCALIZATION_READINESS.md).

These are deliberate, separately-scoped next steps — not hidden defects. See
[`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).

---

## 6. Buyer/owner decisions before launch

- [ ] Brand: name, logo, texts, real product **content & images**.
- [ ] **Payment provider** choice (LiqPay or WayForPay — see provider research).
- [ ] **Carrier** choice (Nova Poshta first; Ukrposhta second).
- [ ] **ФОП / ТОВ / legal entity** + merchant account.
- [ ] **Bank / UAH settlement account**.
- [ ] **Domain / hosting / deploy** plan.
- [ ] **Fiscalization / accounting / legal** (РРО/ПРРО, receipts, taxes).
- [ ] **Delivery & refund / return policy** (and who pays shipping / COD fee).

Full provider context: [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md);
practical decision checklist: [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md);
adaptation steps: [`SETUP_AND_HANDOFF_CHECKLIST.md`](./SETUP_AND_HANDOFF_CHECKLIST.md);
how it all fits together + the post-decision roadmap: [`COMMERCIAL_LAUNCH_ARCHITECTURE.md`](./COMMERCIAL_LAUNCH_ARCHITECTURE.md).

---

## 7. Suggested live demo flow

0. **Pre-demo (safe, local):** `npm run db:start`, then `npm run demo:rehearsal` (offline
   readiness gate) and `npm run dev` → `http://127.0.0.1:5000`. **No tunnel, no public URL.**
1. Open **home → category** (e.g. Бижутерия / Подарки) — catalog from the DB.
2. Open a **product with variants** (`/product/serogi-kaplya`); switch the coating —
   price/variant update.
3. **Add to cart** → cart drawer shows the **variant-aware** line.
4. **Checkout** with safe demo data; pick **Новая Почта** + a **manual** payment option.
5. Show the **inline order confirmation** (order code, honest manual-payment note).
6. **Customer account** (`/account`): register/login, profile, and **own order history /
   order detail** — guest checkout still works too.
7. Log into **admin** (local dev): **dashboard**, **order detail** (variant snapshot,
   payment/delivery), the **catalog/product editor** (gallery/variants/stock), and the
   **audit log** (admin + `customer.*` events).
8. Show the **readiness checks** (`npm run smoke:routes` / `smoke:admin`) and the
   **buyer docs + screenshots** in this folder.
9. State the **limits honestly** (manual payment/delivery; no live deploy; admin local-only).
10. **After the demo:** stop the server (Ctrl+C) and `npm run db:stop`.

Operational detail: [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md); narrated version:
[`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md); full readiness picture +
**sale claims matrix**: [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md).

---

## 8. Current clean snapshot

- **Customer-accounts audited baseline:** `e9c7664 feat: harden customer session security`
  (customer accounts 47A–47C).
- **Since then, local `main` also includes:** customer-auth audit + abuse protection (49A),
  pre-public demo smoke (50A), durable DB-backed rate limiting (51A), the public-demo
  preflight gate (52A), and the complete demo/sale readiness checks (53A). The honest
  readiness summary lives in [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md).
- Local demo orders exist for screenshots — safe fictional data; the owner may cancel
  them in admin (cancel returns stock).
- *This tracks formally-audited milestones, not every commit — refresh it at handoff milestones.*
