# AURELIA — Commercial Readiness Roadmap (Этап 25A)

> **Status: strategy document only.** No runtime code, Prisma schema, migrations,
> or configuration are introduced or changed by this file. It connects the
> **current, verified state** of AURELIA to a concrete, safe path toward a real
> *selling* online store.
>
> **Scope note / numbering:** this is a separate **Commercial Readiness track**
> (25A → 25J below). It is intentionally distinct from the admin/analytics
> **Superpanel track** in [`backend/ADMIN_SUPERPANEL_ROADMAP.md`](./backend/ADMIN_SUPERPANEL_ROADMAP.md),
> which also numbers stages from 24A/25A onward for a *different* (analytics)
> purpose. To avoid collision, commercial stages here are always written with the
> `25x — Commercial:` prefix. The two tracks are complementary and can progress in
> parallel.

---

## 0. How to read this document

Every claim about "what exists" was verified against the repository at commit
`d370b15` (Dashboard KPI v1), not assumed from product analysis. Where a feature
looks present in the UI but is not wired to a backend, it is labelled
**foundation/stub**, not "done".

Three honest buckets are used throughout:

- ✅ **Implemented** — real, working code path backed by PostgreSQL where relevant.
- 🟡 **Foundation / stub** — UI or scaffold exists, but the commercial capability
  behind it is not connected (no payment, no real account, etc.).
- 🔴 **Gap** — not present; required for a real selling store.

---

## 1. Current reality

### 1.1 Implemented (verified in code) ✅

- **Catalog in PostgreSQL** — `Category`, `Product`, `ProductVariant`,
  `ProductImage` models; storefront reads from the DB (`src/lib/catalog/server.ts`).
- **Storefront pages** — home, two categories (`bijouterie`, `gifts`),
  `product/[slug]` (statically generated from DB via `generateStaticParams`,
  `dynamicParams = false`), plus info pages (delivery, returns, stores, help,
  about, contacts).
- **Cart & favorites (client)** — `CartProvider` / `FavoritesProvider` on
  `localStorage`; cart drawer; recently-viewed.
- **Guest checkout → order** — `createOrderDraft` server action recomputes every
  price/name/status from the DB (client sends only slug + qty); persists
  `Order` + `OrderItem` snapshots. See [`backend/ORDER_DRAFT_FLOW.md`](./backend/ORDER_DRAFT_FLOW.md).
- **Admin back-office (local/dev)** — auth (HMAC session cookie + `ensureLocalAdmin`
  local-only gate + `requireAdminSession`), orders list/detail/status change,
  catalog CRUD, audit log, Dashboard KPI v1, `noindex` on all admin routes.
- **Analytics foundation** — `AnalyticsEvent` model, server-only validated
  `recordEvent()`, same-origin client gateway `POST /api/analytics`, allowlist +
  PII sanitizer, anonymous session cookie. Funnel events captured.
- **Audit foundation** — append-only `AdminAuditLog`; login/logout/order-status
  events recorded; safe read-back in the admin UI.

### 1.2 Foundation / stub (looks present, not commercially wired) 🟡

- **Customer auth modals** — `LoginModal` / `RegisterModal` exist but
  `onSubmit` calls `preventDefault()`; **no backend, no session, no account**.
- **Payment** — `Order.paymentMethod` stored as the literal string
  `'not_connected'`; no acquiring, no charge, no payment state machine.
- **Delivery** — `Order.deliveryMethod` stored as a placeholder label
  (`pickup` / `courier` / `post`, all "— скоро"); no carrier, no cost, no tracking.
- **Reviews/ratings** — `Product.rating` / `reviewsCount` columns exist but the
  product page renders a `ReviewsEmpty` placeholder; no review submission/storage.
- **Catalog filters / sort / pagination** — UI controls exist
  (`CategoryFilters`, `CategoryToolbar`, `Pagination`) but discovery is largely
  client-side over the loaded set; no server-side faceting.
- **Admin analytics page** — navigation placeholder only (`AdminPlaceholder`).

### 1.3 Commercial gaps (absent) 🔴

Payments/acquiring · real delivery/logistics · email/SMS notifications · real
customer account & order history · reviews & ratings · server-side
filters/facets/pagination · recommendations & promo engine · jewelry-specific
features (ring-size guide, 360°/video, engraving). Detailed in §5.

