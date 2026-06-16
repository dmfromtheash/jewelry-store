# AURELIA — Payments SPEC (Этап 25C)

> **Status: specification only.** No runtime code, Prisma schema, migrations,
> routes, provider integration, or secrets are introduced or changed by this file.
> It is the bridge between [`ORDER_LIFECYCLE_SPEC.md`](./ORDER_LIFECYCLE_SPEC.md)
> and a future payments migration/implementation. Everything in §2 was verified
> against the repository at commit `87e5cf7`.
>
> **Numbering:** Commercial Readiness track (see
> [`COMMERCIAL_READINESS_ROADMAP.md`](./COMMERCIAL_READINESS_ROADMAP.md), where
> `25C = Payments SPEC`). Implementation sub-stages use a `25C-impl-N` suffix to
> avoid renumbering the published roadmap — see §16.

---

## 1. Purpose

Payments touch money, so the implementation cannot be improvised. This SPEC fixes,
before any code, the things that are expensive or dangerous to get wrong:

- **Money correctness** — the amount charged must equal the server-authoritative
  order total; never a client-supplied amount.
- **Webhook security** — payment truth comes from a **signed, server-verified
  webhook**, never from a browser "success" redirect.
- **Idempotency** — duplicate checkouts, duplicate webhook deliveries, and page
  refreshes must not double-charge or double-transition.
- **Amount/currency verification** — a mismatch must reject, not mark paid.
- **Order lifecycle transitions** — payment events drive the states defined in the
  lifecycle spec (`pending_payment → paid / payment_failed`).
- **Auditability** — every sensitive transition is recorded, PII-light.
- **Future refunds** — the data model must leave room for refunds without rework.

---

## 2. Current repo reality (verified)

### 2.1 How an order is created
`src/lib/orders/actions.ts → createOrderDraft` (`'use server'`): validates fields,
loads products by slug from PostgreSQL, rejects `coming_soon`/missing/null-price,
**recomputes** `unitPrice` / `lineTotal` / `subtotalAmount` / `totalAmount`
server-side, and creates `Order` + `OrderItem[]` with explicit `status:
'submitted'`. The client sends only slugs + quantities + contact/delivery fields.

### 2.2 Order statuses
`OrderStatus { draft, submitted, cancelled }`. Checkout produces `submitted`;
`draft` is unused; `cancelled` is admin-only. (Full analysis in the lifecycle spec.)

### 2.3 Payment / delivery fields
- `Order.paymentMethod` — a **free-text string**, currently the literal
  `'not_connected'`.
- `Order.deliveryMethod` — a free-text placeholder label.
- **No `Payment` model, no provider id, no webhook/idempotency concepts.**

### 2.4 How the amount is computed
Server-authoritative, integer **minor units (kopecks)**: `subtotalAmount` /
`totalAmount` recomputed from DB prices; `currency` default `"RUB"`. No delivery
cost or discounts are added yet (`totalAmount === subtotalAmount`).

### 2.5 Immutable snapshots already present
`OrderItem` freezes `productSlug` / `productName` / `productSku` / `unitPrice` /
`quantity` / `lineTotal` at order time (nullable `productId` survives product
deletion). The order total is therefore a stable figure to verify a payment against.

### 2.6 What is already safe
- Client can never set the price (anti-tampering recompute).
- Money in minor units (no float drift).
- Unique `orderCode` external handle; success page shows **no PII**.
- Admin order/status changes are **audited** (`admin.order.status_changed`).
- Admin is local-only + session-gated + `noindex`.
- `SECURITY_NOTES.md §9` already states the payment posture: no card data on our
  servers, signed server-to-server webhooks, keys in env/secret manager.

### 2.7 What does NOT exist
No payment provider, no `Payment` model, no webhook route (only
`app/api/analytics/route.ts` exists), no payment statuses, no idempotency store,
no refund concept, no `paid`/`fulfilled` order states.

---

## 3. Payment goals v1

A minimal, correct, provider-agnostic online payment for the existing **guest**
checkout:

1. Order is created first (as today) in **`pending_payment`**.
2. A **payment session** is initialized **after** order creation (server-side).
3. The customer pays on a **hosted/redirect payment page** (provider-hosted),
   not a form on our domain.
4. A **verified, signed webhook** is the single source of truth that moves the
   order `pending_payment → paid` (or `→ payment_failed`).
5. Admin sees the **payment status**, provider reference, amount/currency, and
   timestamps.
