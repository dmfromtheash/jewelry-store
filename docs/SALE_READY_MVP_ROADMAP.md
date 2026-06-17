# AURELIA — Sale-Ready MVP Roadmap (Этап 26D)

> **Status: practical roadmap / sale-value planning only.** No runtime code, Prisma
> schema, migrations, routes, configuration, or secrets are introduced or changed
> by this file. It turns the **direction** set in
> [`OWNER_DECISIONS_AND_MARKET_POSITIONING.md`](./OWNER_DECISIONS_AND_MARKET_POSITIONING.md)
> (26C) into a concrete, sequenced plan for making AURELIA **demoable and
> sellable**.
>
> This is **not** a multi-year abstract roadmap, **not** payment/delivery
> implementation, **not** a deploy, **not** the `RUB → UAH` migration, and **not**
> legal/tax advice. It is the short, practical "what raises sale value next" map.
>
> Verified against the repository at HEAD `c13a279` (Owner Decisions & Market
> Positioning).

---

## 1. Purpose

AURELIA is already a **strong dev project**: server-authoritative orders, a
hardened order spine (26B), an audited admin, a DB-backed storefront. But "strong
code" is not the same as "a product a non-technical buyer can look at and want."

This roadmap exists to:

- **Raise sale value** — move AURELIA from *good architecture* to *a demo a
  potential buyer can browse on their phone and picture as their own store*.
- **Sequence the cheap, high-leverage work first** — visual/content/admin polish
  and a buyer package, since those lift perceived value with little risk.
- **Keep blocked work blocked** — payments, carriers, the `RUB → UAH` migration,
  and deploy stay gated on owner/legal/provider decisions (per 26C §2.1, §8).

It is a roadmap for a **demo / sale package**, *not* a production launch at any
cost. "Sale-ready" means *showable and adaptable*, not *live and taking money*.

---

## 2. Current asset state

Honest assessment, verified against the repo at `c13a279`. Buckets: **✅ already
strong · 🟡 needs polish · 🔴 blocks a sale-ready demo**.

### ✅ Already strong (sellable foundation)
- **DB-backed storefront** — home, two categories (`bijouterie`, `gifts`),
  `product/[slug]` (SSG via `generateStaticParams`), plus info pages. Builds clean:
  38 routes, typecheck + build pass.
- **Order spine** — server-authoritative pricing (client sends only slug + qty),
  immutable `OrderItem` snapshots, money in minor units, a status **transition
  guard** (`ALLOWED_ORDER_TRANSITIONS`) and method **allowlists**
  (`src/lib/orders/methods.ts`) from 26B.
- **Admin back-office** — local-guarded auth + audit, orders list/detail, catalog
  CRUD, Dashboard KPI v1, `noindex` on admin. Unusually mature for the stage.
- **Responsive foundation** — ~75 `@media` rules across 15 stylesheets; mobile was
  considered, not ignored.
- **No secrets in repo** — `.env`/`.env.local` uncommitted; clean one-stage-one-
  commit history.

### 🟡 Needs polish (present but hurts the sale impression)
- **Checkout copy reads "unfinished"** — `CheckoutPageClient.tsx` shows delivery
  options as `Самовывоз — скоро / Курьер — скоро / Почта — скоро`, an "Оплата будет
  подключена позже" note, and a "Демо-режим: заказ сохраняется, оплата подключается
  позже" banner. This is **honest** (good) but currently reads as *broken/WIP*
  rather than *intentional model* — it needs reframing, not removal.
- **Language/currency mismatch with the vector** — storefront copy is **Russian**
  and currency defaults to **`RUB`**, while 26C set a **Ukraine-first / UAH**
  direction. Acceptable for an internal demo, but a sale to a Ukrainian brand needs
  at least UAH presentation (the migration itself is gated — §5.G).
- **Mobile quality unverified** — media queries exist, but no audit confirms the
  storefront actually *looks finished* on a phone (the first thing a buyer judges).
- **Demo catalog is dev-seed, not a showcase** — 10 products with realistic
  names/prices exist, but the content was authored as a seed, not curated as a
  brand vitrine.

