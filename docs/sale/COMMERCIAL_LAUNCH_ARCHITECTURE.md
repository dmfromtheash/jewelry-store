# Commercial Launch Architecture — AURELIA (Stage 56A)

> **Architecture & planning only — owner-gated. NOTHING here is implemented, deployed,
> tunneled, or activated.** No app code, Prisma schema/migration, CSS/design, env, or
> secrets are added or changed by this document. It defines *what must be decided and
> built — and in what order* — before real **payment**, **delivery**, **public hosting**,
> **email**, and **legal/fiscal** operations exist. **Ukraine-first, ₴ (UAH); the current,
> honest model is MANUAL payment + MANUAL delivery.**
>
> Index: [`README.md`](./README.md) · owner decisions: [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)
> · Ukraine provider research: [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md)
> · deploy readiness: [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md)
> · honest limits: [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
>
> Provider-agnostic technical architecture already exists in [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md)
> and [`../DELIVERY_SPEC.md`](../DELIVERY_SPEC.md) (the *RU-market* framing in the older payment
> docs is **legacy/superseded**; their **Payment/WebhookEvent model + signed-webhook +
> idempotency + amount/currency** architecture stays valid). This document is the **single
> commercial-launch index** that ties them to the owner decisions and a post-decision roadmap.

---

## 0. Implemented now vs. planned (the honest split)

| Area | Implemented now (verified) | Planned / spec only (owner-gated) |
|---|---|---|
| Payment | `cash_on_delivery` + `manual_online` (по реквізитах); server-authoritative price; order code | Real acquiring (LiqPay / WayForPay), signed webhooks, "paid" state, refunds |
| Delivery | manual method (`self_pickup`/`nova_poshta`/`ukrposhta`/`local_courier`) + free-text note | Carrier API, address model, cost calc, TTN/tracking |
| Hosting | **local** dev demo (`127.0.0.1:5000`) + readiness gates | Public demo URL, production hosting, monitoring/backups |
| Email | none | Transactional provider, password reset, email verification, notifications |
| Legal/fiscal | none in code | РРО/ПРРО, receipts, offer/privacy/returns |

Everything in the right column is **blocked until the owner checklist is green** (§G).
The left column is the safe model the buyer can use and demo today.

---

## A. Payment architecture (owner-gated)

**Current state.** Checkout stores the customer's chosen `paymentMethod`
(`cash_on_delivery` | `manual_online`) as a plain string; **no acquirer, no charge, no
webhook, no "paid" state** — money is confirmed off-system. Price is recomputed on the
server (client cannot set it); amounts are integer minor units in UAH.

**Candidate providers (owner picks ONE first; verify all details at signup).**
LiqPay, WayForPay (both UAH, ФОП-friendly, hosted payment page); Fondy as an alternative.
Sourced snapshot + fee notes: [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md).
**Do not assume rates/terms — confirm in the provider cabinet.**

**Future data-model concept (NOT built; see [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md)).**
A `Payment` record per order attempt (provider, providerRef, amount minor units, currency,
status, createdAt/updatedAt) + a `WebhookEvent` log (provider, eventId, signature-verified,
rawType, processedAt). The **signed webhook is the source of truth** for "paid", never the
browser redirect.

**Payment status lifecycle (concept).**
`initiated → pending → paid → (refunded | partially_refunded)` and `initiated → pending →
failed | cancelled | expired`. The order's fulfillment lifecycle
(`submitted → processing → completed/cancelled`) stays **separate**: payment status gates
"can fulfill", it does not replace the order state machine.

**Non-negotiable security requirements before any live key.**
- **Signed-webhook verification** (HMAC/RSA per provider) — reject unsigned/invalid.
- **Idempotency** — a provider may retry a webhook; processing must be exactly-once
  (unique `(provider, eventId)`; re-delivery is a no-op).
- **Amount + currency verification** — compare the webhook amount/currency to the order's
  server-side total; mismatch ⇒ reject + alert (never trust client/redirect amounts).
- **No card data on our servers** — hosted provider page only (reduces PCI scope).
- **Secrets outside git** — provider keys live in env/secret-manager, never in the repo.
- **Refund/cancel caveats** — refunds are provider+legal flows (fees, partials, windows);
  spec the admin "refund" action and reconciliation, do not auto-refund blindly.

**Owner prerequisites (gate).** ФОП/ТОВ (entity), UAH settlement account, merchant approval/
KYC, provider **sandbox** then **production** credentials, a **callback/webhook domain**, and
legal/fiscal stance (§E). **Do not implement until these are green** — sandbox-only first.

---

## B. Delivery / carrier architecture (owner-gated)

**Current state.** `deliveryMethod` (`self_pickup`/`nova_poshta`/`ukrposhta`/`local_courier`)
+ a free-text `deliveryDetails` note. **No carrier API, no address model, no cost calc, no
TTN/tracking.** Architecture reference: [`../DELIVERY_SPEC.md`](../DELIVERY_SPEC.md).

**Candidate carriers.** Nova Poshta (recommended first — free API key from the business
cabinet), Ukrposhta (optional/second). Owner verifies account/contract.

**Future concepts (NOT built).**
- **Address model** — structured recipient + city/branch (warehouse) or street address,
  replacing the free-text note when a carrier is integrated.
- **Warehouse/branch selection** — Nova Poshta "відділення"/postomat picker at checkout
  (city → branch), validated against the carrier directory.
- **Quote / cost calculation** — carrier API estimates shipping cost (weight/dimensions);
  decide who pays (§ payer rules).
- **TTN / tracking** — generate a waybill (ТТН) and surface tracking status; today this is
  manual by the owner.
- **Delivery method lifecycle** — `chosen → (label_created/TTN) → in_transit → delivered |
  returned`, kept distinct from order + payment lifecycles.

**COD relationship.** Cash-on-delivery (післяплата) couples delivery + payment: the carrier
collects money and remits it; spec the COD fee, who pays it, and reconciliation before
enabling. COD can stay the MVP-primary path **without** any carrier API.

**Payer rules (owner decision).** customer pays / store pays / free above a threshold —
affects checkout copy + cost display.

**Owner prerequisites (gate).** Carrier account + **API key** (kept outside git), shipping
policy, COD policy, default parcel weight/dimensions, regions/warehouse decisions. **Do not
implement until green** — sandbox/test directory first.

---

## C. Public demo / hosting architecture (owner-gated; NO deploy here)

**Current safe default = local demo** (`127.0.0.1:5000`, admin local-only). This stage
creates **no tunnel, no hosting, no public URL.**

**Future public-demo options (planning).** A short, supervised **temporary tunnel**
(storefront only) — [`LOCAL_TUNNEL_DEMO_RUNBOOK.md`](./LOCAL_TUNNEL_DEMO_RUNBOOK.md); or a
hosted demo / production deploy — [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md).

**Architecture requirements before any public exposure.**
- **Separate demo DB** — never the owner's real data; disposable, fictional, restorable.
- **Secret ownership** — env/secret-manager held by the owner, never in git; rotate on handoff.
- **Access control** — who can reach the link and how it's gated (basic auth / allowlist /
  expiring link); decide before sharing.
