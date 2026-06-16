# AURELIA — Order Lifecycle SPEC (Этап 25B)

> **Status: specification only.** No runtime code, Prisma schema, migrations, or
> configuration are introduced or changed by this file. It defines the
> authoritative order lifecycle that **must exist before** payments, delivery,
> notifications, and customer accounts are built. Everything in §2 was verified
> against the repository at commit `1f32150`.
>
> **Numbering:** this is the **Commercial Readiness track** (see
> [`COMMERCIAL_READINESS_ROADMAP.md`](./COMMERCIAL_READINESS_ROADMAP.md)). Stage
> reconciliation with that roadmap is in §12.

---

## 1. Purpose

Today AURELIA can create a server-priced order but cannot take money, fulfill, or
keep a customer informed. Every one of those capabilities mutates **order state**,
so the order lifecycle is the contract they all depend on:

- **Payments** need to know which state an order is in *before* payment, which
  state a **verified** webhook moves it to, and how retries/failures map to state.
- **Delivery** needs states for "being prepared / shipped / delivered" without
  overloading the payment states.
- **Notifications** fire *on transitions*, so the set of transitions must be fixed.
- **Customer account** shows a (simplified) view of these states and their history.

Specifying the lifecycle first prevents encoding today's ambiguity (a dead `draft`
state, a `submitted` that means "new + unpaid") into payment code that would then
be expensive to unwind.

---

## 2. Current repo reality (verified)

### 2.1 What actually exists in code

- **`OrderStatus` enum** (`prisma/schema.prisma`): `draft` · `submitted` ·
  `cancelled`. `Order.status` defaults to `submitted`.
- **Order creation** (`src/lib/orders/actions.ts → createOrderDraft`, a
  `'use server'` action): validates fields, loads products by slug from the DB,
  rejects `coming_soon`/missing/null-price, **recomputes** `unitPrice` /
  `lineTotal` / `subtotalAmount` / `totalAmount` server-side, and creates
  `Order` + `OrderItem[]` with an **explicit `status: 'submitted'`**.
- **`Order` fields**: `orderCode` (unique), `status`, `customerName`,
  `customerPhone`, `customerEmail?`, `deliveryCity`, `deliveryMethod` (string),
  `paymentMethod` (string), `subtotalAmount`, `totalAmount` (integer **minor
  units / kopecks**), `currency` (default `"RUB"`), `createdAt`, `updatedAt`.
- **`OrderItem`**: immutable snapshot — `productSlug`, `productName`,
  `productSku?`, `unitPrice`, `quantity`, `lineTotal`, nullable `productId`
  (survives product deletion).
- **Admin** (`/admin/orders` + `/admin/orders/[orderCode]`): list (filter/search),
  detail with PII behind `ensureLocalAdmin` + `requireAdminSession`, and a status
  `<select>` wired to `updateOrderStatusAction`. The action validates the target
  is a valid enum value and updates **only** `status`; the change is **audited**
  (`admin.order.status_changed`, `metadata { from, to }`, no PII).
- **Success page** reads the order by code (`src/lib/orders/read.ts`) and shows
  code/items/total only — **no customer PII** (the code travels in the URL).
- **Dashboard KPI v1** counts orders, a per-status breakdown, and draft count/sum
  (currently 0/0 because nothing produces `draft`).

### 2.2 Statuses that exist now

| Status | Produced by | Meaning today | Reached? |
|---|---|---|---|
| `draft` | nothing | (intended: incomplete order) | ❌ never |
| `submitted` | `createOrderDraft` (default) | a new, **unpaid** guest order | ✅ all new orders |
| `cancelled` | admin manual select | order voided | ✅ admin only |

### 2.3 Fields that already exist (and are strong)

- Server-authoritative **money in minor units** + `currency`.
- **Immutable line snapshots** (`OrderItem`) — a correct pricing snapshot already.
- **Unique `orderCode`** as the external handle.
- **Audited** status changes.

### 2.4 Naming / semantic mismatches (must be resolved)

1. **Dead `draft` state** — exists in the enum and the admin dropdown (label
   "Черновик") but **no flow ever sets it**.
2. **Overloaded `submitted`** — means both "order placed" *and* "unpaid". Once
   payments exist, "placed" and "paid" must be distinguishable.