6. **AURELIA stores no card data** (no PAN, no CVV) — only provider intent/charge
   ids and verified summary fields.
7. **No raw secrets or raw webhook bodies in logs / audit / dashboard.**

---

## 4. Non-goals v1

Explicitly out of scope for the first payment integration:

- Subscriptions / recurring billing.
- Saved cards / tokenized reuse.
- Installments / credit / BNPL.
- Marketplace split payouts.
- Multi-currency (RUB-only assumption pending market decision — see §17).
- Partial capture / authorization-then-capture flows.
- A full refunds **UI** (data model leaves room; UI is later).
- Loyalty / bonuses / coupons interaction.
- Requiring a customer account (guest checkout remains).
- Delivery integration / delivery cost in the total (separate SPEC).

---

## 5. Provider strategy

> **Do not finalize a provider in this SPEC.** Provider availability depends on
> country, business registration, currency, sanctions/legal constraints, and API
> terms that **change over time** and must be re-checked at decision time
> (25C-impl-0, §16). The architecture below is **provider-agnostic** so the choice
> can be deferred without reworking the model.

### A. Provider requirements (must-have to qualify)
- **Hosted/redirect payment page** or a securely tokenized checkout (no PAN on our
  servers).
- **Webhook signature verification** (HMAC or signed payload) we can verify server-side.
- **Idempotency** support, or a stable provider payment id we can dedupe on.
- A **stable payment id / reference** returned at init and echoed in the webhook.
- **Test / sandbox** mode for safe integration + smoke tests.
- **Refund support** in the API (even if we wire it later).
- A **clear status & fee model** (we store status; fees are informational).
- **Currency support** for the chosen market.

### B. Candidate provider notes (directions only — NOT endorsements)
Possible directions, each requiring a **separate current availability/legal check**
before selection; none is asserted to be suitable now:
- **ЮKassa (YooKassa)** — common for the RU market.
- **Stripe** — strong API/docs; **availability by country varies** and may be
  unavailable for some markets.
- **LiqPay / Fondy / WayForPay** — common for the UA market.
- Others may apply depending on the market.

The storefront UI is in Russian, which does **not** by itself determine the legal
market (RU vs UA vs other) — that is an explicit open question (§17).

### C. Decisions needed before implementation
- **Country / market** of the legal entity selling.
- **Business registration / payment account** availability.
- **Currency** (RUB today; confirm).
- **Provider availability** in that market (sanctions/legal).
- **Legal / tax constraints** (receipts/fiscalization may be mandatory, e.g. 54-ФЗ
  in RU — provider must support it or we need a fiscalization plan).

---

## 6. Proposed payment data model (candidates — NOT a migration)

A dedicated **`Payment`** record per payment attempt (one order may have several
attempts; the latest successful one defines `paid`). **No schema change here.**

Candidate fields:

| Field | Purpose |
|---|---|
| `id` | PK (cuid). |
| `orderId` / `orderCode` | Link to the order (verify against its total). |
| `provider` | Which gateway (enum/string). |
| `providerPaymentId` | Provider's payment/charge id. |
| `providerOrderId` / `reference` | Provider's order reference (if distinct). |
| `idempotencyKey` | Our key per attempt — **unique**; guards double-apply. |
| `status` | `paymentStatus` (see §7). |
| `amountMinor` | Charged amount in minor units — must equal order total. |
| `currency` | Must equal order currency. |
| `webhookEventId` | Last processed event id — **dedupe** replays. |
| `rawStatus` | Provider's raw status **string** (short, safe — not a full body). |
| `failureReason` | **Safe summary** machine reason (no raw provider dump). |
| `paidAt` / `failedAt` / `refundedAt` | Lifecycle timestamps. |
| `createdAt` / `updatedAt` | Standard. |

A small **`WebhookEvent`** (or processed-event set) is recommended for robust
dedupe: `{ provider, eventId (unique), paymentId?, receivedAt }`.

### Must NEVER be stored
- Card numbers (PAN), CVV, expiry, full track data.
- Full raw webhook bodies containing PII or secrets.
- Provider secret/API keys (env / secret manager only).
- Any payment payload in `AnalyticsEvent` / `AdminAuditLog` / dashboard.

---

## 7. Payment statuses (proposed `paymentStatus` enum v1)