- **Admin exposure policy** — admin stays **local-only by construction** (`ensureLocalAdmin`
  404s in production / off-localhost). **No public admin without a dedicated security review.**
- **Backup / restore + rollback/stop plan** — demo DB backup (`npm run db:backup`), a known
  restore path, and a one-step "kill the link" plan.
- **Cost ceiling** — agree a max monthly spend (hosting/DB/egress) before provisioning.
- **Demo-data policy** — fictional catalog + orders only; the screenshot demo orders are the
  documented example (owner may cancel; cancel restocks).
- **Pre-exposure gates (already built, 52A–55A)** — `npm run demo:preflight`,
  `demo:rehearsal`, `smoke:routes`, `smoke:admin` must be green; see
  [`PRE_PUBLIC_DEMO_READINESS.md`](./PRE_PUBLIC_DEMO_READINESS.md) and
  [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md). **Owner approval is
  required per-demo.**

---

## D. Email / account operations SPEC (owner-gated; NEW)

**Current state.** Customer accounts exist (registration/login/profile/password change/order
history, scrypt, session revocation, durable rate limiting, auth audit — 47A–51A). **No email
is sent** anywhere: there is **no password reset, no email verification, no notifications.**
See [`../customer/CUSTOMER_AUTH_ACCOUNT_SPEC.md`](../customer/CUSTOMER_AUTH_ACCOUNT_SPEC.md).

**Why email is its own gate.** Password reset and email verification are **meaningless and
unsafe without a real transactional-email provider** and an authenticated sender domain. A
"reset" link that can't be delivered (or is spoofable) is worse than none.

**Transactional email provider decision (owner).** Pick one (e.g. a reputable ESP / SMTP
relay); verify deliverability for Ukraine + UAH-market addresses. **Verify capabilities and
terms at signup — do not assume.** Keep API keys/SMTP creds outside git.

**Sender-domain authentication (required before sending).**
- **SPF** — authorize the sending IPs/ESP for the domain.
- **DKIM** — sign outgoing mail with the domain key.
- **DMARC** — publish a policy (start `p=none` to monitor, then tighten) + alignment.
Without SPF/DKIM/DMARC, reset/verification mail lands in spam or is spoofable.