### 🔴 Blocks a sale-ready demo (must fix before showing a buyer)
- **No product imagery at all** — `prisma/seed.ts` creates **one placeholder image
  slot per product with `url=null`**, and `public/` contains only `.gitkeep`. The
  storefront structurally has image slots but **zero real photos**. This is the
  **single biggest visual blocker** — a jewelry store with no product images cannot
  be shown to a buyer.
- **No buyer-facing package** — no README for a buyer, no rebrand/adaptation guide,
  no feature/limitations list, no screenshots. A buyer has nothing to evaluate.
- **No demo URL** — nothing hosted to click (deploy gated — §5.I).

---

## 3. Sale-ready definition

AURELIA is a **sale-ready MVP** when **all** of the following are true. This is the
acceptance bar for the demo/sale package — *not* a production-launch bar.

- [ ] **Mobile-first storefront looks finished** on phone / tablet / desktop.
- [ ] **Demo catalog is a curated vitrine** — coherent products, realistic
      names/descriptions/prices, **and real (or convincing placeholder) imagery**.
- [ ] **Checkout creates an order** end-to-end (already true; spine verified).
- [ ] **Delivery & payment options read honestly and intentionally** — no
      misleading "real payments" claims; the COD/manual + "online later" model is
      presented as a *choice*, not a *bug*.
- [ ] **Admin shows orders and basic analytics** clearly enough for a shop owner to
      understand state (incl. honest "unpaid / not connected").
- [ ] **Buyer demo package exists** — README, feature list, limitations, adaptation
      checklist.
- [ ] **"How to adapt to your brand" README** exists.
- [ ] **No fake claims** about real payments/delivery anywhere in UI or docs.
- [ ] **No secrets** in the repo.
- [ ] **Build / typecheck / db verifies pass.**

---

## 4. Buyer-facing demo requirements

What must exist to actually show AURELIA to a potential buyer (some "later", noted):

- **Demo URL** — hosted, browsable storefront *(later; deploy gated — §5.I)*.
- **Demo brand story** — a short, believable brand narrative for the demo identity.
- **Demo catalog** — curated categories + products.
- **Realistic demo products** — believable names, descriptions, prices, **and
  imagery** (real or high-quality placeholders).
- **Screenshots** — storefront + admin, **mobile and desktop**.
- **Admin demo access** — time-boxed demo credentials **or** a safe read-mostly
  demo-admin mode *(later; no real PII, no destructive ops)*.
- **Buyer README** — plain-language "what this is / what it does / what it costs to
  adapt".
- **Feature list** — honest "works today".
- **Limitations list** — honest "foundation/stub" (payments not connected, delivery
  is a label, no customer account, no notifications).
- **Adaptation checklist** — swap brand/logo/colours, replace products/categories,
  change contacts.
- **Support / package options** — the upsell menu (setup, integration, i18n, etc.).

---

## 5. Priority roadmap

Each block: **goal · type · why it raises sale value · scope · must-not-mix ·
done-criteria · risk**. One stage = one commit.

### A. Mobile & Visual Polish Audit *(→ 26E)*
- **Type:** audit (read-only).
- **Why it sells:** first impression is mostly on a phone; visual confidence drives
  perceived value more than any backend feature.
- **Scope:** walk storefront (home/category/PDP/cart/checkout) and admin on
  mobile/tablet/desktop; list what looks unfinished — spacing, tap targets,
  overflow, empty states, image gaps, typography.
- **Must not mix:** no fixes in this stage; audit only. No payment/delivery/schema.
- **Done when:** a prioritised defect list with severity exists.
- **Risk:** low.

### B. Demo Catalog & Content Polish
- **Type:** implementation (content/data) — **no schema change**.
- **Why it sells:** a curated catalog *with imagery* is the difference between "dev
  seed" and "a store". Directly addresses the §2 🔴 image blocker.
- **Scope:** curate products/categories/descriptions/prices; add **real or
  high-quality placeholder images** into the existing `ProductImage` slots /
  `public/`; ensure coherent, brand-plausible content.
- **Must not mix:** no schema/enum change; no payment/delivery; no checkout rewrite.
  Image sourcing must respect licensing (no scraped/unlicensed photos).