### 1.4 Roadmap goals (direction)

Turn the strong **витрина + back-office foundation** into a store that can
actually **take money, fulfill, and retain** — without breaking the
privacy/security posture already established (server-authoritative pricing, no
PII in analytics, audited admin, `noindex` admin).

---

## 2. Storefront readiness

| Area | State | Notes |
|---|---|---|
| Home | ✅ | DB-backed product blocks; design close to mature e-commerce reference. |
| Categories | ✅ (2) | `bijouterie`, `gifts`; adding categories is data, not code. |
| Product pages | ✅ | SSG per slug; gallery, tabs, variants displayed. |
| Catalog from PostgreSQL | ✅ | Single read seam `src/lib/catalog/*`. |
| Search / discovery | 🟡 | Search + filters/sort exist but client-side; no server faceting, no search analytics wired to UI. |
| Cart / checkout UI | 🟡 | Cart is `localStorage`; checkout UI is complete and submits to a real server action, but completes as an **unpaid** order. |

**Storefront verdict:** visually and structurally close to a mature store; the
gaps are *transactional and discovery-at-scale*, not presentation.

---

## 3. Transaction readiness

| Capability | State | Detail |
|---|---|---|
| Order lifecycle | 🟡 | Enum `OrderStatus { draft, submitted, cancelled }`. Checkout creates **`submitted`** (default); `draft` is currently **unused**; admin can move between statuses. No `paid` / `fulfilled` / `refunded` states. |
| Draft vs submitted | 🟡 | The naming "draft checkout flow" refers to *unpaid* orders; the literal `draft` enum value is not produced by any flow yet. This must be reconciled in 25B. |
| Server-side pricing | ✅ | Authoritative: prices/names/availability recomputed from DB in `createOrderDraft`; client price tampering is impossible. Money in integer **minor units (kopecks)**. |
| Payment readiness | 🔴 | `paymentMethod: 'not_connected'`; no provider, no webhook, no `Payment` model. |
| Delivery readiness | 🔴 | Method is a label; no carrier integration, cost calc, address model, or tracking. |
| Notifications readiness | 🔴 | No email/SMS at all (no order confirmation, no password reset). |
| Customer account readiness | 🔴 | Modals are UI-only; no `User`/session/order history/addresses. |

**Transaction verdict:** the **spine is correct** (server-authoritative,
snapshot line items, status machine, audited changes). What's missing is the
*commercial flesh*: pay → confirm → notify → fulfill → account history.

---

## 4. Admin / back-office readiness

| Module | State | Notes |
|---|---|---|
| Admin auth | ✅ (V1) | Env credential, HMAC httpOnly session, **local-only** `ensureLocalAdmin`, `requireAdminSession`, throttle/audit on login. No multi-user/roles yet. |
| Orders | ✅ | List (filter/search, take 200), detail with PII behind the guard, status change via server action (audited). No bulk ops, no fulfillment workflow. |
| Audit log | ✅ | Append-only, safe read-back, no raw metadata dump. |
| Analytics foundation | ✅ (capture) / 🟡 (UI) | Events captured + gateway live; admin analytics screen is a placeholder. |
| Dashboard KPI v1 | ✅ | Real counts/aggregates (orders, catalog, activity) + recent feeds + status breakdown. |
| Operational gaps | 🔴 | No payment/refund view, no shipment/fulfillment, no customer view, no inventory alerts, no exports, no multi-admin/roles. |

**Admin verdict:** unusually solid foundation for the project's age (auth + audit
+ catalog CRUD + KPI). To *run* a real store it still needs payment/fulfillment
operations and customer support views.

---

## 5. Critical commercial gaps (detail)

1. **Payments / acquiring** 🔴 — The single biggest blocker. Needs a `Payment`
   record, a provider (hosted/tokenized — e.g. YooKassa/Stripe-class), signed
   server-to-server webhooks to mark orders paid, and an idempotent order→payment
   link. **Never** store raw card data; **never** trust a client "paid" callback.
2. **Delivery / logistics** 🔴 — Address model, delivery method + cost
   calculation, carrier integration (e.g. pickup points / courier), and tracking.
   The competitor advantage of stores like Makeup is largely *delivery quality*.