**Password-reset architecture (concept, NOT built).** Single-use, **short-TTL, hashed**
reset token tied to the account; **generic responses** (never reveal whether an email exists);
**rate-limited** (reuse the durable limiter, 51A); invalidate on use + on password change
(bump `sessionVersion`). **Do not fake a reset flow without a provider.**

**Email-verification architecture (concept).** Verify on registration / email change with a
single-use token; an unverified account keeps reduced capability (still guest-equivalent
checkout). Email **change** stays immutable in v1 until this exists.

**Email security risks.** Account-enumeration via reset responses/timing; token leakage in
logs/referrers; open-redirect in reset links; spoofing without DMARC; provider key compromise.
Spec mitigations before any send.

**Support / account recovery caveats.** Until email reset exists, account recovery is a
**manual owner/support process** (verify identity out-of-band). Document the support contact +
process; never reset a password on an unverified request.

---

## E. Owner decision matrix

Single source of the decisions that gate implementation. Companion granular checklist:
[`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md).

| Area | Decision needed | Owner input | Technical impact | Blocked implementation |
|---|---|---|---|---|
| Payment provider | LiqPay **or** WayForPay (first) | merchant account, sandbox→prod keys, webhook domain | `Payment`/`WebhookEvent` model, signed webhook, idempotency, amount verify | real acquiring + "paid" state + refunds |
| Delivery carrier | Nova Poshta (first); Ukrposhta optional | carrier account + API key, shipping/COD policy | address/branch model, cost calc, TTN/tracking | carrier API + waybills + tracking |
| Legal entity | ФОП / ТОВ | registration docs, signatory | enables merchant onboarding | any real money flow |
| Fiscalization | РРО / ПРРО stance | accountant/lawyer sign-off | receipt generation + reporting | taking real money legally |
| Offer / privacy / returns | policy texts | approved copy | info pages + checkout copy | compliant public sale |
| Email provider | transactional ESP/SMTP | account + sender domain (SPF/DKIM/DMARC) | reset/verification/notification senders | password reset + email verification |
| Hosting / public demo | tunnel vs hosted vs production | domain, hosting, secrets, access control, cost ceiling | demo DB, deploy pipeline, monitoring/backups | public URL / production shop |
| Imagery / licensing | real product photos | owned/licensed images | populate existing image slots | real-product marketing visuals |
| Support process | recovery + support channel | contact + SLA | manual recovery now; ticketing later | reliable customer support |
| Analytics / consent | analytics + cookie consent | privacy stance | consent banner + event policy | lawful tracking in EU/UA |

---

## F. Post-decision implementation roadmap (large blocks, owner-gated)

Each block starts **only** after its row in §E is green; each ships behind sandbox/test first.

1. **Payment block** — payment SPEC (chosen provider) → `Payment`/`WebhookEvent` model +
   additive migration → provider **sandbox** integration → **signed-webhook** handler
   (idempotent + amount-verified) → admin **payment status** + reconciliation → refund/cancel
   → **security review** → production activation.
2. **Delivery block** — delivery SPEC (chosen carrier) → **address/branch model** + additive
   migration → carrier **sandbox** (directory/quote) → **TTN/tracking** + admin label flow →
   COD reconciliation.
3. **Email block** — provider + **SPF/DKIM/DMARC** → password **reset** → email
   **verification** → order/status **notifications**.
4. **Public demo / deploy block** — separate demo DB + secrets + access control → deploy
   (behind the 52A–55A gates + owner approval) → **monitoring + backups** → rollback drill.
5. **Legal / fiscal block** — integrate owner-provided offer/privacy/returns + РРО/ПРРО rules
   (owner/lawyer/accountant supplied; not legal advice from this project).

Sequencing note: payment + legal/fiscal typically gate "real money"; delivery (esp. COD) and
email follow; public deploy can precede money as a **storefront-only** demo.

---

## G. Global gates / red lines

- **Do not implement payment/delivery/email/deploy/fiscal until the owner checklist (§E +
  [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)) is green for that area.**
- Sandbox/test before production, always; **security review before any live key**.
- **Secrets never in git or chat**; provider keys in env/secret-manager only.
- **No public admin** without a dedicated security review; admin stays local-only by design.
- **No legal/fiscal advice** is given here — the owner's lawyer/accountant decides.
- The **manual payment + manual delivery** MVP remains the honest current model and a valid
  fallback even after providers are added.
- This document changes **no code, schema, design, env, or deployment** — it is the plan, not
  the build.