- **Done when:** every demo product renders with an image and believable copy;
  `db:verify` still passes.
- **Risk:** low–medium (asset licensing; keep placeholders if no licensed photos).

### C. Buyer-Facing Demo Package *(→ 26F)*
- **Type:** docs + light implementation.
- **Why it sells:** gives a buyer something to evaluate; converts "code" into
  "product".
- **Scope:** buyer README, feature list, limitations list, adaptation guide,
  screenshots checklist; design (not yet build) a safe demo-admin stance.
- **Must not mix:** no payment/delivery integration; no real PII in any demo data.
- **Done when:** a buyer could assess AURELIA from the package alone.
- **Risk:** low.

### D. Commercial Checkout Clarity v1 *(→ 26G)*
- **Type:** implementation (narrow, inside existing seams).
- **Why it sells:** removes the "is this broken?" feeling at the most decision-
  critical screen; presents the Ukraine-first model honestly.
- **Scope:** reframe delivery/payment **wording** (UAH direction; pickup / Нова
  Пошта / Укрпошта / courier as the *model*; COD/manual as an honest *option*, not
  "— скоро"); keep the existing `src/lib/orders/methods.ts` allowlist as the source
  of truth; no fake online-payment UI.
- **Must not mix:** no acquirer, no carrier API, no webhook route, no schema
  migration, no checkout-flow rewrite (copy/labels only).
- **Done when:** checkout reads as an intentional Ukraine-first model; checks pass.
- **Risk:** low–medium (must stay copy-level; easy to over-reach into flow).

### E. Admin Sale Polish
- **Type:** implementation (narrow).
- **Why it sells:** a shop-owner buyer must believe *they* could run orders from the
  admin; confusing copy undermines that.
- **Scope:** clarify order/status/dashboard copy; present "unpaid / not connected"
  **honestly and calmly**; remove dev-only/confusing language. No new admin
  features.
- **Must not mix:** no RBAC/multi-admin, no payment/refund controls, no schema.
- **Done when:** a non-technical owner can read the orders + dashboard without
  confusion; checks pass.
- **Risk:** low.

### F. Mobile-First Implementation Polish
- **Type:** implementation (UI/CSS).
- **Why it sells:** executes the §A audit findings — turns "responsive-ish" into
  "looks finished on a phone".
- **Scope:** concrete CSS/layout fixes from the audit; storefront first, admin
  second.
- **Must not mix:** not in the same stage as the audit; no payment/delivery/schema;
  no redesign-from-scratch.
- **Done when:** audit defects closed; visual parity across breakpoints; checks
  pass.
- **Risk:** medium (CSS regressions — change incrementally, re-verify build).

### G. UAH Currency Migration **SPEC** *(plan only)*
- **Type:** docs (SPEC) — **no migration**.
- **Why it sells:** UAH presentation is needed for a Ukrainian buyer; the SPEC
  de-risks the eventual change without doing it prematurely.
- **Scope:** plan the `RUB → UAH` move — schema default, existing-row strategy,
  minor-unit handling, UI/label/formatting, seed/demo data, verify scripts. Cite
  26C §2.1 as the trigger.
- **Must not mix:** **no schema change, no migration, no code** in this stage; no
  provider/legal claims.
- **Done when:** a reviewed migration plan exists that a later impl stage can
  execute.
- **Risk:** low (docs); the *implementation* it describes is medium and separate.

### H. Provider / Carrier Research with official sources *(→ 26H, not in 26D)*
- **Type:** research.
- **Why it sells:** unblocks the eventual revenue story, but only after owner/legal
  inputs (26C §9).
- **Scope:** fill `PAYMENT_PROVIDER_DECISION.md §6` + delivery equivalents with
  **current official sources + dates**; Ukrainian acquirers + Нова Пошта/Укрпошта;
  fiscalization (РРО/ПРРО) legal check.
- **Must not mix:** no integration; no secrets; no claims without a cited official
  source + date.
- **Done when:** primary + fallback recorded with sources; fiscalization position
  documented or flagged open.
- **Risk:** low (research) — but **blocked** on owner decisions; do **not** start in
  26D.

