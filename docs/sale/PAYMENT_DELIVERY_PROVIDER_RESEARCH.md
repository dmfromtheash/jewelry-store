# Payment & Delivery Provider Research — Ukraine MVP

> **Stage 35A — research/spec only.** This document does **not** add code, schema,
> migrations, routes, provider integration, env vars, or secrets. It is a current,
> sourced provider snapshot for a **Ukraine-first** small jewelry/accessories/gifts
> brand selling in **UAH**, to help the owner decide the realistic next
> implementation path for payment and delivery.
>
> Builds on the existing architecture specs — they remain valid; this doc supplies
> the **Ukraine-market, official-source** layer they deliberately deferred:
> [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md),
> [`../PAYMENT_PROVIDER_DECISION.md`](../PAYMENT_PROVIDER_DECISION.md),
> [`../DELIVERY_SPEC.md`](../DELIVERY_SPEC.md),
> [`../ORDER_LIFECYCLE_SPEC.md`](../ORDER_LIFECYCLE_SPEC.md).
> Buyer-facing honesty baseline: [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
>
> **All sources accessed: 2026-06-19.** Numbers are quoted only where visible on the
> official source on that date; everything else is marked "confirm in merchant
> cabinet / contract." Do **not** treat any figure here as a contractual guarantee —
> tariffs, terms, and onboarding rules change and must be re-checked at decision time.

---

## 1. Scope and non-goals

- **Docs-only research.** No code, no schema, no migrations, no routes.
- **No real keys/secrets.** Nothing is requested, invented, printed, or stored.
- **No integration implemented.** No acquiring, no callbacks, no carrier API, no TTN.
- **No deploy.** No production setup, no public URL.
- **Current manual model stays the valid baseline** until the owner is merchant-ready.
- Not a market report — only the providers relevant to this MVP decision.

---

## 2. Current AURELIA baseline

Verified against the repo and the sale docs (see [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md)):

- **Currency:** ₴ (UAH); money stored server-side in integer minor units (kopecks).
- **Payment model:** **manual.** `paymentMethod` records the customer's choice
  (`cash_on_delivery` / `manual_online` by реквізити). No acquiring, no webhook, no
  "paid" state, no card data anywhere.
- **Delivery model:** **manual.** Method choice (Самовивіз / Нова Пошта / Укрпошта /
  Курʼєр) + free-text note. No carrier API, no address model, no cost calc, no TTN,
  no tracking.
- **Checkout:** guest only; server-authoritative price (client can't set the amount).
- **Not present yet:** customer account/order history, notifications (email/SMS),
  provider APIs, fiscalization.

This is a deliberate, honest starting model for Ukraine — not a broken half-feature.

---

## 3. Source ledger

| Area | Provider | Official source | Accessed | What was verified | Notes / uncertainty |
|---|---|---|---|---|---|
| Payment | LiqPay | https://www.liqpay.ua/en/tariffs | 2026-06-19 | General card rate **1.5%**; funds to merchant within 1 banking day; UAH; reduced rate by application / from 300 000 UAH turnover | No monthly fee shown; per-category rates not listed |
| Payment | LiqPay | https://www.liqpay.ua/en/information/handbook/activation?tab=0 | 2026-06-19 | Payments only to **ФОП or legal-entity** accounts (no personal); **UAH current account** required; ПриватБанк service agreement; docs (ФОП: passport + РНОКПП; legal: rep passport+РНОКПП, charter, signatory proof); reg ~15 min, shop verification up to 24 h | LiqPay is a ПриватБанк product; bank relationship implied |
| Payment | LiqPay | https://www.liqpay.ua/en/doc/api/internet_acquiring/checkout | 2026-06-19 | "Checkout" = hosted personalized payment page, 10 payment methods | Page rendered navigation only; **signature/callback/sandbox detail to confirm in full API docs at integration time** |
| Payment | WayForPay | https://wayforpay.com/en | 2026-06-19 | Ukraine-focused; Visa/MC (cards worldwide **except RU/BY**), Google/Apple Pay, PayParts installments; **online contract**, Ukrainian bank details, activation **1–2 days**; pricing stated **2%** | "2%" is a homepage figure — **confirm exact tariff in cabinet/contract** |
| Payment | WayForPay | https://wiki.wayforpay.com/en/view/852100 | 2026-06-19 | Official docs; **hosted/redirect payment page** (card entry on WayForPay's protected page); `merchantSignature`; HTTP POST **callback** on payment status; **test details** section exists; ops SALE/AUTH/Settle/Refund/CheckStatus | Exact signature algorithm on linked sub-page, not this excerpt |
| Payment | Fondy | https://fondy.io/gb/ | 2026-06-19 | FONDY LTD (London), **FCA-regulated**; "global payments from 200+ countries"; international positioning; **Ukraine not mentioned** | UK/EU/international brand on the `/gb/` site |
| Payment | Fondy | https://fondy.io/gb/pricing/ | 2026-06-19 | **"Our licence and partner passport allow Fondy to onboard only entities registered within the UK and EU."** Pricing in £/€ (cards from 0.9% + £0.2/€0.2 auth) | **UAH not offered; UA-registered merchant cannot onboard here** |
| Delivery | Nova Poshta / Nova Post | https://novaposhta.ua/en/for-business/cooperation/integration/ | 2026-06-19 | Official **API** (JSON/XML, `api.novaposhta.ua/v2.0/`); **API key free**, generated in business account; **business account + contract required**; create EW/TTN, calculate cost, track, print markings | Developer portal `developers.novaposhta.ua` returned 403 during this check — capabilities taken from the official integration page |
| Delivery | NovaPay | https://novapay.ua/en/pisljaplata/ | 2026-06-19 | **Cash on delivery (післяплата):** buyer inspects then pays at branch; funds to seller in ~30 min (card) / next day (cash); fee **1% + 10 UAH** (NovaPay card) or **2% + 20 UAH**, **paid by buyer**; seller payout limits stated | Fees/limits to confirm in NovaPay cabinet at setup |
| Delivery | Ukrposhta | https://dev.ukrposhta.ua/documentation | 2026-06-19 | Developer docs exist (EN/UA, Swagger): domestic/international shipments, tracking, address classifier, post-office search; API support email | **Access prerequisites (key/token/contract) not stated on the page — must confirm** |
| Delivery | Ukrposhta | https://www.ukrposhta.ua/en/perekazy-v-mezhakh-ukrainy | 2026-06-19 | **COD / postal money transfer** within Ukraine: buyer pays on receipt at post office, funds to seller (cash/bank); recipient limits (e.g. 100 000 UAH/mo cash); example transfer fee ~6% (1000→60 UAH) | Exact COD tariff for a seller to confirm at contract |

**Sources checked but not fully readable on 2026-06-19** (do not rely on them as
verified): LiqPay Checkout API technical body (nav only); Ukrposhta API access
prerequisites; Nova Poshta `developers.novaposhta.ua` (HTTP 403). These are flagged
again in §3 notes and must be re-verified at implementation time.

---

## 4. Payment provider comparison

| Provider | MVP fit (UA, UAH, small FOP) | Integration shape | Owner requirements | Technical requirements | Risks / blockers | Recommendation |
|---|---|---|---|---|---|---|
| **LiqPay** | **Strong** — Ukrainian, UAH, ФОП-friendly, hosted page | Hosted "Checkout" payment page, 10 methods (verify signature/callback/sandbox in full API docs) | ФОП or legal entity; UAH current account; ПриватБанк service agreement; ID/tax docs; shop verification (~24 h) | Hosted page → no card data on our server; webhook/signature + sandbox **to confirm from official API docs at impl time** | Tied to ПриватБанк onboarding; API technical detail not fully verified here | **Primary candidate** for a Ukraine-first FOP. Verify API security model before coding. |
| **WayForPay** | **Strong** — Ukrainian, UAH, fast online onboarding, installments | Hosted/redirect protected page; `merchantSignature`; HTTP POST status callback; test mode | Ukrainian bank details; online contract; phone/SMS reg; activation 1–2 days | Hosted page (no PAN on us); signed callback (`merchantSignature`); SALE/Refund/CheckStatus; sandbox exists | Exact signature algorithm + final tariff to confirm in cabinet/wiki sub-pages | **Strong primary/alternative** to LiqPay. Pick one as primary, keep the other as fallback. |
| **Fondy (fondy.io/gb)** | **Poor for this case** | Hosted gateway (UK/EU) | — | — | **Official `/gb/` licence onboards only UK/EU-registered entities; UAH not offered; Ukraine not mentioned** | **Not suitable** for a Ukraine-registered small merchant under current official positioning. Do not pursue unless a separate official Ukrainian Fondy entity/terms is verified at decision time. |
| **Manual / COD (current)** | **Always-available baseline** | None (offline settlement) | Owner's bank details / реквізити; COD policy | None | Manual reconciliation; no auto "paid" state | **Keep as the safe MVP path** and as fallback after a provider is added. |

> Both viable online candidates (LiqPay, WayForPay) are Ukrainian, settle in UAH,
> onboard a ФОП, and use a **hosted payment page** — which keeps card data off
> AURELIA's servers, matching [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md)'s required
> posture. The choice between them is an **owner business decision** (bank
> relationship, tariff, installments, support), not a technical blocker.

---

## 5. Delivery / carrier comparison

| Carrier | MVP fit | Integration shape | Owner requirements | Technical requirements | Risks / blockers | Recommendation |
|---|---|---|---|---|---|---|
| **Nova Poshta / Nova Post** | **Strong** — dominant UA carrier; mature API | Official REST API (JSON/XML); **free API key** from business account; EW/TTN, cost calc, tracking, branch/address lookup | **Business account + contract** with Nova Post; key generated in cabinet | API key auth; address/warehouse model; create EW; track status (server-side) | Requires business account/contract before API use; key handling = secret (env only) | **Recommended first carrier** for API work, once the owner has a Nova Post business account. |
| **NovaPay післяплата (COD via Nova Poshta)** | **Strong for COD** | Operational service (can pair with the carrier API later) | Nova Post/NovaPay setup; payout method (NovaPay/bank card/cash) | None for manual use; ties to carrier API later | COD fee (1%+10 / 2%+20 UAH) **paid by buyer**; payout limits | **Keep COD via Nova Poshta as an MVP-safe manual option**; automate later with the API. |
| **Ukrposhta** | **Useful second carrier** (regional/rural reach, COD/money transfer) | Developer API (Swagger, EN/UA): shipments, tracking, address classifier | Account/contract; **API access prerequisites to confirm** | API auth/token **to confirm**; sandbox not confirmed on docs page | Access prerequisites + COD seller tariff not verified on the page; thinner public detail than Nova Poshta | **Second carrier**, after Nova Poshta. Verify access/sandbox/COD terms before coding. |

---

## 6. Cash on delivery and manual payment strategy

- **Keep `cash_on_delivery` as the MVP-safe default.** It needs no acquiring
  contract and works today; in Ukraine COD via Nova Poshta / Укрпошта is a normal,
  expected option.
- **Keep `manual_online` (оплата по реквізитах) as a fallback.** A simple bank
  transfer to the owner's ФОП account, confirmed manually — no provider required.
- **Online acquiring is additive, not a replacement.** When LiqPay/WayForPay is
  wired later, manual and COD paths should remain selectable, per
  [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md) (`paymentStatus.not_required` covers
  COD/manual handoff).
- **COD is an owner operational/legal/accounting decision**, not just code: who pays
  the COD fee, payout method and limits (NovaPay: up to 399 999 UAH/card, Ukrposhta
  recipient caps), reconciliation, returns, and fiscalization obligations.
- **Do not fake online payment.** Never display a "paid online" state before a real
  merchant account, verified webhook, and amount/currency verification exist. The
  manual model must stay honestly labelled (as it is today).

---

## 7. Recommended realistic next path

Staged, owner-gated; do not over-fragment:

1. **35B — Owner Decision Checklist** (docs): owner confirms the §8 inputs
   (provider, first carrier, legal/merchant status, bank account, COD policy, etc.).
   **Blocks all implementation.**
2. **36A — Payment Integration SPEC** for the **one** selected provider
   (LiqPay *or* WayForPay): finalize the `Payment`/webhook model from
   [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md) against that provider's real,
   re-verified API docs. Sandbox only.
3. **36B — Delivery Integration SPEC** for the **one** selected first carrier
   (Nova Poshta first): address model, cost calc, EW/TTN, tracking, building on
   [`../DELIVERY_SPEC.md`](../DELIVERY_SPEC.md).
4. **Implementation** only **after** the owner has real merchant/legal status,
   account, contract, keys, and sandbox access — each a separate, sandbox-first stage.

Manual + COD remain the live revenue path throughout, so onboarding delays never
block the store from taking orders.

---

## 8. Owner decisions required before implementation

- [ ] **Chosen payment provider** (LiqPay or WayForPay — pick one primary).
- [ ] **Chosen first carrier** (recommend Nova Poshta first; Ukrposhta second).
- [ ] **Legal/merchant status** — ФОП / ТОВ / legal entity (required: LiqPay &
      WayForPay onboard businesses, not personal accounts).
- [ ] **Bank / settlement account** in **UAH** (LiqPay requires a hryvnia current
      account; WayForPay requires Ukrainian bank details).
- [ ] **Merchant registration** in the provider's system / cabinet.
- [ ] **Contract / signing / verification** (LiqPay: ПриватБанк agreement + ~24 h
      shop verification; WayForPay: online contract, 1–2 days).
- [ ] **API key availability** (payment cabinet; Nova Post business-account key).
- [ ] **Test / sandbox availability** confirmed (WayForPay test details verified;
      LiqPay sandbox + Ukrposhta sandbox **to confirm**).
- [ ] **Webhook / callback domain** decision (needed before live; not set up now).
- [ ] **Fiscalization / accounting / legal** — РРО/ПРРО, receipts, taxes (consult
      accountant/lawyer; some sources reference receipt obligations — verify).
- [ ] **COD operational policy** — who pays the COD fee, payout method/limits,
      reconciliation, returns.
- [ ] **Delivery payer policy** — who pays shipping; free-delivery threshold?
- [ ] **Return / refund policy** (affects refund fields in both SPECs).
- [ ] **Production domain / demo URL availability** (see
      [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) §6; not created in this stage).

---

## 9. What not to implement yet

- ❌ No real acquiring integration (no live LiqPay/WayForPay charge flow).
- ❌ No payment callbacks/webhooks.
- ❌ No payment secrets/env (no keys, no signatures, no `.env` changes).
- ❌ No carrier API keys/env.
- ❌ No TTN / waybill (EW) generation.
- ❌ No automatic tracking.
- ❌ No production deploy.
- ❌ No fiscalization (РРО/ПРРО) wiring.
- ❌ No customer account / payment history.
- ❌ No hard dependency on a single provider (keep manual + COD selectable).

---

## 10. Implementation readiness gates

All must be **green** before any code work begins:

- [ ] Owner has **picked** provider + first carrier.
- [ ] Owner has **legal/merchant status** (ФОП/ТОВ) or a confirmed plan to obtain it.
- [ ] The chosen provider/carrier **official docs re-reviewed** at decision time
      (terms/tariffs/onboarding change).
- [ ] **Secrets available outside the repo** (env/secret manager), never committed.
- [ ] **Callback/webhook domain ready** if the provider requires it.
- [ ] **Test mode / sandbox understood** and reachable.
- [ ] **Data-model changes specified** (build on `Payment`/delivery snapshot SPECs).
- [ ] **Security review planned** (signature verify, amount/currency verify,
      idempotency — per [`../PAYMENTS_SPEC.md`](../PAYMENTS_SPEC.md) §9/§15).
- [ ] **No secrets in git** (verified before and after).
- [ ] **Manual fallback / rollback plan** confirmed (manual + COD stay available).

---

## 11. Final recommendation

For AURELIA's sale-ready MVP:

- **Keep the manual + COD model now** — it is honest, works today, and needs no
  merchant onboarding. This stays the live path while anything else is built.
- **Prepare for one online provider later.** The realistic Ukraine-first choices are
  **LiqPay** and **WayForPay** — both UAH, ФОП-friendly, hosted-page (no card data on
  us). **Fondy's current official `/gb/` positioning onboards only UK/EU entities and
  does not offer UAH, so it is not suitable** for a Ukraine-registered small merchant.
- **First carrier: Nova Poshta** (free API key, mature API, business account +
  contract), with **COD via Nova Poshta/NovaPay** kept as an MVP-safe option;
  **Ukrposhta as a second carrier** after access/COD terms are verified.
- **The first code path** should be **one selected payment provider + one selected
  carrier (Nova Poshta)**, sandbox-first, **only after** the owner's real
  merchant/legal/account/contract/key decisions (§8) are made.
- **Do not implement provider/carrier APIs before real merchant setup**, and never
  display a fake "paid online" state.