3. **Prose vs data** — the admin detail note and `ORDER_DRAFT_FLOW.md` call the
   order a "черновик/демо", while the stored status is actually `submitted`. The
   word "draft" is used loosely in prose but is a distinct, unused enum value.
4. **Unconstrained transitions** — the admin can move an order to **any** of the
   three statuses (e.g. `cancelled → submitted`); only enum membership is checked,
   not whether the transition is allowed.
5. **Free-text `paymentMethod` / `deliveryMethod`** — not enums/structured;
   `paymentMethod` is the literal string `not_connected`.

### 2.5 What does NOT exist

No `paid` / `processing` / `shipped` / `completed` / `refunded` states; no
`Payment` model; no `Address` model; no order **timeline/event** history; no
fulfillment/shipment model; no idempotency/webhook concepts.

---

## 3. Problems to solve

- `draft` is in the enum but unused → either give it a real meaning or remove it.
- `createOrderDraft` produces `submitted`, conflating *placed* with *unpaid*.
- No payment-aware states (`paid` / `payment_failed`) → cannot represent money.
- No fulfillment states (`processing` / `shipped` / `completed`).
- `paymentMethod = not_connected`; no verified payment transition path.
- No idempotency / webhook-event model → cannot safely process provider callbacks.
- No timeline → admin and (future) customers cannot see *what happened when*.
- No customer-facing lifecycle → nothing to show or notify on.
- Transitions are unconstrained → unsafe manual jumps are possible.

---

## 4. Proposed lifecycle v1

### 4.0 Key architectural decision: three orthogonal axes

A single flat status that mixes payment + fulfillment explodes combinatorially
(paid-but-unshipped, unpaid-cancelled, paid-refunded-returned, …). AURELIA should
model **three axes**, with one **customer-facing `orderStatus`** *derived from /
coordinated with* two backing statuses:

- **`orderStatus`** — the overall lifecycle (what the customer/admin sees).
- **`paymentStatus`** — owned by the payment layer (a future `Payment` record).
- **`fulfillmentStatus`** — owned by the delivery layer (future).

For **v1** we implement `orderStatus` + a `Payment` record carrying
`paymentStatus`; `fulfillmentStatus` arrives with delivery. This keeps payments
shippable without delivery, and avoids overloading.

### 4.1 Tier A — Must-have for Payments v1

| Status | Meaning | Set by |
|---|---|---|
| `pending_payment` | Order created at checkout, awaiting payment. **Replaces the current default.** | system (checkout) |
| `paid` | Payment **verified by a signed webhook**. | system (webhook) |
| `payment_failed` | Provider reported failure / payment expired. Retryable. | system (webhook/timeout) |
| `cancelled` | Voided before fulfillment (admin, customer pre-payment, or unpaid-timeout). Terminal. | admin / system |