### I. Demo Deployment Readiness
- **Type:** docs / audit (checklist, **no deploy**).
- **Why it sells:** a live demo URL is the strongest sale asset, but only behind a
  safety gate.
- **Scope:** production/security checklist — secrets handling, env, `noindex` admin,
  rate limits, error handling, backups, legal pages.
- **Must not mix:** **no actual deploy** — deploy needs explicit owner approval.
- **Done when:** a green checklist that *authorises* (not performs) a guarded
  deploy.
- **Risk:** low (docs); deploy itself is out of scope.

---

## 6. Highest-ROI sequence

The fastest path to a higher sale value, given that payments/carriers/legal are
**blocked** and schema changes need a SPEC. Lead with the cheapest, highest-
perceived-value work:

1. **A — Mobile & Visual Polish Audit (26E).** Cheap, read-only, and tells us
   exactly what makes the demo look unfinished. First impressions dominate value.
2. **B — Demo Catalog & Content Polish (esp. imagery).** Closes the **#1 visual
   blocker** (no product photos). A jewelry demo with images instantly reads as a
   real store.
3. **C — Buyer-Facing Demo Package (26F).** Converts "code" into something a buyer
   can actually evaluate (README, features, limitations, adaptation guide).
4. **D — Commercial Checkout Clarity v1 (26G).** Removes the "is it broken?" feeling
   at the decision screen; presents the Ukraine-first model honestly.
5. **E — Admin Sale Polish.** Lets a shop-owner buyer believe they could run it.

**Deliberately deferred:** F (mobile *fixes*) follows the A audit; G (UAH SPEC) when
UAH presentation becomes the bottleneck; H/I stay gated on owner/legal/approval.

> *Why this order:* B (imagery) is arguably tied with A for impact, but A is read-
> only and scopes B and F correctly — auditing before fixing avoids rework. The
> sequence front-loads **visual + content + package**, which is where perceived
> value currently leaks, and keeps every blocked/risky item out of the near term.

---

## 7. What NOT to do next

Dangerous or low-ROI moves to avoid right now:

- ❌ **Real payment integration** — blocked on owner country/entity/currency +
  provider research with official sources (26C §9, `PAYMENT_PROVIDER_DECISION`).
- ❌ **Carrier / delivery API integration** — same gating; v1 stays
  pickup/Нова Пошта/Укрпошта as *wording*, not integration.
- ❌ **`RUB → UAH` migration without a SPEC** — plan (§5.G) before touching schema.
- ❌ **Production deploy** — needs explicit owner approval + the §5.I checklist.
- ❌ **Another broad docs-only SPEC chain** — the lifecycle/payments/delivery specs
  already exist; prefer small sale-value implementation blocks (26C §3).
- ❌ **Customer account** — needs an auth/backend strategy first; not a sale blocker.
- ❌ **Over-building analytics** — the capture foundation exists; more analytics
  before the sale package does not raise buyer value.

---

## 8. Sale package structure

The future package a buyer receives (designed in §5.C; **not built here**):

- **What the buyer gets:** the repo, a browsable demo, and the docs to adapt it.
- **Included:** storefront + admin source, demo catalog/content, buyer README,
  feature list, limitations list, adaptation guide, basic deployment notes.
- **Not included (clearly stated):** live payment processing, live carrier
  integration, fiscalization, hosting/domain, ongoing maintenance — unless bought as
  an add-on.
- **Optional paid add-ons:** brand adaptation, product load, payment wiring (after
  provider decision), delivery integration, multi-language (uk-UA), customer
  accounts, notifications, deploy + handoff.
- **Handoff checklist:** repo access, env template (no secrets), DB setup notes,
  admin access, demo data reset instructions.
- **Setup checklist:** rebrand → catalog → contacts → (optional) provider/carrier →
  deploy.
- **Support window:** a short, defined post-sale support period (scope per owner).
- **Repo cleanup checklist:** no secrets, coherent history, demo data sane, docs
  current, dead/dev-only artefacts removed.

---

## 9. Price / value assumptions

An honest internal value ladder. **No precise market price is asserted as fact** —
there is no live market research here. These are **internal planning assumptions
that require market validation** before being quoted.