3. **Email / SMS notifications** 🔴 — Transactional messages: order confirmation,
   status changes, (later) password reset. Requires a provider + templating +
   a send log; must avoid leaking secrets/PII in logs.
4. **Real customer account** 🔴 — `User` + sessions, order history, saved
   addresses; wire the existing modals; define guest-cart → account merge.
5. **Reviews / ratings** 🔴 — Submission, moderation, storage, aggregate rating
   on PDP. `rating`/`reviewsCount` columns already reserve space.
6. **Server-side filters / facets / pagination** 🔴 — Move discovery into the DB
   (indexed queries, facet counts, cursor/seek pagination) before the catalog grows.
7. **Recommendations / promo engine** 🔴 — "Similar / bought-together",
   coupons/discount rules with server-side validation, campaign banners tied to data.
8. **Jewelry-specific features** 🔴 — Ring-size guide/selector, 360°/video media,
   engraving/personalization, richer material/care specs. Differentiators vs a
   generic beauty store.

---

## 6. Recommended roadmap (small, safe blocks)

> Each stage is **one coherent task, one commit**, built on the existing seams,
> with checks (typecheck/build/db verify/Prisma validate where relevant). SPEC
> stages are **docs-only**; implementation stages change code in a narrow scope.
> A SPEC always precedes the implementation of a risky commercial capability.

### 25B — Commercial: Order Lifecycle SPEC (docs-only)
- **Goal:** define the authoritative order state machine before money touches it.
- **Scope:** reconcile `draft` vs `submitted`; introduce planned states
  (`pending_payment` → `paid` → `fulfilled`/`shipped` → `completed`;
  `cancelled`/`refunded`); allowed transitions; who/what can transition; audit
  points; idempotency keys; what each state means for stock and notifications.
- **Must NOT mix:** no payment provider details, no delivery carrier details, no
  schema changes (this is the spec that *justifies* later schema changes).
- **Security/privacy:** transitions audited; no PII added to audit; no client-driven
  state changes.
- **Done when:** a reviewed state diagram + transition table + idempotency rules
  exist and every later commercial stage can reference them.

### 25C — Commercial: Payments SPEC (docs-only)
- **Goal:** specify acquiring without implementing it.
- **Scope:** provider selection criteria; `Payment` model shape; order↔payment
  linkage; hosted/tokenized flow; **signed webhook** verification; idempotency;
  failure/retry; refund path; test vs live keys via secrets (never committed).
- **Must NOT mix:** no delivery, no notifications implementation, no real keys.
- **Security/privacy:** PCI scope minimization (no raw card data, ever); verify
  webhooks server-side; never trust client success; secrets only via env/secret
  manager; no payment data in analytics/audit.
- **Done when:** a provider-agnostic integration spec + data model proposal +
  threat notes are reviewed. Depends on **25B**.

### 25D — Commercial: Delivery SPEC (docs-only)
- **Goal:** specify delivery methods, cost, address, and tracking.
- **Scope:** `Address` model; delivery method catalog; cost calculation rules;
  carrier/pickup-point integration options; tracking fields; how delivery affects
  order totals and lifecycle.
- **Must NOT mix:** no payment, no notifications implementation.
- **Security/privacy:** addresses are PII — access only behind the admin guard and
  the (future) customer account; never in analytics.
- **Done when:** reviewed delivery spec incl. totals impact. Depends on **25B**.

### 25E — Commercial: Notifications SPEC (docs-only)
- **Goal:** specify transactional email/SMS.
- **Scope:** event triggers (order confirmation, status change, later
  password reset); provider options; templating; localization (ru-RU); a send log;
  opt-out/consent stance; rate limits.
- **Must NOT mix:** no marketing automation, no customer-account implementation.
- **Security/privacy:** no secrets/PII in logs; minimal data in payloads; honor
  consent; bounce/error handling.
