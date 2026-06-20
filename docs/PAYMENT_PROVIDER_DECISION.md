# AURELIA — Payment Provider Decision Matrix (Этап 25C-impl-0A)

> ⚠️ **HISTORICAL / LEGACY (superseded for Ukraine-first planning — Этап 41A).**
> This decision framework predates the Ukraine-first pivot and the `RUB → UAH`
> migration; it carries **RUB / RU-market assumptions** (RUB currency, ЮKassa,
> 54-ФЗ). The project is now **UAH/₴**. For the **current**, official-source provider
> research and the owner decisions that gate any integration, use:
> [`sale/PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./sale/PAYMENT_DELIVERY_PROVIDER_RESEARCH.md)
> and [`sale/OWNER_DECISION_CHECKLIST.md`](./sale/OWNER_DECISION_CHECKLIST.md).
> The generic **evaluation criteria** here (must-haves: hosted page, signed webhook,
> idempotency, sandbox, refunds, fiscalization) remain a useful checklist. Kept for
> history — **not deleted**. Provider selection/integration stays **blocked until
> owner decisions exist**.

> **Status: decision framework only.** This document does **not** integrate a
> provider, does **not** select a final provider, and does **not** contain a live
> web availability check. No runtime code, Prisma schema, migrations, routes, or
> secrets are introduced or changed.
>
> It prepares the provider choice that gates the payments implementation. It pairs
> with [`PAYMENTS_SPEC.md`](./PAYMENTS_SPEC.md) (the provider-agnostic
> architecture) and [`ORDER_LIFECYCLE_SPEC.md`](./ORDER_LIFECYCLE_SPEC.md).
>
> **Availability rule:** where a provider's country/currency/legal availability is
> stated, it is marked **“requires current official verification.”** This document
> was authored **without** a live web check, so no provider is asserted to be
> usable. Verify against the provider's own official docs/pricing/legal pages at
> decision time and record the source + date in the comparison table (§6).
>
> **Numbering:** Commercial Readiness track. In
> [`PAYMENTS_SPEC.md §16`](./PAYMENTS_SPEC.md) the provider decision is
> `25C-impl-0`. This document is the **decision-framework half** of that step
> (`25C-impl-0A`); the actual research-with-sources is `25C-impl-0B`.

---

## 1. Purpose

A provider must be chosen **before** the payment data-model migration and the
integration, because the provider determines facts that are expensive to retrofit:

- **Availability changes** — country support, sanctions, and onboarding terms shift
  over time; a provider usable last year may not be usable now.
- **Country / legal constraints** — the selling legal entity's country dictates
  which acquirers will even open an account.
- **Currency constraints** — the provider must settle in the order currency
  (`RUB` today; see §3) or a conversion strategy is needed.
- **Fiscalization** — some markets legally require a fiscal receipt (e.g. RU
  54-ФЗ). Whether the provider issues receipts changes the data model and flow.
- **Webhook model** — signature scheme, event shape, and retry behavior define how
  `pending_payment → paid/failed` is driven (`PAYMENTS_SPEC §9`).
- **Refunds** — whether/how refunds are exposed affects reserved status fields.
- **Hosted checkout** — a hosted/redirect page keeps card data off our servers; a
  provider without one would change the PCI posture and is effectively disqualifying
  for v1.
- **Support burden** — docs quality, sandbox quality, and dispute handling shape
  ongoing operational cost.

Choosing the provider first means the migration encodes the **right** fields
(provider id shape, status vocabulary, fiscalization data) instead of guessing.

---

## 2. Current AURELIA payment context (verified against repo)

Verified against `prisma/schema.prisma`, `src/lib/orders/actions.ts`, and
[`PAYMENTS_SPEC.md §2`](./PAYMENTS_SPEC.md) at HEAD `473fd82`:

- **Currency default** — `Order.currency` and `Product.currency` default to
  `"RUB"`; money is stored in integer **minor units (kopecks)**.
- **Current `paymentMethod`** — a **free-text string**, currently the literal
  placeholder `'not_connected'`. `deliveryMethod` is likewise a free-text label.
- **No `Payment` model yet** — no provider id, no payment record, no status enum.
- **No webhook / idempotency yet** — the only route handler is
  `app/api/analytics/route.ts`; there is no payment webhook, no event-dedupe store.
- **Server-authoritative totals** — `createOrderDraft` recomputes
  `unitPrice / lineTotal / subtotalAmount / totalAmount` from DB prices; the client
  sends only slugs + quantities. The amount to charge is never client-supplied.
- **Immutable `OrderItem` snapshots** — `productSlug / productName / productSku /
  unitPrice / quantity / lineTotal` are frozen at order time, so the order total is
  a **stable figure to verify a payment against**.
- **Payments SPEC is provider-agnostic** — the architecture (`Payment` +
  `WebhookEvent` candidates, `paymentStatus` enum, webhook-as-truth) is designed so
  the provider can be plugged in without reworking the model.

**Implication:** the codebase is already in a good position — server-priced,
minor-unit, immutable-snapshot orders — so the remaining gating decision really is
the provider, not the order pipeline.

---

## 3. Decision inputs required from the owner

The provider cannot be chosen until the owner confirms these. None can be safely
defaulted by the assistant:

| # | Input | Why it matters | Current assumption (confirm) |
|---|---|---|---|
| 1 | **Country / market of sale** | Determines which acquirers serve customers there. | RU implied by RUB + RU UI — **unconfirmed**. |
| 2 | **Country / type of legal entity** | Acquirers onboard by entity country + type (ИП / ООО / sole trader / company). | Unknown. |
| 3 | **Currency** | Provider must settle in it. | `RUB` (schema default) — confirm. |
| 4 | **Online-only, or cash-on-delivery too** | COD adds a `paid`-on-handoff / `not_required` path (`paymentStatus.not_required`). | Online-only assumed. |
| 5 | **Guest checkout, or mandatory account** | Affects payer identity + receipt email + refund routing. | Guest stays (per SPEC). |
| 6 | **Refunds needed in v1** | Decides whether refund fields/flow ship now or stay reserved (Tier C). | Deferred (per SPEC). |
| 7 | **Fiscalization / receipts required** | Legal receipt obligation (e.g. RU 54-ФЗ) → provider must support it or we need a separate plan. | Unknown — **must check**. |
| 8 | **International payments needed** | Cross-border cards / multi-currency changes provider shortlist. | No (RUB-only) assumed. |
| 9 | **Expected order volume** | Affects fees tier, settlement terms, KYC depth. | Unknown. |
| 10 | **Acceptable fees** | Per-transaction % + fixed; settlement delay. | Unknown. |
| 11 | **Connection / go-live timeline** | KYC + onboarding can take days–weeks; affects sequencing. | Unknown. |

---

## 4. Provider requirements matrix (evaluation criteria)

Criteria to score every candidate against. **Must-have** failures are
disqualifying for v1; **scored** criteria differentiate qualified candidates.

| Criterion | Type | What "good" looks like | Disqualifying if… |
|---|---|---|---|
| **Country availability** | Must-have | Serves the entity's country + customers' country. | Not available in the market. |
| **Supported currency** | Must-have | Settles in the order currency (RUB). | No RUB / no acceptable conversion. |
| **Legal / entity requirements** | Must-have | Onboards the actual entity type. | Entity type can't be onboarded. |
| **Hosted payment page** | Must-have | Provider-hosted/redirect or secure tokenized field (no PAN on our server). | Requires raw card data on our domain. |
| **Webhook signature verification** | Must-have | Signed payload (HMAC/signature) verifiable server-side. | No way to verify authenticity. |
| **Idempotency support** | Must-have* | Idempotency keys, or a stable payment/event id we can dedupe on. | No stable id and no idempotency. |
| **Sandbox / test mode** | Must-have | Full sandbox for happy/failed/refund paths. | No safe test environment. |
| **Refund support** | Scored | Refund API (even if wired later). | (Lowers score; not v1-fatal.) |
| **Fiscalization / receipt support** | Conditional must-have | Issues fiscal receipts if legally required. | Required but unsupported, with no fallback. |
| **API / docs quality** | Scored | Clear, current, Node/REST-friendly docs. | — |
| **Fees / settlement** | Scored | Acceptable % + fixed; reasonable payout delay. | Outside acceptable range. |
| **Dispute / chargeback process** | Scored | Documented, workable dispute flow. | — |
| **Support quality** | Scored | Responsive support; status page; SLAs. | — |
| **Next.js / Node integration suitability** | Scored | REST/SDK that fits Node server runtime + server-side webhook verification. | Browser-only / unsupported runtime. |
| **Operational risks** | Scored | Stable, low sanction/holdback/freeze risk. | Unacceptable freeze/holdback risk. |

\* *Idempotency:* if the provider lacks explicit idempotency keys but returns a
stable payment id + event id, our own `WebhookEvent` dedupe (`PAYMENTS_SPEC §10`)
satisfies the requirement.

---

## 5. Candidate provider categories

Grouped by type — **no final selection here.** Each named candidate is a
**direction to verify**, not an endorsement, and carries the status
**“requires current official verification.”** Availability/legality/sanctions/
currency support change and must be checked against official sources at decision
time (§9).

### A. Local / regional acquiring
Domestic acquirers tuned to one market's currency, banking, and fiscalization.
- **ЮKassa (YooKassa)** — RU market direction — *requires current official verification.*
- **LiqPay** — UA market direction — *requires current official verification.*
- **Fondy** — UA/regional direction — *requires current official verification.*
- **WayForPay** — UA market direction — *requires current official verification.*
- **Other local providers** (bank-acquiring / regional gateways) — *requires current official verification.*

### B. International processors
Global card processors; strong APIs/docs but country availability varies and may
exclude some markets.
- **Stripe** — *requires current official verification* (country availability varies; may be unavailable for some markets).
- **Other international processors** — *requires current official verification.*

### C. Aggregator providers
Aggregators / payment-orchestration layers exposing several methods behind one
integration. *Requires current official verification* per aggregator
(availability, fees, settlement).

### D. Manual / cash-on-delivery fallback
No online provider: order created as `pending_payment` / `paymentStatus =
not_required`, settled offline (cash on delivery / manual transfer), marked paid by
admin (audited override per `PAYMENTS_SPEC §12`). Always available as an interim or
backup path; does **not** require a provider but is **not** an online-payment
solution.

> The storefront UI being in Russian does **not** by itself fix the legal market
> (RU vs UA vs other) — that is an explicit owner decision (§3.1) and drives which
> category-A providers are even relevant.

---

## 6. Comparison table template (to fill during research)

Fill one row per candidate during `25C-impl-0B` (the actual research step), each
row backed by an **official source + the date checked**. Until then, every cell is
`TBD` and every verdict is **“requires current official verification.”**

| Provider | Countries / entities supported | Currencies | Hosted checkout | Webhook signing | Sandbox | Refunds | Fiscalization | Fees | Risks | Verdict | Source / date checked |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ЮKassa (YooKassa) | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| Stripe | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| LiqPay | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| Fondy | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| WayForPay | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| _(other local)_ | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | TBD | requires current official verification | TBD |
| Manual / COD fallback | n/a (no provider) | RUB | n/a | n/a | n/a | manual | manual/none | none | manual reconciliation | always available (interim) | n/a |

**Rules for filling the table**
- Cite the provider's **own official** docs/pricing/legal page (URL) + date.
- Do **not** copy a verdict from memory or a third-party blog; verify at source.
- A single must-have failure (§4) ⇒ `Verdict = disqualified (reason)`.
- Pick a **primary** + a **fallback** (§9).

---

## 7. Security checklist before provider selection

The chosen provider + integration design must satisfy all of these (mirrors
`PAYMENTS_SPEC §9/§15`):

- [ ] **No card data stored by AURELIA** — no PAN/CVV/expiry/track data, ever.
- [ ] **Hosted checkout preferred** — card entry on the provider's page/iframe, not
      our domain.
- [ ] **Signed webhook required** — provider signs webhooks; we verify server-side
      (constant-time) before any state change.
- [ ] **Idempotency required, or a safe workaround** — idempotency keys, or stable
      payment/event id + our own dedupe store.
- [ ] **Amount + currency verification** — verify the webhook amount/currency
      against the immutable order total before marking `paid`.
- [ ] **Secrets only in env / secret manager** — never committed, printed, or
      logged.
- [ ] **No secrets in logs / admin / audit / analytics** — safe summaries only.
- [ ] **Refund policy checked** — how refunds are requested/confirmed, even if
      wired later.
- [ ] **Failure / duplicate webhook behavior checked** — provider retry semantics
      understood; our handler is idempotent and returns 2xx only after safe persist.

---

## 8. Architecture impact checklist

What the provider choice may change in the future migration (so we don't migrate
prematurely). Cross-ref `PAYMENTS_SPEC §6/§7/§11`:

- **`Payment` model fields** — exact set depends on what the provider returns.
- **`providerPaymentId` / `providerOrderId`** — id shape, which id is authoritative,
  whether order id and payment id are distinct.
- **`WebhookEvent` model** — event id field name, signature header, body shape used
  for dedupe.
- **Status dictionary** — provider's raw statuses → our `paymentStatus` enum
  mapping; whether `requires_action` (3DS) must be modeled or folds into `pending`.
- **Refund model** — full vs partial; refund id; whether reserved now or later.
- **Receipt / fiscalization fields** — receipt id, fiscal data, customer email
  requirement (driven by §3.7 and the market's law).
- **Currency assumptions** — confirm RUB-only vs multi-currency; minor-unit
  handling per currency.
- **Success / cancel URLs** — return URL contract; whether provider appends params.
- **`pending_payment` lifetime** — provider session expiry → our auto-expire policy
  (§3 input, `PAYMENTS_SPEC §17.7`).
- **Admin payment view** — which verified fields + timeline to surface
  (`PAYMENTS_SPEC §12`).

---

## 9. Recommended decision process

1. **Owner confirms** country / entity / currency (and the rest of §3, especially
   fiscalization + online-vs-COD).
2. **Check official provider docs / pricing / legal pages** for each in-market
   candidate (category A first, then B/C) — current sources only.
3. **Fill the comparison table (§6)** with values + **source + date** per cell;
   apply must-have gates (§4).
4. **Choose a primary provider + a fallback** (the fallback may be the manual/COD
   path in §5.D).
5. **Update `PAYMENTS_SPEC.md`** if provider-specific constraints surface (status
   vocabulary, fiscalization fields, webhook scheme).
6. **Only then create the migration plan** (`25C-impl-1`) and proceed to schema
   implementation (`25C-impl-2`).

---

## 10. Next implementation gates (do NOT do before provider selection)

Blocked until §9 completes and a provider + fallback are chosen and recorded:

- ❌ **Schema migration** — `Payment` / `WebhookEvent` / new statuses.
- ❌ **Webhook route** — `app/api/payments/webhook`.
- ❌ **Payment session endpoint** — create-session server action/route.
- ❌ **Frontend payment button** — checkout → hosted page redirect.
- ❌ **Admin payment controls** — payment view / status transitions / overrides.

Doing any of these first risks encoding the wrong provider assumptions and forcing
rework (`PAYMENTS_SPEC §18`).

---

## 11. Open questions (for the owner)

1. In which **country / market** is the selling legal entity registered, and where
   are the customers?
2. What is the **legal entity type** (ИП / ООО / sole trader / company / other)?
3. Is **RUB** the only currency, or are others needed?
4. **Online-only**, or is **cash on delivery** also required?
5. Does **guest checkout** stay, or is a **customer account** required before
   payment?
6. Are **refunds** required in v1, or deferred to Tier C?
7. Is a **fiscal receipt** legally required (e.g. RU 54-ФЗ), and must the provider
   issue it?
8. Are **international / cross-border** payments needed?
9. What is the **expected order volume** (affects fees / KYC)?
10. What **fee level** is acceptable, and what **settlement delay** is tolerable?
11. What is the **go-live timeline** (onboarding/KYC can take days–weeks)?

---

## 12. Final recommendation

**Do A — current provider availability research with official sources
(`25C-impl-0B`) next — but only after the owner answers the §3 inputs (especially
country, entity, currency, fiscalization, online-vs-COD).**

Rationale:

- **Without the owner's country / currency / entity decisions, the provider
  decision is incomplete** — the candidate shortlist (§5) and every must-have gate
  (§4) depend on them, and the assistant must not default them.
- **Without a confirmed provider decision, the migration (B) may be premature** —
  `Payment` fields, status vocabulary, webhook scheme, and fiscalization could be
  encoded wrong and require rework (`PAYMENTS_SPEC §18`).
- **Delivery SPEC (C)** is valuable and can proceed in parallel as a docs-only
  effort, but it does not unblock taking money.
- **Admin / analytics continuation (D)** is a separate, already-moving track and
  does not advance payments.

**Sequence:** owner answers §3 → fill §6 with official sources + dates
(`25C-impl-0B`) → choose primary + fallback → update `PAYMENTS_SPEC` if needed →
migration plan (`25C-impl-1`). The manual / COD fallback (§5.D) is available as an
interim revenue path if provider onboarding is slow.