| Rung | What it is | Honest value driver | Reachable |
|---|---|---|---|
| **Current demo asset** | Code + (soon) a browsable demo. | Saves a buyer building storefront + admin from scratch. | Now, after imagery + package. |
| **Sale-ready MVP** | Demo + curated catalog + buyer package + polish. | Buyer can picture it as *their* store. | Target of A–E (this roadmap). |
| **Custom adaptation package** | Done-for-you rebrand/setup + short support. | A *running* branded store without the work. | Service on top of the MVP. |
| **Revenue-generating business** | Live store taking real money (payments + delivery + fiscalization, legal). | Highest value, most blocked. | Gated on owner/legal/provider (not near-term). |

> *Planning note:* the **current asset → sale-ready MVP** jump is the cheapest and
> highest-leverage (polish + package, low risk). Any figures attached to these rungs
> **require market validation** and are out of scope.

---

## 10. Metrics for readiness (scorecard)

Score each from 🔴 (blocks sale) / 🟡 (needs work) / ✅ (ready). Snapshot at
`c13a279`:

| # | Dimension | Now | Target |
|---|---|---|---|
| 1 | **Storefront visual readiness** | 🟡 | ✅ |
| 2 | **Mobile readiness** | 🟡 (unverified) | ✅ |
| 3 | **Checkout clarity** | 🟡 ("— скоро / демо" reads WIP) | ✅ honest model |
| 4 | **Admin usability** | 🟡 | ✅ |
| 5 | **Demo content (incl. imagery)** | 🔴 (no product images) | ✅ |
| 6 | **Docs / buyer package** | 🔴 (none) | ✅ |
| 7 | **Deployment readiness** | 🔴 (no demo URL; gated) | 🟡 checklist green |
| 8 | **Security readiness** | ✅ (no secrets, noindex, guarded) | ✅ |
| 9 | **Commercial honesty** | ✅ (no fake claims) | ✅ keep |
| 10 | **Buyer handoff readiness** | 🔴 (no package/checklist) | ✅ |

**Sale-ready = all dimensions 🟡→✅ except deploy (🟡 checklist-green is acceptable
for an internal demo; live deploy stays owner-approved).**

---

## 11. Recommended next stage

**Do A — `26E` Mobile & Demo Polish Audit — next.**

**Why (confirms the owner's hypothesis):** AURELIA's sale value currently leaks at
**first impression**, and payment/delivery/legal are still **blocked** (26C §9).
A buyer judges the demo on a phone in minutes; the audit is **cheap, read-only, and
risk-free**, and it produces the prioritised defect list that correctly scopes the
two highest-impact follow-ups — **B (demo imagery/content)** and **F (mobile
fixes)**. Auditing *before* fixing prevents rework and keeps each stage to one
coherent commit.

The other options are right but not *first*:
- **B (26F Buyer Package)** is essential and close behind, but lands better once the
  audit has defined what the screenshots/feature-list must showcase.
- **C (26G Checkout Clarity)** is valuable polish but narrower than the whole-store
  first impression.
- **D (UAH SPEC)** matters for a Ukrainian buyer but is not what makes the demo
  *look* finished — sequence it once presentation is the bottleneck.

**Short answer:** **A) 26E Mobile & Demo Polish Audit**, then demo imagery/content,
then the buyer package.

---

## 12. Guardrails

- **One stage = one commit.**
- **No endless docs-only chain** — after this roadmap, prefer small sale-value
  *implementation* blocks (audit → fixes → package).
- **No provider/carrier/legal claims without current official sources** (URL + date).
- **No deploy without explicit owner approval.**
- **No secrets** committed, printed, generated, or requested; `.env`/`.env.local`
  never touched.
- **No DB reset / drop.**
- **Never touch the dm-bot PostgreSQL on `:5432`** — AURELIA's local DB is the
  isolated instance on `:6700`.
- **No schema / payment / delivery / checkout-flow implementation** without an
  authorising SPEC or research; this stage and 26E are docs/audit only.
- **Preserve the spine guarantees** — server-authoritative money, immutable order
  snapshots, audited admin transitions, allowlisted methods, guarded status
  transitions, `noindex` admin, no PII in analytics/audit.
