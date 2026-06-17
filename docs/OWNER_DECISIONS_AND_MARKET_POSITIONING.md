# AURELIA — Owner Decisions & Market Positioning (Этап 26C)

> **Status: strategy / owner-decision capture only.** No runtime code, Prisma
> schema, migrations, routes, configuration, or secrets are introduced or changed
> by this file. It records a **commercial direction** so later stages stop
> sprawling — it is **not** a legal/tax ruling, **not** a final payment/delivery
> provider choice, and **not** an implementation.
>
> **Numbering note.** The published commercial track in
> [`COMMERCIAL_READINESS_ROADMAP.md`](./COMMERCIAL_READINESS_ROADMAP.md) is numbered
> `25A → 25J`. The recent **audit** (26A, read-only) and **Order Spine Hardening**
> (26B, implemented — `src/lib/orders/transitions.ts`, `src/lib/orders/methods.ts`,
> `db:verify:lifecycle`) proceeded under a parallel `26x` label. This document is
> **26C** in that line. The two numbering schemes are complementary; where this doc
> changes direction (currency/market), the older `25x` specs are explicitly
> superseded on those points (see §2.1).
>
> Verified against the repository at HEAD `44ec4c9` (Order Spine Hardening).

---

## 1. Purpose

This document fixes the **working commercial vector** for AURELIA after the 26A
audit and the owner's decision, so that subsequent stages have a stable target and
do not drift into endless broad specs or speculative features.

It exists to answer three questions once, in writing:

- **What is AURELIA being built into?** A Ukraine-first, sale-ready MVP — a
  finished, brandable online store a small Ukrainian jewelry / accessories / gifts
  seller could buy and adapt, not just a course project or a code archive.
- **Who is it for?** A specific buyer (see §6), not "everyone".
- **What does that change about the roadmap?** Priorities shift from *writing more
  specs* to *raising the demonstrable sale value* in small, safe blocks (see §3, §7).

What this document is **not**:

- **Not legal/tax advice.** The seller's legal form, fiscalization (РРО/ПРРО),
  and VAT obligations are **not** settled here and must be checked against current
  official Ukrainian sources before any real launch.
- **Not a final provider choice.** No payment acquirer and no delivery carrier are
  selected. Those remain gated on owner inputs + current official verification
  (see [`PAYMENT_PROVIDER_DECISION.md`](./PAYMENT_PROVIDER_DECISION.md)).
- **Not a migration or a schema change.** The currency/market pivot recorded here
  has **data-model implications** (§2.1) but is deliberately **not** implemented in
  this stage.

---

## 2. Current strategic decision

The owner has chosen the following working vector. These are **decisions**, not
options, unless explicitly marked "future" or "to confirm".

| Dimension | Decision |
|---|---|
| **Product direction** | **Ukraine-first sale-ready MVP** — a finished, brandable storefront + back-office that can be demoed and sold. |
| **Target buyer** | A small Ukrainian brand of jewelry / bijouterie / accessories / gifts — typically an Instagram/Telegram shop or handmade/fashion seller who wants a real branded site instead of taking orders by hand in DMs. |
| **Sale positioning** | Sell it as a **ready branded online store + brand adaptation + setup + short support window** — *not* as a "code archive". |
| **Primary market** | **Ukraine.** |
| **Primary currency** | **UAH.** Schema defaults and the demo catalog baseline are UAH as of **Этап 27A** (migration `switch_currency_to_uah`); the storefront shows ₴ — see §2.1. |
| **Secondary / future currencies** | EUR / USD as an **export-ready future**, not a required v1 payment path. |
| **Checkout model** | **Guest checkout is mandatory.** Customer accounts come later. Target flexibility = online payment **and** cash-on-delivery (COD / "оплата при отриманні"). |
| **Delivery model** | Самовивіз (pickup), **Нова Пошта**, **Укрпошта**, courier / local delivery. Carrier API integration is **later**, not v1. |
| **Refunds** | Architected for from the start (lifecycle reserves the states); full refund/return **UI** is later. |
| **Fiscalization / receipts** | A **legal/provider blocker** for a real launch. **Not** to be implemented without a separate, current official check. |
| **Launch goal** | A **demo / sale-ready MVP** that can be shown to a potential buyer or brand — not necessarily a live revenue store on day one. |

### 2.1 Important consequence: market/currency pivot vs. the existing specs

The `25x` specs ([`ORDER_LIFECYCLE_SPEC`](./ORDER_LIFECYCLE_SPEC.md),
[`PAYMENTS_SPEC`](./PAYMENTS_SPEC.md),
[`PAYMENT_PROVIDER_DECISION`](./PAYMENT_PROVIDER_DECISION.md),
[`DELIVERY_SPEC`](./DELIVERY_SPEC.md)) were written against the repo's **current
defaults**, which are **RU / RUB**:

- `prisma/schema.prisma`: `Order.currency` and `Product.currency` default to
  `"RUB"`; money is stored in integer **minor units (kopecks)**; the storefront UI
  copy is in Russian.
- `PAYMENT_PROVIDER_DECISION.md §3` explicitly lists country/entity/currency as
  **unconfirmed owner inputs**, with `RUB`/RU only *assumed*.

The 26C decision **resolves those open inputs toward Ukraine / UAH.** This means:

- The **market is Ukraine**, the **target currency is UAH**, and the provider
  shortlist shifts to **category-A Ukrainian acquirers** (LiqPay / Fondy /
  WayForPay / bank acquiring — each still **"requires current official
  verification"**, per `PAYMENT_PROVIDER_DECISION.md §5`).
- The **delivery shortlist** becomes Нова Пошта / Укрпошта / pickup / local courier
  (again, carrier availability/terms **require current official verification**).
- The **schema currency default (`RUB`) was inconsistent with the chosen
  direction.** ✅ **Resolved in Этап 27A** (migration `switch_currency_to_uah`):
  `Product.currency` and `Order.currency` now default to `"UAH"`, the existing
  demo/catalog product rows were rebased RUB → UAH (numeric minor-unit amounts
  unchanged), and the storefront formatter renders the **₴** glyph. Historical
  `Order` rows were intentionally **not** rewritten — new orders are UAH; old ones
  keep their original currency. Secondary EUR / USD stay an export-ready future.

> The minor-unit money model and server-authoritative pricing are **currency-
> agnostic** and survived the pivot unchanged; only the default/label and the
> provider/carrier shortlists moved.

---

## 3. What this means for the roadmap

The audit (26A) and hardening (26B) confirmed the **spine is sound**: server-
authoritative pricing, immutable order-line snapshots, a status transition guard
(`ALLOWED_ORDER_TRANSITIONS`), method allowlists, and an audited admin. The
constraint is no longer *architecture* — it is *sale value*. Therefore:

- **Stop writing broad SPECs without implementation.** The lifecycle / payments /
  delivery / provider specs already exist; further docs-only chains have
  diminishing return. Prefer a **safe implementation block** when one is available
  (see §8).
- **Optimise for demonstrable sale value.** Each stage should move AURELIA visibly
  closer to "a buyer can see it, click it, and imagine it as their store."
- **Work in small implementation blocks.** One stage = one commit, narrow scope,
  checks must pass (typecheck/build/verify) before commit.
- **Keep payment/delivery provider decisions gated.** They require **current
  official verification** and owner legal/entity inputs; do not integrate before
  that. The **manual / COD fallback** (`PAYMENT_PROVIDER_DECISION.md §5.D`) remains
  the safe interim revenue path that needs no provider.
- **Production deploy is gated** on a security/production checklist (§7, 26I). No
  deploy without explicit owner approval.
- **Mobile polish is now critical.** A sale-ready demo is judged on a phone first;
  mobile quality directly affects perceived value and price.

---

## 4. Product packaging for sale

For AURELIA to be **sellable** (not merely buildable), it must become a package a
non-technical buyer can evaluate and trust:

- **Public demo link** — a hosted, browsable storefront (deploy gated on §7/26I).
- **Demo admin access** — either time-boxed demo credentials **or** a safe
  read-mostly "demo admin mode" (no destructive ops, no real PII), so a buyer can
  see the back-office without risk.
- **Polished screenshots** — storefront + admin, desktop **and** mobile.
- **Buyer-facing README** — what it is, what it does, what it costs to adapt, in
  plain language (not developer-only).
- **"How to rebrand" guide** — how to swap brand name/logo/colours, replace
  products/categories, and change contacts — without touching code where possible.
- **Capability list** — an honest "what works today" (catalog, guest checkout,
  orders, admin, audit, KPI).
- **Limitations list** — an honest "what is foundation/stub" (payments not
  connected, delivery is a label, no customer account, no notifications).
- **Future paid / customization options** — the upsell menu (payments wiring,
  delivery integration, multi-language, customer accounts, etc.).
- **Clean git history** — coherent one-stage-one-commit history; no secrets ever
  committed.
- **Basic deployment notes** — how a buyer (or their developer) brings it up.
- **No secrets in the repo** — verified; `.env`/`.env.local` never committed,
  printed, or shared.

---

## 5. Sale value ladder

An honest ladder of value. **No precise market price is asserted as fact** — there
is no live market research in this document. The ranges below are **internal
planning assumptions only** and **require market validation** before being quoted
to anyone.

| Rung | What it is | Honest value driver | Status today |
|---|---|---|---|
| **1. Asset / demo value** | The code + a browsable demo as-is. | Saves a buyer the cost of building a storefront + admin from scratch. | **Reachable now** (needs demo deploy + packaging, §4). |
| **2. Sale-ready MVP value** | Demo + packaging + rebrand guide + honest capability/limitation lists. | Buyer can picture it as *their* store and adapt it themselves. | Target of 26D–26F. |
| **3. Custom setup / adaptation value** | Done-for-you rebrand, product load, contacts, basic deploy, short support. | Buyer gets a *running* branded store without doing the work. | A **service** layered on rung 2. |
| **4. Business-with-revenue value** | A live store actually taking orders/money (payments + delivery + fiscalization wired and legal). | Highest value, but gated on provider + legal + deploy decisions. | **Not** a near-term target; blocked on §2 owner/legal inputs. |

> *Planning-assumption note:* the jump from rung 1 → rung 2 is the **cheapest,
> highest-leverage** move (packaging + polish, little risk). Rung 4 is the most
> valuable but the most blocked. All figures one might attach to these rungs
> **require market validation** and are out of scope here.

---

## 6. Buyer personas

### A. Instagram / Telegram jewelry seller
- **Pain:** takes orders manually in DMs; no real site; no order history; looks
  amateur; loses sales to friction.
- **What AURELIA solves:** a real branded storefront, guest checkout, a structured
  order list in an admin, audited status changes.
- **Polish before sale:** flawless mobile; fast load; trivial rebrand; obvious
  "how do customers pay / get delivery" answer (even if COD/manual at first).
- **Possible blocker:** expects working online payments + Нова Пошта on day one
  (not yet wired) — manage expectations with the honest limitations list (§4).

### B. Handmade / accessories brand
- **Pain:** has a brand identity but no e-commerce; outgrowing a marketplace/linktree.
- **What AURELIA solves:** brandable design, categories, product pages, a back-
  office that looks professional.
- **Polish before sale:** theming/rebrand must be genuinely easy; product media
  quality; category flexibility.
- **Possible blocker:** wants deeper brand customization than a quick swap allows —
  position as a paid adaptation (rung 3, §5).

### C. Gift-box / candles / cosmetics-accessories seller
- **Pain:** seasonal/gift-driven sales, needs gift sets, certificates, clean
  presentation.
- **What AURELIA solves:** already models gifts/sets and a gift certificate;
  multi-item orders; clean PDP.
- **Polish before sale:** gifting UX (sets, certificates), seasonal banners,
  delivery clarity.
- **Possible blocker:** needs notifications (order confirmations) which don't exist
  yet — list as a future paid option.

### D. Small web studio / freelancer buying a reusable Next.js store base
- **Pain:** wants a solid, modern base (Next.js 15 / React 19 / Prisma / Postgres)
  to resell to *their* clients, instead of starting from zero.
- **What AURELIA solves:** a clean architecture with real seams (catalog seam,
  server-authoritative orders, admin guard/audit) and honest docs.
- **Polish before sale:** code clarity, docs, clean history, clear extension points.
- **Possible blocker:** wants payment/delivery already abstracted — point to the
  provider-agnostic specs as evidence the seams exist, even if unwired.

---

## 7. Near-term roadmap after 26C

Proposed stages — **not implemented here.** Recommended order, each with type,
goal, scope, what must not be mixed in, and done-criteria.

### 26D — Sale-Ready MVP Roadmap *(docs / planning)*
- **Goal:** turn this positioning into a concrete, sequenced build plan for rungs
  1→2 of the value ladder.
- **Scope:** prioritise the small implementation blocks that raise sale value;
  define which limitations are acceptable for a demo vs must-fix.
- **Must not mix:** no provider integration, no schema migration, no deploy.
- **Done when:** an ordered backlog of small, safe, sale-value blocks exists.

### 26E — Mobile & Demo Polish Audit *(audit, read-only)*
- **Goal:** find what makes the storefront look unfinished on a phone.
- **Scope:** mobile layout, tap targets, performance, visual consistency, empty
  states, demo data quality — storefront and admin.
- **Must not mix:** no redesign in the same stage; audit first, fix in follow-ups.
- **Done when:** a prioritised defect/polish list with severity exists.

### 26F — Buyer-Facing Demo Package *(docs + light implementation)*
- **Goal:** produce the packaging artefacts in §4 (README for buyer, rebrand guide,
  capability/limitation lists, screenshots, safe demo-admin stance).
- **Scope:** docs + any *small* safe code for a safe demo-admin mode (read-mostly).
- **Must not mix:** no payment/delivery integration; no real PII in demo data.
- **Done when:** a buyer could evaluate AURELIA from the package alone.

### 26G — Commercial Checkout Model v1 *(implementation, narrow)*
- **Goal:** make checkout reflect the chosen commercial model (guest + COD/manual
  + structured-ish methods) **without** integrating a provider/carrier.
- **Scope:** structured method handling building on `src/lib/orders/methods.ts`
  (UAH-aware labels, COD/manual path per the lifecycle's `not_required` payment
  state), copy honesty. Strictly inside existing seams.
- **Must not mix:** no acquirer, no carrier API, no webhook route, no schema
  migration beyond what a separate approved SPEC authorises.
- **Done when:** checkout presents a coherent, honest Ukraine-first model; checks
  pass.

### 26H — Provider / Delivery Research with official sources *(research)*
- **Goal:** fill the comparison table in `PAYMENT_PROVIDER_DECISION.md §6` and the
  delivery equivalent with **current official sources + dates**.
- **Scope:** Ukrainian acquirers (LiqPay/Fondy/WayForPay/bank) + carriers (Нова
  Пошта/Укрпошта); fiscalization (РРО/ПРРО) legal check.
- **Must not mix:** no integration; no secrets; no provider claims without a cited
  official source + date.
- **Done when:** primary + fallback chosen and recorded with sources; legal
  fiscalization position documented (or flagged as still-open).

### 26I — Production Readiness Checklist *(docs / audit)*
- **Goal:** define what must be true before any real deploy.
- **Scope:** security review, secrets handling, env, backups, error handling,
  noindex on admin, rate limits, legal pages — a gate, not a deploy.
- **Must not mix:** no actual deploy; deploy needs explicit owner approval.
- **Done when:** a checklist exists that, when green, authorises a guarded deploy.

---

## 8. Implementation guardrails

These rules apply to every stage after 26C:

- **One stage = one commit.**
- **No schema / payment / delivery implementation without a SPEC or research** that
  authorises it.
- **No provider/carrier claims without current official sources** (URL + date).
- **No deploy without explicit owner approval.**
- **No secrets** committed, printed, generated, or requested; `.env` / `.env.local`
  never touched.
- **No DB reset / drop.**
- **Never touch the dm-bot PostgreSQL on `:5432`.** AURELIA's local DB is the
  isolated instance on `:6700`.
- **No endless docs-only chain** when a safe, valuable implementation block is
  available — prefer shipping value (§3).
- **Preserve the spine guarantees:** server-authoritative money (minor units),
  immutable order-line snapshots, audited admin transitions, allowlisted methods,
  guarded status transitions, `noindex` admin, no PII in analytics/audit.

---

## 9. Open questions

Not resolved by this document; carry into 26D+ and the research stage:

1. **Seller legal form** — sole trader (ФОП) / company / other? (Drives acquirer
   onboarding and fiscalization.) **Requires current official verification.**
2. **Real family project vs third-party sale** — is AURELIA for a specific
   person/brand, or a generic asset to sell? (Changes how much rebrand flexibility
   must be built.)
3. **Demo catalog** — which products/categories populate the sale demo?
4. **Primary UI language** — Ukrainian / Russian / English? (Storefront copy is
   Russian today; a Ukraine-first sale likely needs **uk-UA**.)
5. **Multi-language before sale?** — is i18n required for v1, or a paid future
   option?
6. **Real payments before sale?** — does the buyer need working online payments,
   or is a sale-ready *model* (with COD/manual) enough to sell the site?
7. **Buyer support scope** — what level/duration of support is included in the sale
   vs billed as adaptation?
8. **Fiscalization (РРО/ПРРО) obligation** — required for the intended seller form?
   **Requires current official verification** before any real-money launch.

---

## 10. Final recommendation

**Do A — `26D` Sale-Ready MVP Roadmap — next**, immediately followed by **`26E`
Mobile & Demo Polish Audit**.

**Why this raises the price fastest.** AURELIA's architecture is already strong
(audit 26A, hardening 26B). The cheapest, highest-leverage move on the value ladder
(§5) is **rung 1 → rung 2**: packaging + polish, almost no technical risk. A buyer
decides on a phone, in minutes, from a demo and a clear "what it does / what it
costs to adapt." So the priority is **make it demoable and legible**, not add more
machinery.

**What not to do yet:**

- **No payment/delivery provider integration** — gated on owner legal/entity inputs
  and **current official verification** (26H). Use the **COD / manual** fallback as
  the interim story.
- **No schema migration** (including the `RUB → UAH` default) — record it (§2.1),
  implement it only under an approved SPEC/migration stage.
- **No production deploy** — gated on 26I + explicit approval.

**What can proceed now without owner/provider decisions:**

- 26D (planning), 26E (mobile/demo audit), 26F (packaging + safe demo-admin), and a
  narrow 26G checkout-model pass that stays inside existing seams.

**Short answer:** **A) 26D Sale-Ready MVP Roadmap**, then mobile/demo polish — these
move AURELIA from "good code" to "sellable product" with the least risk and the most
upside.