| Status | v1? | Meaning |
|---|---|---|
| `not_required` | ✅ | Order needs no payment (e.g. future ₽0 / cash-on-delivery handoff). Keeps the model honest. |
| `pending` | ✅ | Session created; awaiting provider outcome. |
| `requires_action` | ➖ optional | Provider needs extra user action (3DS). Can fold into `pending` for v1 if hosted page handles it. |
| `paid` | ✅ | Verified successful payment (webhook). |
| `failed` | ✅ | Declined / expired / error. Retryable (new attempt). |
| `cancelled` | ✅ | Attempt voided (user abandoned / admin cancel before pay). |
| `refunded` | ⬜ later | Full refund processed. |
| `partially_refunded` | ⬜ later | Partial refund processed. |

**v1 set:** `not_required`, `pending`, `paid`, `failed`, `cancelled` (treat
`requires_action` as `pending` unless the provider requires it explicitly).
`refunded` / `partially_refunded` are reserved (Tier C in the lifecycle spec).

---

## 8. Order ↔ payment state mapping

`orderStatus` values per the lifecycle spec. **Actor**: `system`
(server/webhook), `admin`, `customer`.

| paymentStatus | orderStatus | Trigger | Actor | Admin sees | Customer sees | Notes / security |
|---|---|---|---|---|---|---|
| (none) | `pending_payment` | Order created at checkout | system | new order, unpaid | «Ожидает оплаты» | Server-priced; total frozen. |
| `pending` | `pending_payment` | Payment session initialized | system | "оплата начата" | redirect to hosted page | New `idempotencyKey`; no order change yet. |
| `pending` | `pending_payment` | User abandons / closes provider page | customer | still unpaid | «Ожидает оплаты» (retry) | No webhook ⇒ no state change; may expire later. |
| `paid` | `paid` | **Verified** success webhook | system | «Оплачен» + ref | «Оплачен» | Verify signature + amount + currency + dedupe by event id. |
| `failed` | `payment_failed` | Failure/expiry webhook | system | «Оплата не прошла» (safe reason) | «Оплата не прошла — повторить» | Retryable → new attempt. |
| (dup) | unchanged | **Duplicate** webhook (same event id) | system | no change | no change | Idempotent: ack 200, do nothing. |
| `failed` (reject) | unchanged | **Amount mismatch** webhook | system | flagged for review | unchanged | Do **not** mark paid; alert/audit. |
| `failed` (reject) | unchanged | **Currency mismatch** webhook | system | flagged for review | unchanged | Same as amount mismatch. |
| `cancelled` | `cancelled` | Admin cancels while pending | admin | «Отменён» | «Отменён» | Confirmation + reason; audited. |
| `paid` (late) | review | Payment success **after** cancellation | system | conflict flagged | — | Do not silently re-open; flag for manual review + refund path. |
| `refunded` | `refunded` | Refund processed (later) | admin/system | «Возврат» + amount | «Возврат оформлен» | Tier C; amount-verified; audited. |

---

## 9. Webhook security model

- **Verify the provider signature** on every webhook server-side; compute the
  expected signature from the raw body + the secret (env), constant-time compare.
- **Reject unsigned / invalid** webhooks with a non-2xx and **no state change**;
  log a safe summary only (no body).
- **Idempotency** keyed by provider **event id** (and/or `providerPaymentId`):
  store processed event ids; a repeat is acknowledged (200) but **applied once**.
- **Safe retry handling** — providers retry on non-2xx; our handler must be
  idempotent so retries converge, and return 2xx only after the state is safely
  persisted.
- **Amount + currency verification** against the **immutable order total** before
  setting `paid`; any mismatch ⇒ reject + audit, never `paid`.
- **Never trust the frontend success redirect** — it only navigates the UI; it
  must not change payment/order state. State changes only via the verified webhook.
- **Log safe summaries only** — `{ event id, payment id, status, amount, currency,
  result }`; never the raw body, never secrets, never PII.
- **Audit sensitive transitions** — `paid`, manual `mark-paid` override, `cancel`,
  `refund` — actor + reason, PII-light (extends `admin.order.status_changed`).
- **No PII/secrets in analytics/audit/dashboard** — order events carry the order
  code + coarse amount only.

---

## 10. Idempotency and race conditions

