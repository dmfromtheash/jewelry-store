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
- **Buyer docs + screenshots + demo runbook + provider research** (this package).

---

## 5. What is not implemented yet

- Real online **payment acquiring** (no LiqPay/WayForPay/etc. integration).
- Payment **webhooks / "paid" state / refunds**.
- **Carrier API / TTN (waybill) / tracking** (delivery is a manual choice + note).
- **Customer account** & order history (guest checkout only).
- **Notifications** (email / SMS).
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
adaptation steps: [`SETUP_AND_HANDOFF_CHECKLIST.md`](./SETUP_AND_HANDOFF_CHECKLIST.md).

---

## 7. Suggested live demo flow

1. Open **home → category** (e.g. Бижутерия / Подарки) — catalog from the DB.
2. Open a **product with variants** (`/product/serogi-kaplya`); switch the coating —
   price/variant update.
3. **Add to cart** → cart drawer shows the **variant-aware** line.
4. **Checkout** with safe demo data; pick **Новая Почта** + a **manual** payment option.
5. Show the **inline order confirmation** (order code, honest manual-payment note).
6. Log into **admin** (local dev): **dashboard**, **order detail** (variant snapshot,
   payment/delivery), and the **catalog/product editor** (gallery/variants/stock).
7. Show the **buyer docs + screenshots** in this folder.
8. State the **limits honestly** (manual payment/delivery; no live deploy yet).

Operational detail: [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md); narrated version:
[`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md).

---

## 8. Current clean snapshot

- **Sale package baseline:** `3a754d8 docs: add sale package index` (this README/index).
- Two local demo orders exist for screenshots (`AUR-C205BFBF`, `AUR-C33C3360`) — safe
  fictional data; the owner may cancel them in admin (cancel returns stock).
- *Update this line only when preparing a new formal handoff snapshot.*