> **Note on the existing enum:** `submitted` (today's de-facto "new unpaid") maps
> semantically to **`pending_payment`**. `draft` is recommended for **removal**
> in v1 (it is unused) — *or* repurposed strictly as "incomplete, not yet placed"
> **only if** persisted carts are ever introduced. The actual enum change is a
> **migration** (25C-impl, see §12), **not** part of this spec.

### 4.2 Tier B — After delivery/fulfillment

| Status | Meaning | Set by |
|---|---|---|
| `processing` | Paid; being prepared/packed. | admin / system |
| `shipped` | Handed to carrier; tracking available. | admin / system |
| `completed` | Delivered / fulfilled. Terminal happy path. | admin / system |

### 4.3 Tier C — Future optional

| Status | Meaning |
|---|---|
| `refunded` | Full amount returned after payment. |
| `partially_refunded` | Part of the amount returned. |
| `on_hold` | Manual hold (fraud check, stock issue). |
| `returned` | Goods returned post-delivery. |

### 4.4 Recommended naming for AURELIA

Use the Tier-A names above (`pending_payment`, `paid`, `payment_failed`,
`cancelled`) for v1. They are explicit, payment-aware, and avoid the loaded word
"draft". Keep `cancelled` (already exists). Treat `submitted`/`draft` as legacy to
be migrated/retired in the schema stage.

---

## 5. State transition table

Legend — **Actor**: `system` (server/webhook), `admin`, `customer`.
"Allowed" lists only **permitted** transitions; anything not listed is **denied**.

| From | To | Trigger | Actor | Allowed | Notes / security |
|---|---|---|---|---|---|
| — | `pending_payment` | Checkout creates a server-priced order | system | ✅ | Replaces today's `submitted`. Stock/price snapshot taken. |
| `pending_payment` | `pending_payment` | Payment session (re)initialized | system | ✅ | New idempotency key per attempt; no state change, attempt recorded. |
| `pending_payment` | `paid` | **Verified** payment webhook | system | ✅ | Only via signed webhook; verify amount+currency == order; dedupe by webhook event id. **Never** a manual admin action by default. |
| `pending_payment` | `payment_failed` | Provider failure / session expired | system | ✅ | Retryable. |
| `payment_failed` | `pending_payment` | Customer retries payment | customer/system | ✅ | New payment attempt + idempotency key. |
| `pending_payment` | `cancelled` | Admin cancel / unpaid timeout / customer abandons | admin/system | ✅ | Terminal. Release any reserved stock. |
| `payment_failed` | `cancelled` | Admin cancel / timeout | admin/system | ✅ | Terminal. |
| `paid` | `processing` | Admin/system starts fulfillment | admin/system | ✅ (Tier B) | Requires `paid`. |
| `processing` | `shipped` | Carrier handoff (tracking set) | admin/system | ✅ (Tier B) | Requires tracking number. |
| `shipped` | `completed` | Delivery confirmed | admin/system | ✅ (Tier B) | Terminal happy path. |
| `paid`/`processing`/`shipped`/`completed` | `refunded` / `partially_refunded` | Refund processed via provider | admin/system | ✅ (Tier C) | Only after a real refund; amount-verified; audited. |
| `cancelled` | * | — | — | ❌ | Terminal; no resurrection. Re-order creates a new order. |
| `paid` | `pending_payment` | — | — | ❌ | Cannot un-pay. |
| any | `paid` (manual) | Admin "mark paid" | admin | ⚠️ override-only | Allowed **only** behind an explicit, audited manual-override with a reason (e.g. offline/cash); never the default UI path. |

**Hard rules:** `paid` is reached **only** by a verified webhook (or an explicit
audited override). Terminal states (`cancelled`, `completed`, `refunded`) do not
transition further. Every transition is audited.

---

## 6. Payment readiness requirements

The lifecycle must give the future **Payments SPEC (25C)** these guarantees /
fields (to live on a `Payment` record, not as free text on `Order`):

- **Idempotency key** — our key per payment attempt; repeated provider calls/
  webhooks must not double-apply. Unique constraint.
- **Provider + provider payment id** — which gateway, and its transaction id.
- **Webhook event id** — store processed event ids to **dedupe** replays.
- **Payment status** — e.g. `requires_payment` / `authorized` / `paid` /
  `failed` / `refunded` / `partially_refunded`.
- **Amount + currency verification** — the webhook amount/currency **must equal**
  `order.totalAmount` / `order.currency` (minor units); mismatch ⇒ reject, do not
  mark paid.
- **Immutable pricing snapshot** — already provided by `OrderItem` + order totals;
  the order total is frozen at creation and is the source of truth for verification.
- **Failure states + reason** — `payment_failed` with a machine reason; no raw
  provider error dumps in admin UI.
- **Retry behaviour** — `payment_failed → pending_payment` creates a **new** attempt
  with a new idempotency key; old attempts remain for audit.
- **Fraud/error handling** — verify signatures server-side; never trust a client
  "success" redirect; treat unverified callbacks as untrusted.

---

## 7. Delivery readiness requirements

Specified later (Delivery SPEC, 25D); the lifecycle reserves room for:

- **Delivery method** — structured (enum/table), not free text (today it's a label).
- **Delivery price** — `deliveryPriceMinor`; affects order total (lifecycle/total
  interaction must be defined before payment verification reads the total).
- **Delivery address** — a structured `Address` (PII; guarded), not `deliveryCity`
  text only.
- **Carrier + tracking number** — structured; shown to customer when `shipped`.
- **Shipping/fulfillment status** — a **separate axis** (`fulfillmentStatus`):
  `unfulfilled` → `processing` → `shipped` → `delivered` (+ `returned`). The
  customer-facing `orderStatus` is coordinated with it but not identical, so
  payment and fulfillment evolve independently.

**Split decision:** keep `orderStatus` (overall) distinct from
`fulfillmentStatus` (logistics) and `paymentStatus` (money). Do not encode carrier
state into `orderStatus`.

---

## 8. Admin requirements

- **See:** `orderStatus`, `paymentStatus`, (later) `fulfillmentStatus`, totals,
  customer + delivery (behind the guard), and **payment/refund summary** (verified
  fields only — amount, status, provider id; **never** raw webhook bodies).
- **Timeline:** a chronological list of transitions (from → to, trigger, actor,
  timestamp) sourced from an `OrderEvent`/timeline model — the human story of the
  order. This also feeds the customer view.
- **Safe transitions only:** the admin UI must offer **only allowed** transitions
  for the current state (not the full enum, unlike today). Disallowed jumps are
  not selectable.
- **Confirmation + reason for sensitive transitions:** manual `cancel`, manual
  `mark paid` (override), and any `refund` require a confirmation step and a stored
  reason; all are audited (extends the existing `admin.order.status_changed`).
- **No dangerous defaults:** `paid` is system-only by default; refunds never
  happen by merely changing a dropdown.

---

## 9. Customer account requirements

The future customer view (Customer Account SPEC, 25F) shows a **simplified,
friendly** lifecycle, not raw internal states:

| Internal | Shown to customer |
|---|---|
| `pending_payment` | «Ожидает оплаты» |
| `payment_failed` | «Оплата не прошла — попробуйте снова» (with a retry action) |
| `paid` | «Оплачен» |
| `processing` | «Готовится к отправке» |
| `shipped` | «Отправлен» (+ tracking) |
| `completed` | «Доставлен» |
| `cancelled` | «Отменён» |
| `refunded` / `partially_refunded` | «Возврат оформлен» |

- **Do not** expose internal machine reasons, provider ids, webhook details, or
  idempotency keys.
- **Notifications** fire on the customer-visible transitions (see Notifications
  SPEC, 25E): order received/awaiting payment, paid, shipped (+tracking), delivered,
  cancelled, refunded.
- **Available data:** order code, items, totals, current status, tracking (when
  shipped), and the customer's **own** order history only — never another
  customer's data.

---

## 10. Data model implications (candidates — NOT a migration)

Listed as candidates for the schema stage (25C-impl) and later SPECs. **No schema
change is proposed by this document.**

- **`Order` (extend):** introduce a payment-aware `orderStatus` (new enum values),
  optionally `paymentStatus`/`fulfillmentStatus` if not split into models;
  consider `placedAt` / `paidAt` timestamps.
- **`OrderStatus` enum (revise):** add `pending_payment`, `paid`, `payment_failed`
  (Tier A); later `processing`, `shipped`, `completed`, `refunded`,
  `partially_refunded`. Retire/repurpose `draft`; map legacy `submitted`.
- **`Payment` (new, recommended):** `orderId`, `provider`, `providerPaymentId`,
  `idempotencyKey` (unique), `status`, `amountMinor`, `currency`, `failureReason?`,
  timestamps. Plus a processed-webhook-event store (or a `WebhookEvent` table) for
  dedupe.
- **`OrderEvent` / `OrderTimeline` (new, recommended):** append-only
  `{ orderId, from, to, trigger, actor, createdAt, note? }` — powers admin timeline
  + customer history; complements (does not replace) `AdminAuditLog`.
- **`Address` (new, for delivery):** structured recipient/address; PII; guarded.
- **`Fulfillment` / `Shipment` (new, later):** carrier, tracking, fulfillment status.
- **Keep in `Order`:** `orderCode`, totals, `currency`, contact (or move contact
  into an address/snapshot).
- **Must NOT be free text:** payment status, delivery method, tracking, refund
  state — all structured/enum. No secrets, no raw provider payloads, no card data.

---

## 11. Security / privacy notes

- **No secrets in DB or logs** — provider keys live in env/secret manager only.
- **No raw webhook dumps** in the admin UI or audit; store only verified,
  minimal fields (amount, currency, status, provider id, event id).
- **Verify webhook signatures** server-side; reject unverified/replayed events
  (dedupe by event id).
- **Idempotency** on payment apply — a replayed webhook must not double-transition.
- **Amount + currency verification** against the immutable order total before
  `paid`.
- **Audit every sensitive transition** (cancel, mark-paid override, refund) with
  actor + reason — extend the existing audit action; keep it **PII-light**.
- **Protect customer data** — PII (name/phone/email/address) stays in domain
  models behind the admin guard and the customer's own account.
- **No PII in analytics/audit/dashboard** — order events carry the **order code**
  and coarse amounts only, consistent with the analytics taxonomy.

---

## 12. Recommended implementation stages

> **Numbering reconciliation:** [`COMMERCIAL_READINESS_ROADMAP.md`](./COMMERCIAL_READINESS_ROADMAP.md)
> already assigns **25C = Payments SPEC**, **25D = Delivery SPEC**,
> **25E = Notifications SPEC** (all docs-only). The prompt's suggested list
> (payments spec, schema migration, provider integration, admin timeline,
> delivery, notifications) mixes **SPECs** and **implementation**. To avoid
> renumbering the published roadmap, *implementation* stages get an `-impl`
> suffix under their owning SPEC. The order is:

1. **25C — Payments SPEC** *(docs-only, next)* — pin the `Payment` model, webhook
   contract, idempotency, refund path, provider-agnostic. Depends on this spec.
2. **25C-impl-1 — Order lifecycle schema migration** — additive migration: new
   `OrderStatus` values (Tier A), `Payment` model, `OrderEvent` timeline; map
   legacy `submitted`→`pending_payment`, retire `draft`. (Implements §10.)
3. **25C-impl-2 — Payment provider integration v1** — sandbox/test provider:
   create payment session, verify signed webhook, `pending_payment → paid /
   payment_failed`, idempotent apply. No live keys.
4. **25C-impl-3 — Admin order timeline + guarded transitions** — show
   payment/timeline; offer only allowed transitions; confirmation + reason for
   sensitive ones.
5. **25D — Delivery SPEC** *(docs-only)* → then delivery impl (`Address`,
   structured method, `fulfillmentStatus`, Tier-B statuses, tracking).
6. **25E — Notifications SPEC** *(docs-only)* → then notifications impl (fire on
   transitions defined here).

Customer Account (25F, roadmap) can run in parallel after 25C-impl-1, since it
consumes the lifecycle but does not block payments.

---

## 13. Open questions (resolve before code)

1. **Provider / country / currency** — which acquirer; RUB only for now, or more?
2. **Delivery geography** — domestic only? pickup points + courier? carriers?
3. **Payment model** — online payment only, or also **cash on delivery** (which
   needs a `paid`-on-delivery path and changes the lifecycle)?
4. **Guest vs account** — does guest checkout remain, or is an account required at
   payment? (Affects where order history lives.)
5. **Refunds** — needed in v1, or deferred to Tier C?
6. **Customer-visible statuses** — confirm the §9 mapping and wording.
7. **Legacy orders** — how to map existing `submitted` demo rows during migration
   (treat as `pending_payment`, archive, or mark a one-off legacy state)?
8. **Stock reservation** — does `pending_payment` reserve stock (and release on
   cancel/timeout), or is stock only decremented on `paid`?

---

## 14. Final recommendation

**Do A — Payments SPEC (25C) next.**

The lifecycle is now defined, so the immediate next step is the **docs-only
Payments SPEC**, which pins the `Payment` model, the **signed-webhook** contract,
idempotency, amount/currency verification, and the refund path — all referencing
the states defined here. Only **after** the Payments SPEC fixes those field/
contract requirements should the **schema implementation** (25C-impl-1) run; doing
the migration first (option B) risks guessing payment fields and reworking the
enum. Delivery (C) and admin/analytics (D) are valuable but do not move AURELIA
closer to *taking money* and should not jump ahead of the Payments SPEC.

**Short answer:** **A) Payments SPEC** next, then the lifecycle **schema
migration** as its first implementation sub-stage.
