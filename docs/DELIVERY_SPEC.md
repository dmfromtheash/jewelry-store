# AURELIA — Delivery SPEC (Этап 25D)

> **Status: specification only.** No runtime code, Prisma schema, migrations,
> routes, carrier integration, or secrets are introduced or changed by this file.
> It defines what delivery data AURELIA needs, how it relates to checkout / order
> lifecycle / payment, and what must **not** be mixed into one stage.
>
> Pairs with [`ORDER_LIFECYCLE_SPEC.md`](./ORDER_LIFECYCLE_SPEC.md),
> [`PAYMENTS_SPEC.md`](./PAYMENTS_SPEC.md),
> [`PAYMENT_PROVIDER_DECISION.md`](./PAYMENT_PROVIDER_DECISION.md), and
> [`COMMERCIAL_READINESS_ROADMAP.md`](./COMMERCIAL_READINESS_ROADMAP.md)
> (`25D = Delivery SPEC`). Everything in §2 was verified against the repository at
> commit `d1cacbb`.
>
> **Availability rule:** where a specific carrier/delivery service is mentioned, it
> is a **direction to verify**, marked **“requires current official
> verification.”** No carrier is asserted to be available.
>
> **Update (Этап 59A) — manual delivery branch fields shipped.** The order now stores
> additional **manual** delivery fields: `deliveryBranch` (отделение/склад) and
> `deliveryComment`, alongside the existing `deliveryCity` / `deliveryMethod` /
> `deliveryDetails`. They are plain text, validated server-side (length-capped +
> HTML/script-stripped), shown in the admin order detail and the customer's account
> order page. This is **still purely manual**: there is **NO** Nova Poshta / Ukrposhta
> API, **NO** live branch lookup, **NO** delivery-price calculation, and **NO** TTN /
> tracking. When a carrier API is later integrated (owner-gated — §16 `25D-impl-0`
> onward), `deliveryBranch` is the natural slot for a selected warehouse id. Everything
> in §§3–18 (priced delivery, address model, fulfillment axis, carrier/tracking)
> remains future/owner-gated and unchanged by 59A.

---

## 1. Purpose

Delivery touches money, PII, and customer trust, so the shape must be fixed before
implementation. This SPEC pins down, before any code:

- **Delivery cost** — must be server-computed and added to the order total (and
  therefore to the amount a payment provider will charge).
- **Address / recipient** — what identifying data is collected, validated, and
  **snapshotted** on the order (not just held in a mutable profile).
- **Tracking** — how carrier/tracking can be added later without rework.
- **COD vs online-only** — whether cash-on-delivery is a path (it changes payment
  flow and `paymentStatus.not_required`).
- **Link to payment** — the charged amount must include delivery; the webhook
  verifies the **total** (`PAYMENTS_SPEC §9`).
- **Link to notifications** — delivery state changes (shipped/delivered) are future
  notification triggers (separate Notifications SPEC).
- **Link to admin order management** — admin must see delivery details and drive a
  fulfillment lifecycle, all audited and PII-aware.

Designing this first means the payment data-model and checkout encode the right
delivery fields instead of guessing.

---

## 2. Current repo reality (verified)

Verified against `prisma/schema.prisma`, `src/lib/orders/{actions,types,validate}.ts`,
and `src/lib/admin/orders.ts` at HEAD `d1cacbb`.

### 2.1 Delivery / shipping fields that exist today
On `Order` (`schema.prisma:127–151`):
- `deliveryCity String` — **required free-text city**.
- `deliveryMethod String` — **free-text placeholder label** (the schema comment
  says “pickup/courier/post — no real logistics yet”).
- `paymentMethod String` — placeholder (`'not_connected'`).
- `subtotalAmount` / `totalAmount` (minor units) + `currency` (default `RUB`).

That is the **entire** delivery surface. There is **no** address model, no street/
house/apartment, no postal code, no region/country, no pickup-point, no delivery
price field, no carrier, no tracking, no fulfillment status.