| Scenario | Recommended behavior |
|---|---|
| Duplicate checkout attempts | Each creates a distinct order (distinct `orderCode`); do not merge. Optionally dedupe by a client idempotency token later. |
| Duplicate payment initialization | Reuse the open `pending` payment for the order if one exists, or create a new attempt with a new `idempotencyKey`; never two active sessions silently charging twice. |
| Duplicate webhook events | Dedupe by stored event id; second delivery is a no-op that still returns 2xx. |
| User refreshes success page | Success page is **read-only**; it shows current status by order code; it must not mutate state. |
| Webhook arrives **before** the redirect | Fine — webhook is authoritative; the order may already be `paid` when the user lands; success page just reflects it. |
| Webhook arrives **twice** | Idempotent apply (see above). |
| Admin cancels while payment pending | Allowed; if a `paid` webhook then arrives, treat as **conflict** → flag for manual review + refund (do not silently un-cancel). |
| Payment success after cancellation | Do **not** auto-reopen; flag + refund path; audited. |
| Amount mismatch | Reject; never `paid`; flag + audit. |
| Currency mismatch | Reject; never `paid`; flag + audit. |
| Concurrent webhook + admin action | Use a DB transaction + the unique `idempotencyKey`/event id so only one transition wins; the other becomes a no-op/conflict. |

---

## 11. API / route architecture candidates (NOT created here)

Future candidates only — no routes are added in this stage.

| Candidate | Method | Auth | Input | Output | Security notes |
|---|---|---|---|---|---|
| Create payment session | `POST` (server action or route) | same-origin; tied to an existing order | `orderCode` (server re-reads total) | provider redirect URL / session | Amount from DB only; create/attach `Payment(pending)` + idempotency key; never amount from client. |
| Provider webhook | `POST /api/payments/webhook` (Node runtime) | **signature**, not session | raw provider body | `2xx`/`4xx` | Verify signature; dedupe by event id; verify amount/currency; no body logging; fast + idempotent. |
| Payment status | `GET` (server action / route) | same-origin; by `orderCode` | `orderCode` | safe status summary | Read-only; no PII beyond what success page already shows. |
| Success / cancel return pages | `GET` pages | public by code | `?order=CODE` | status view | **Read-only**; never mutate state; reflect webhook-driven status. |
| Admin payment view | within `/admin/orders/[orderCode]` | `ensureLocalAdmin` + `requireAdminSession` | order code | payment summary + timeline | Verified fields only; no raw webhook; `noindex`. |

---

## 12. Admin requirements

- Show **paymentStatus**, **provider + reference (`providerPaymentId`)**,
  **amount + currency**, **`paidAt` / `failedAt`** (and `refundedAt` later).
- Show a **safe failure summary** (machine reason), never a raw provider dump.
- Show a **timeline** of payment/order transitions (from the `OrderEvent` model
  proposed in the lifecycle spec) + the existing **audit** trail.
- **Manual override** (`mark paid` for offline/cash, or force-cancel) only behind
  an explicit confirmation **with a stored reason**, fully audited; never a default
  dropdown action.
- **Refund visibility** reserved for later (Tier C); the view should not imply a
  refund button exists until implemented.
- Stays local-only + session-gated + `noindex`; PII only behind the guard.

---

## 13. Customer-facing requirements

- **After checkout:** order created → redirected to the provider's hosted page
  (guest, no account required).
- **Pending payment:** «Ожидает оплаты» with a **retry/continue** action; the
  order is visible by `orderCode`.
- **Failed payment:** «Оплата не прошла — попробуйте снова» (friendly; no raw
  provider error), with a retry action that starts a new attempt.
- **Success redirect before webhook:** the success page shows a neutral
  «Обрабатываем оплату…» / current status by code, and updates to «Оплачен» once
  the webhook confirms — it must **not** claim paid on the redirect alone.
- **Notifications (later, Notifications SPEC):** order received / awaiting payment,
  paid, (later) shipped/delivered, cancelled, refunded.
- **Guest checkout remains** — no account required to pay; order is referenced by
  code (and bound to an account later if one exists).

---

## 14. Testing and smoke plan (for the future implementation)

- `npm run typecheck`, `npm run build`, `npx prisma validate/generate`.
- Provider **sandbox happy path**: order → session → success webhook →
  `pending_payment→paid`.
- **Failed payment**: failure/expiry webhook → `payment_failed`; retry works.
- **Duplicate webhook**: same event id applied once (no double transition).
- **Invalid signature**: rejected, no state change, safe log only.
- **Amount mismatch** / **currency mismatch**: rejected, never `paid`, audited.
- **Admin view**: payment status/reference/timeline render; transitions guarded.
- **PII/secrets scan** over new rows + logs: zero leaks (no card data, no secret,
  no raw body, no PII) — mirror the analytics smoke approach.
- `db:verify:orders` and a new `db:verify:payments` (rolled-back write path).
- No live keys in any test; sandbox only; no deploy.

---

## 15. Security / privacy checklist

