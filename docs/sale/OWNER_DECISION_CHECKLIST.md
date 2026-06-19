# Owner Decision Checklist — AURELIA Launch Readiness

> Companion to [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md).
> Package index: [`README.md`](./README.md).

## 1. Purpose

For the **real store owner/buyer** to make the practical decisions required **before**
payment, delivery, launch, and legal implementation. **Filling this checklist does
not mean any of these integrations are implemented** — it is the decision input that
gates the future SPEC + sandbox work. No code, secrets, or deploy are produced here.

## 2. Current safe MVP baseline

- **Manual payment + manual delivery** is the current, honest, working path.
- **Cash on delivery** and **manual online by реквізити** work **before** any provider API.
- **No real acquiring / webhooks / carrier APIs** are implemented yet.
- **No production deploy** yet.

See [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md) for the full implemented/deferred split.

## 3. Business identity decisions

- [ ] Store owner name / brand name
- [ ] ФОП / ТОВ / legal-entity status (acquirers onboard businesses, not personal accounts)
- [ ] Tax / accounting contact (bookkeeper or firm)
- [ ] **UAH settlement account** (bank)
- [ ] Public business contact email + phone
- [ ] Domain / hosting decision

## 4. Payment decisions

- [ ] Choose **first payment provider: LiqPay _or_ WayForPay** (both UAH, ФОП-friendly, hosted page)
- [ ] Confirm merchant-account path (LiqPay → ПриватБанк agreement; WayForPay → online contract)
- [ ] Confirm required documents (passport + РНОКПП for ФОП; charter + signatory proof for legal entity)
- [ ] Confirm **tariff / fee** in the provider cabinet (research saw ~1.5% LiqPay / ~2% WayForPay — **verify at signup**)
- [ ] Confirm payout / settlement account
- [ ] Confirm **test / sandbox** availability before any live work
- [ ] Confirm callback / **webhook domain** requirement
- [ ] Define **refund / cancel** policy
- [ ] Decide whether **`manual_online`** (по реквізитах) stays as a fallback
- [ ] Decide whether **`cash_on_delivery`** stays primary for MVP

## 5. Delivery decisions

- [ ] Choose **first carrier: Nova Poshta** (recommended first); **Ukrposhta** optional/second
- [ ] Business account / contract / **API key** availability (Nova Poshta key is free, from the business cabinet)
- [ ] **Delivery payer** policy: customer pays / store pays / free above a threshold
- [ ] **COD** availability and who pays the COD fee
- [ ] Default parcel **dimensions / weight**
- [ ] City / branch / address **collection** policy at checkout
- [ ] **Tracking / TTN** generation timing (manual now → automated later)
- [ ] **Return-delivery** policy

## 6. Legal / fiscal decisions

- [ ] **РРО / ПРРО / fiscalization** decision (consult accountant/lawyer — required before taking real money)
- [ ] Receipts / invoices policy
- [ ] Privacy policy / public offer (оферта) / return policy texts
- [ ] Data-retention expectations
- [ ] Personal-data handling owner/contact
- [ ] Warranty / return terms

## 7. Content / brand decisions

- [ ] Final brand name
- [ ] Logo / colors **only if owner requests a rebrand** (approved design is otherwise locked)
- [ ] Real product **photos** (own/licensed only)
- [ ] Product **categories**
- [ ] Product **descriptions**
- [ ] Real **SKU / stock / variants**
- [ ] Shipping / payment **copy** (checkout + info pages)
- [ ] Support contact **copy**

## 8. Implementation readiness gates

| Gate | Owner status | Notes |
|---|---|---|
| Legal / business entity confirmed | ☐ pending | ФОП / ТОВ |
| Payment provider selected | ☐ pending | LiqPay or WayForPay |
| Carrier selected | ☐ pending | Nova Poshta first |
| Settlement account ready | ☐ pending | UAH |
| Merchant account approved | ☐ pending | provider onboarding/KYC done |
| Test keys available outside repo | ☐ pending | env / secret manager only |
| Production callback domain selected | ☐ pending | for webhooks if required |
| Fiscal / legal stance approved | ☐ pending | accountant/lawyer sign-off |
| Demo fallback / manual path preserved | ☐ pending | COD + manual stay selectable |
| Security review planned | ☐ pending | signature/amount/idempotency review |

*(Mark each ☐ pending → ☑ done as the owner resolves it.)*

## 9. Recommended next technical path

1. Owner fills this checklist.
2. Choose **one** payment provider and **one** carrier.
3. Create the **payment integration SPEC** for the chosen provider.
4. Create the **delivery integration SPEC** for the chosen carrier.
5. **Security review** before any code.
6. **Sandbox** implementation only.
7. **Production activation only after** real owner credentials / domain / legal approval.

## 10. Explicit non-goals for now

- No payment implementation from this checklist alone.
- No secrets in repo or chat.
- No deploy.
- No fiscalization implementation.
- No carrier API implementation.
- No production payment activation.