### 2.2 How checkout collects `deliveryMethod`
`OrderDraftInput` (`types.ts:15–23`) carries `deliveryCity`, `deliveryMethod`,
`paymentMethod` as plain strings alongside contact fields + `items[{slug, qty}]`.

### 2.3 Where `deliveryMethod` is stored
`createOrderDraft` (`actions.ts:99–101`) writes `deliveryCity`, `deliveryMethod`,
`paymentMethod` **straight through** from the client onto the `Order` row.

### 2.4 Free text or enum?
**Free text.** `deliveryMethod` is a `String`. Notably, `validateOrderDraftFields`
(`validate.ts`) validates `customerName`, `customerPhone`, `customerEmail`,
`deliveryCity`, and cart presence — **but does NOT validate `deliveryMethod` or
`paymentMethod` at all.** They are accepted as whatever the client sends.

### 2.5 Is there an address?
**Only `deliveryCity`.** No street, house, apartment, postal code, region, country,
or pickup-point fields anywhere.

### 2.6 Is there a delivery price?
**No.** `createOrderDraft` sets `totalAmount = subtotalAmount` with the explicit
comment “no delivery cost / discounts in 16A” (`actions.ts:87`). There is no
delivery-price field and no place it is added.

### 2.7 Is there tracking / carrier?
**No.** No carrier name, tracking number, label, or shipment concept exists.