- [ ] Provider secrets **only in env / secret manager**; never committed/printed.
- [ ] No `.env` / `.env.local` printing anywhere.
- [ ] **No raw card data** (PAN/CVV/expiry) ever stored or logged.
- [ ] **Webhook signature verified** (constant-time) before any state change.
- [ ] **Idempotency enforced** (unique event id / idempotency key).
- [ ] **Amount + currency verified** against the immutable order total.
- [ ] **Order/payment transitions audited** (actor + reason, PII-light).
- [ ] **No PII/secrets in analytics / audit / dashboard** (order code + coarse
      amount only).
- [ ] **Safe error messages** to the client (no internals/stack/provider dump).
- [ ] **No deploy** without explicit approval; sandbox before live.

---

## 16. Implementation roadmap (after this SPEC)

> **Numbering reconciliation:** `COMMERCIAL_READINESS_ROADMAP.md` reserves the
> top-level `25x` SPEC slots (`25D = Delivery SPEC`, `25E = Notifications SPEC`,
> …). The prompt's suggested `25D–25J` are payments **implementation** steps, which
> would collide. To keep the published roadmap intact, payments implementation is
> a **sub-track under 25C** (`25C-impl-N`). Mapping (prompt → this track):

1. **25C-impl-0 — Provider decision / current availability check** *(prompt's
   "25D")* — re-check market/country/currency/legality/availability **at decision
   time**; pick a provider. (May use a fresh web/market review.) **Blocks everything below.**
2. **25C-impl-1 — Payment data-model migration plan** *(prompt's "25E", docs)* —
   finalize `Payment` (+ `WebhookEvent`) fields, the lifecycle enum changes, and
   the legacy `submitted→pending_payment` mapping. (Builds on the lifecycle spec §10.)
3. **25C-impl-2 — Payment lifecycle schema implementation** *(prompt's "25F")* —
   additive migration for `Payment`/`WebhookEvent`/new statuses; `db:verify:payments`.
4. **25C-impl-3 — Provider sandbox integration** *(prompt's "25G")* — create
   payment session after order; redirect to hosted page; sandbox only.
5. **25C-impl-4 — Webhook verification + idempotency** *(prompt's "25H")* — signed
   webhook route; dedupe; amount/currency verify; `pending_payment→paid/failed`.
6. **25C-impl-5 — Admin payment visibility** *(prompt's "25I")* — payment status,
   reference, timeline; guarded transitions; override-with-reason.
7. **25C-impl-6 — Payment smoke / security review** *(prompt's "25J")* — full smoke
   + PII/secrets scan + checks.

Delivery (`25D`) and Notifications (`25E`) SPECs remain the next top-level commercial
SPECs and can be written in parallel, but payment **state** must be designed first.

---

## 17. Open questions (blockers before implementation)

1. **Country / market** of the selling legal entity (RU / UA / other)?
2. **Currency** — RUB only, or others?
3. **Provider** — which one (after the availability check)?
4. **Online-only**, or **cash on delivery** too (adds a `paid`-on-delivery path)?
5. **Guest checkout stays**, or is a customer account required before payment?
6. **Refunds in v1**, or deferred to Tier C?
7. **`pending_payment` lifetime** — how long before auto-expire/cancel?
8. **Stock reservation** — reserve on `pending_payment` (release on cancel/expire),
   or decrement only on `paid`?
9. **Mandatory delivery data before payment** — what address/method fields are
   required before a session can be created (links to Delivery SPEC)?
10. **Fiscalization / receipts** — is a fiscal receipt legally required (e.g. RU
    54-ФЗ), and does the provider handle it?

---

## 18. Final recommendation

**Do A — Provider Decision / current availability check (25C-impl-0) next.**

The architecture in this SPEC is intentionally provider-agnostic, but every
concrete next step (data-model fields, webhook signature scheme, fiscalization,
currency) depends on **which provider in which market** is actually usable —
and that availability must be checked **fresh** (it changes with sanctions, legal,
and API terms). Doing the **schema migration first (B)** risks encoding fields
(provider id shape, status vocabulary, fiscalization data) that the chosen provider
doesn't match, forcing rework. **Delivery SPEC (C)** is valuable and can proceed in
parallel as docs, but it doesn't unblock taking money. **Admin/analytics (D)** is a
separate track and doesn't move payments forward.

**Short answer:** **A) Provider decision / availability check** next (resolving the
§17 blockers, especially market + currency + provider), then the **payment
data-model migration plan** (25C-impl-1).