- **Done when:** reviewed notification matrix + provider plan. Depends on **25B**
  (and references **25C**/**25D** triggers).

### 25F — Commercial: Customer Account SPEC (docs-only)
- **Goal:** specify real customer identity.
- **Scope:** `User` + session model; password hashing; the modal wiring;
  order history; saved addresses; **guest-cart/favorites → account merge** rules;
  account deletion/data-export stance.
- **Must NOT mix:** no payment, no social login (optional later).
- **Security/privacy:** hashed passwords only; httpOnly sessions; rate limiting;
  PII minimization; clear separation from the admin auth system.
- **Done when:** reviewed account spec incl. merge + privacy rules.

### 25G — Commercial: Reviews / Ratings SPEC (docs-only)
- **Goal:** specify UGC reviews safely.
- **Scope:** `Review` model; submission flow (verified-buyer option); moderation;
  aggregate rating recompute; abuse/spam handling; display on PDP.
- **Must NOT mix:** no recommendations engine.
- **Security/privacy:** sanitize user content; no scripts; store minimal author
  data; moderation before publish.
- **Done when:** reviewed reviews spec. Benefits from **25F** (verified buyer).

### 25H — Commercial: Server Filters / Facets / Pagination SPEC (docs-only)
- **Goal:** specify scalable discovery.
- **Scope:** indexed filter fields; facet counts; sort options; cursor/seek
  pagination; query contract that keeps the `src/lib/catalog` seam; URL/state design.
- **Must NOT mix:** no recommendations, no promo.
- **Security/privacy:** value-level query sanitization (so search analytics never
  stores PII-like queries — already flagged in the analytics taxonomy).
- **Done when:** reviewed discovery spec + index plan.

### 25I — Commercial: Promo / Recommendations SPEC (docs-only)
- **Goal:** specify coupons/discounts and recommendations.
- **Scope:** discount rule model; server-side validation/redemption; stacking
  rules; "similar"/"bought-together" data sources; campaign banners tied to data.
- **Must NOT mix:** no loyalty engine (postponed per superpanel roadmap §9).
- **Security/privacy:** server-side redemption only; no client-trusted discounts;
  guard against coupon abuse.
- **Done when:** reviewed promo + recommendations spec. Depends on **25B** (totals).

### 25J — Commercial: Jewelry Features SPEC (docs-only)
- **Goal:** specify category-specific differentiators.
- **Scope:** ring-size guide/selector; 360°/video media model; engraving/
  personalization (affects line items + pricing); richer material/care specs.
- **Must NOT mix:** no AR build (separate, heavy); keep to data + UI spec.
- **Security/privacy:** personalization text sanitized; no PII beyond order context.
- **Done when:** reviewed jewelry-feature spec incl. pricing/line-item impact.

---

## 7. Immediate recommendation (what to do after 25A)

**Recommended: A — 25B Order Lifecycle SPEC.**

**Why, explicitly:** payment cannot be done well without a defined order
lifecycle. Today the repo has `OrderStatus { draft, submitted, cancelled }`, but
checkout produces `submitted` and never `draft`, and there is **no `paid`/
`fulfilled`/`refunded` state**. Any payment integration (B) needs to know exactly
which state an order enters before payment, which state a verified webhook moves it
to, how idempotency/retries map to states, and how refunds/cancellations behave.
Specifying delivery (C) or building more admin/analytics (D) before the lifecycle
is settled would either rework later or encode the current ambiguity.

**Sequence:** **25B (lifecycle SPEC)** → **25C (payments SPEC)** →
**25D (delivery SPEC)** → **25E (notifications SPEC)**, then the first *implementation*
stage chosen from those specs. Customer account (25F) can run in parallel after
25B since it does not block payments. Admin/analytics (option D) remains a valid
*parallel* track via the superpanel roadmap, but it does not move the store closer
to *taking money*, so it is not the priority right now.

**Short answer:** do **A (Order Lifecycle SPEC)** next, then **B (Payments SPEC)**.

---

## 8. Guardrails for every commercial stage

- Server-authoritative money (minor units); never trust client amounts.
- No raw card data, ever; verify webhooks server-side; idempotent order/payment.
- PII (name/phone/email/address) stays in domain models behind access control —
  never in `AnalyticsEvent`; audit logs stay PII-light.
- Admin stays `noindex`, local/guarded; secrets only via env/secret manager.
- One stage, one commit; SPEC before risky implementation; checks must pass before
  commit; no push/deploy without explicit instruction.