### 2.8 Is there a fulfillment status?
**No.** The only lifecycle is `OrderStatus { draft, submitted, cancelled }`
(`schema.prisma:118–122`); checkout produces `submitted`. There is no
shipping/fulfillment axis (this matches `ORDER_LIFECYCLE_SPEC`'s "Tier B" gap).

### 2.9 What the admin sees
- **List** (`getAdminOrders`): `orderCode`, `status`, `customerName`,
  `deliveryCity`, `totalAmount`, `currency`, `createdAt`, item count.
- **Detail** (`getAdminOrderByCode`): adds `customerPhone`, `customerEmail`,
  `deliveryMethod` (raw string), `paymentMethod`, `subtotal/total`, items.
- Admin can change **only** `status` (`updateAdminOrderStatus` — “Never touches
  items, prices, or contact data”). No delivery editing, no fulfillment, no
  tracking.

**Net:** delivery today is a city string + an unvalidated method label, zero cost,
zero address, zero tracking, zero fulfillment lifecycle.

---

## 3. Problems to solve

1. **`deliveryMethod` is free text and unvalidated** — any string is accepted and
   stored; no canonical set, no price, no rules.
2. **No delivery price** — `totalAmount === subtotalAmount`; the store cannot charge
   for shipping, which most real orders require.
3. **No address model / snapshot** — only a city; no street/postal/pickup; nothing
   frozen at order time, so a later profile edit could (in a future account world)
   rewrite history.
4. **No carrier / tracking** — nothing to give the customer a tracking handle or to
   record who is shipping.
5. **No shipping / fulfillment lifecycle** — orders cannot move through
   preparing → shipped → delivered; admin only has `submitted/cancelled`.
6. **No address validation** — `deliveryCity` is length-checked only; no postal/
   method-specific validation, no pickup-point validation.
7. **No link to payment total** — because delivery isn't priced, the amount a
   provider would charge can't yet include shipping; `PAYMENTS_SPEC` assumes the
   total is authoritative, so delivery must feed it.
8. **No customer-visible delivery state** — the success page is PII-free and there
   is no "ожидает отправки / отправлен / доставлен" surface.

---

## 4. Delivery goals v1

Minimal, correct delivery for the first selling store:

1. **Choose a delivery method in checkout** from a **canonical, server-validated**
   set (reject unknown methods, unlike today).
2. **Snapshot the delivery choice on the order** (method code + label + the address/
   pickup data required by that method) — immutable like `OrderItem`.
3. **Compute / fix the delivery price server-side** at order time (never trust a
   client-sent price), per the chosen method.
4. **Add delivery price to the total** so `totalAmount = subtotalAmount +
   deliveryAmount` — the figure a payment provider will charge.
5. **Let the admin see delivery details** (method, recipient, address/pickup, price)
   in the order detail.
6. **Prepare tracking for later** — leave room for carrier + tracking number without
   committing to a carrier API now.
7. **Do NOT integrate a carrier API on the first step** unless a confirmed
   requirement demands it — a fixed-price / manual method set is enough for v1.

---

## 5. Non-goals v1

Explicitly out of scope for the first delivery implementation:

- Carrier **API integration** (real-time pickup-point lists, automated dispatch).
- Automatic **shipping-label printing**.
- **Route optimization** / courier dispatch logic.
- **International customs** / duties / declarations.
- **Multi-warehouse** / split shipments / stock-location routing.
- **Complex returns logistics** (return labels, reverse pickup).
- **Real-time delivery quotes** from carriers.
- **Mobile-app / courier** flow.

---

## 6. Delivery method model candidates (NOT a migration)

Describe the shape only; **no schema change here.** A delivery method can be a
small `DeliveryMethod` table (admin-editable) or a typed config/enum to start.
Candidate fields:

| Field | Purpose |
|---|---|
| `code` / `slug` | Stable machine id (e.g. `pickup`, `courier_city`, `post`). The canonical value validated at checkout. |
| `label` | Human label shown in checkout (RU). |
| `description` | Short explanation / conditions. |
| `price` | Delivery cost in **minor units** (0 = free). |
| `freeThreshold` | Order subtotal above which delivery is free (later). |
| `estimatedDays` | Est. delivery time (min–max) for display. |
| `active` | Hide/show without deleting. |
| `requiresAddress` | Whether full address fields are required (courier/post). |
| `requiresBranch` | Whether a pickup-point / branch selection is required. |
| `codAllowed` | Cash-on-delivery permitted for this method. |
| `onlinePaymentAllowed` | Online payment permitted for this method. |

**Order-side snapshot (candidate):** store the resolved `deliveryMethodCode`,
`deliveryMethodLabel`, and `deliveryAmount` **on the order** at creation, so the
order is self-describing even if the method config later changes (mirrors the
immutable `OrderItem` pattern).

---

## 7. Address / recipient data candidates

What may be needed (method-dependent — pickup needs less than courier):

| Field | Notes |
|---|---|
| `recipientName` | May differ from the account/customer; defaults to `customerName`. |
| `recipientPhone` | Contact for delivery; today `customerPhone` exists. |
| `recipientEmail` | Optional; for delivery notices. |
| `country` | For future international; default single country for v1. |
| `region` / `city` | `deliveryCity` exists; region may be needed for postal. |
| `street` / `house` / `apartment` | Required for courier; not for pickup. |
| `postalCode` | Required for post; validated by format/country. |
| `branch` / `pickupPointId` | Required when `requiresBranch` (pickup methods). |
| `comment` | Free-text delivery note (e.g. intercom code). |

**Privacy constraints:**
- Address/phone/email are **PII** — only behind the admin guard, **never** in
  analytics / dashboard / audit metadata (`SECURITY_NOTES`, `PAYMENTS_SPEC §9`).
- **The address must be a snapshot on the order**, not only a mutable customer
  profile — the order must preserve where it was actually sent, independent of any
  later profile edit (especially once customer accounts exist).
- Collect the **minimum** needed for the chosen method (pickup ≠ courier).

---

## 8. Delivery price and order total

- **Server-authoritative:** delivery price is resolved **server-side** from the
  chosen method's config at order creation — exactly like product prices today
  (`actions.ts` recompute pattern). **Never trust a client-sent delivery price.**
- **Total composition:** `totalAmount = subtotalAmount + deliveryAmount` (still
  integer minor units). Today `deliveryAmount` is implicitly 0; v1 makes it
  explicit and adds it.
- **Amount verification with payments:** the payment provider charges
  `totalAmount` **including delivery**; the webhook verifies the charged amount
  against the immutable order total (`PAYMENTS_SPEC §8/§9`). Delivery must be fixed
  **before** the payment session is created.
- **Delivery price changes after order created:** the order keeps its **snapshotted**
  `deliveryAmount`; a later config change does **not** retro-edit existing orders.
  Any admin change to a placed order's delivery price is restricted + audited (§11).
- **Free-delivery threshold:** reserved for later (`freeThreshold`); if added,
  it is evaluated server-side at order time and snapshotted.

---

## 9. Fulfillment lifecycle

Introduce a **`fulfillmentStatus`** axis, **orthogonal** to `orderStatus` and
`paymentStatus` (consistent with `ORDER_LIFECYCLE_SPEC`'s three-axis model).

| Status | Tier | Meaning |
|---|---|---|
| `not_started` | **v1 must-have** | Order placed/paid; not yet being prepared. |
| `preparing` | **v1 must-have** | Admin is assembling/packing the order. |
| `shipped` | **v1 must-have** | Handed to carrier / dispatched (tracking optional). |
| `delivered` | **v1 must-have** | Received by the customer. |
| `cancelled` | **v1 must-have** | Fulfillment stopped (mirrors order cancel before shipping). |
| `returned` | later | Customer returned the goods (Tier C; ties to refunds). |
| `ready_for_pickup` | optional | Pickup methods: arrived at the pickup point. |
| `partially_shipped` | optional | Split shipment (multi-warehouse non-goal v1). |

**v1 set:** `not_started`, `preparing`, `shipped`, `delivered`, `cancelled`.
`returned` is reserved for the returns/refunds work; `ready_for_pickup` /
`partially_shipped` are optional refinements.

---

## 10. State transition table (fulfillment)

`fulfillmentStatus` transitions. **Actor:** `admin` or `system`. Fulfillment
should generally start only once the order is payable/paid (or COD-confirmed).

| From | To | Trigger | Actor | Allowed? | Notes / security |
|---|---|---|---|---|---|
| (none) | `not_started` | Order becomes `paid` (or COD confirmed) | system | ✅ | Enters fulfillment once payment is settled (`paymentStatus = paid` or `not_required`+COD). |
| `not_started` | `preparing` | Admin starts preparing | admin | ✅ | Audited; order must not be cancelled. |
| `preparing` | `not_started` | Admin reverts | admin | ✅ | Audited; correction path. |
| `preparing` | `shipped` | Admin marks shipped (optionally adds tracking) | admin | ✅ | Audited; tracking/carrier optional in v1. |
| `shipped` | `delivered` | Admin marks delivered (or carrier event later) | admin/system | ✅ | Audited. |
| `not_started` | `cancelled` | Admin cancels before shipping | admin | ✅ | Requires reason; audited; ties to order `cancelled`. |
| `preparing` | `cancelled` | Admin cancels before shipping | admin | ✅ | Requires reason; audited. |
| `shipped` | `cancelled` | — | admin | ❌ (use return) | After shipping, use `returned` + refund (later), not cancel. |
| `delivered` | `returned` | Customer returns (later) | admin/system | ⬜ later | Tier C; ties to refund rules. |
| any | (skip) | Adding tracking | admin | ✅ (no status change) | Tracking can be attached without changing status; audited. |
| `delivered` | any earlier | Revert delivered | admin | ❌ default | Discourage; if needed, explicit override + reason + audit. |

Cross-axis rules: a `cancelled`/`payment_failed` order should not advance
fulfillment; a `paid` order whose fulfillment is `cancelled` is a conflict to flag
(mirror `PAYMENTS_SPEC §8` "paid after cancel" handling).

---

## 11. Payment interaction

- **Delivery priced before payment:** `deliveryAmount` is resolved and folded into
  `totalAmount` **before** a payment session is created — the customer pays the
  full amount including shipping.
- **COD vs online-only:** if COD is enabled (owner decision, §17), a COD method
  uses `paymentStatus = not_required` (or a `paid`-on-delivery handoff) instead of
  an online session; online-only methods require `paid` before fulfillment.
- **Payment amount must include delivery:** the charged amount = order
  `totalAmount` (subtotal + delivery). No separate delivery charge.
- **Webhook verifies the full total:** `PAYMENTS_SPEC §9` amount verification
  compares the webhook amount to the **immutable** order total, which now includes
  delivery — so delivery must be frozen at order creation.
- **Delivery changes after payment are restricted/audited:** once an order is
  `paid`, changing the delivery method/price must be a guarded, reasoned, audited
  admin action (and may require a refund/surcharge path) — never a silent edit.
- **Refunds and delivery (later):** refund rules must define whether delivery cost
  is refundable; reserved for the returns/refunds work (Tier C).

---

## 12. Admin requirements

- See the **delivery method** (code + label) and whether it is pickup/courier/post.
- See **recipient + contact** (name/phone/email) behind the guard.
- See the **address or pickup-point** captured for the order.
- See the **delivery price** and its contribution to the total.
- See and drive **`fulfillmentStatus`** (§9/§10) with guarded transitions.
- See/attach **tracking + carrier** (later) without changing status.
- **Safe edit rules:** placed-order delivery edits are restricted; price/method
  changes on `paid` orders require confirmation + reason (§11). Current code only
  allows status changes (`updateAdminOrderStatus`) — fulfillment must follow the
  same audited, minimal-surface pattern.
- **Audit log for delivery changes** — method/price/address/fulfillment/tracking
  changes recorded (actor + reason), extending the existing audit actions.
- **Avoid exposing unnecessary PII** — show address only where operationally needed;
  never copy it into analytics/dashboard.

---

## 13. Customer-facing requirements

- Show the **selected delivery method** + conditions at checkout.
- Show the **delivery cost** and the **updated total** (subtotal + delivery) before
  payment.
- Show an **estimated delivery** window (`estimatedDays`) where available.
- Show the **order/fulfillment status** by `orderCode` (guest, no account):
  «Ожидает оплаты» → «Оплачен» → «Готовится» → «Отправлен» → «Доставлен».
- Show **tracking** (later) when present.
- **Safe wording** for pending/paid/shipped states — no internal/provider details;
  the success page stays PII-free (it already shows only the order code).

---

## 14. Security / privacy checklist

- [ ] **Protect address/phone/email** — PII only behind the admin guard.
- [ ] **No PII in analytics / dashboard** — delivery events carry coarse, non-PII
      data only (method code, coarse amount), never address/contact.
- [ ] **Audit admin delivery changes** — method/price/address/fulfillment/tracking
      (actor + reason).
- [ ] **No raw provider payloads** (later carrier integration) stored/logged.
- [ ] **No secrets** — any future carrier keys in env/secret manager only; never
      printed/committed.
- [ ] **Minimal data retention** — collect only the fields the chosen method needs.
- [ ] **Safe error messages** — no internals/stack/carrier dumps to the customer.
- [ ] **Server-authoritative delivery price** — never trust a client-sent amount.
- [ ] **Snapshot address/method/price on the order** — immutable record of where it
      was actually sent and what was charged.

---

## 15. Testing and smoke plan (for the future implementation)

- **Delivery method selection** — only canonical methods accepted; unknown method
  rejected (closes the current "any string" gap).
- **Server recalculates delivery price** — client-sent price ignored;
  server-resolved price used.
- **Checkout total includes delivery** — `totalAmount = subtotal + delivery`
  verified.
- **Invalid delivery method rejected** — bad/inactive code → validation error.
- **Address validation** — required fields per method enforced (courier needs
  street; post needs postal; pickup needs branch).
- **Admin sees delivery details** — method/recipient/address/price/fulfillment
  render behind the guard.
- **Fulfillment transitions** — allowed transitions succeed, disallowed rejected;
  each audited.
- **Audit delivery change** — method/price/fulfillment change writes an audit row.
- **No PII in analytics/dashboard** — scan new rows/logs; zero address/contact
  leaks (mirror the analytics smoke approach).
- **Amount verification with payment** — paid total matches subtotal + delivery.
- `npm run typecheck`, `npm run build`, `npx prisma validate/generate`,
  `db:verify` (+ a future `db:verify:orders` delivery path). No carrier live calls;
  no deploy.

---

## 16. Implementation roadmap (after this SPEC)

> **Numbering:** `COMMERCIAL_READINESS_ROADMAP.md` reserves the top-level `25x`
> SPEC slots (`25D = Delivery SPEC`). Delivery **implementation** is a sub-track
> `25D-impl-N` (same convention as `25C-impl-N` for payments) so the published
> roadmap is not renumbered.

1. **25D-impl-0 — Delivery decision matrix / owner inputs** — confirm geography,
   methods (pickup/courier/post), COD vs online-only, paid vs free, required address
   fields, tracking-in-v1?, candidate carriers (each "requires current official
   verification"). **Blocks the rest.**
2. **25D-impl-1 — Delivery data-model migration plan** *(docs)* — finalize the
   `DeliveryMethod` config + order-side delivery snapshot fields + `deliveryAmount`
   + `fulfillmentStatus` enum, and the legacy `deliveryMethod` (free text) → coded
   mapping.
3. **25D-impl-2 — Checkout delivery method v1** — canonical method selection,
   server-side price, `totalAmount = subtotal + delivery`, validation; address
   fields per method.
4. **25D-impl-3 — Admin delivery visibility** — show method/recipient/address/price
   in admin order detail.
5. **25D-impl-4 — Fulfillment status controls** — `fulfillmentStatus` transitions
   (§10), guarded + audited; optional tracking field.
6. **25D-impl-5 — Delivery smoke / security review** — full smoke + PII scan +
   checks (§15).

Sequencing note: delivery price (`impl-2`) must land **before** payments charge a
real total, because the payment amount must include delivery (§11).

---

## 17. Open questions (for the owner)

1. **Geography** — which country/region(s) do we deliver to (and from)?
2. **Methods** — pickup / courier / postal — which are offered in v1?
3. **COD** — is cash-on-delivery required, or online-only?
4. **Paid or free** — is delivery charged, free, or free above a threshold?
5. **Required address fields** — which fields are mandatory per method (full address
   for courier, postal code for post, pickup point for pickup)?
6. **Tracking in v1** — is a tracking number/carrier needed at launch, or later?
7. **Carriers** — which delivery services to consider (each requires current
   official availability/terms verification)?
8. **International** — is international delivery needed now or later?

---

## 18. Final recommendation

**Do A — Delivery decision matrix / owner inputs (`25D-impl-0`) next — but the
overall critical path still runs through the payment-provider owner decisions.**

Reasoning:

- **Delivery and payment owner decisions overlap** — country, currency, COD-vs-
  online, and required fields are shared inputs. The owner should answer the §17
  delivery questions **together with** the `PAYMENT_PROVIDER_DECISION.md §3`
  payment inputs, since they constrain each other (e.g. COD changes both).
- **Payment-provider research (B)** still requires owner decisions and remains a
  hard gate on taking money; it can proceed once the shared owner inputs are in.
- **Payment data-model migration plan (C)** is premature until both the provider is
  chosen **and** delivery pricing is specified — because the order **total** the
  payment verifies now must include delivery (§8/§11).
- **Notifications SPEC (D)** is valuable and can be written in parallel as docs (it
  depends on order/payment/delivery **states**, which are now specified), but it
  doesn't unblock selling.
- **Admin/analytics (E)** is a separate, already-moving track and doesn't advance
  the commercial path.

**Sequence:** collect the **combined** delivery (§17) + payment
(`PAYMENT_PROVIDER_DECISION §3`) owner decisions → `25D-impl-0` delivery matrix +
`25C-impl-0B` payment availability research → delivery data-model plan
(`25D-impl-1`) and payment data-model plan (`25C-impl-1`), designed **together** so
the order total (subtotal + delivery) is the single figure payments verify. Until
the owner answers, implementation of either is premature.
