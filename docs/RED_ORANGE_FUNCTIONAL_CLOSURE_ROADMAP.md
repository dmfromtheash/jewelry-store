# Red/Orange Functional Closure Roadmap — AURELIA

> **Stage 46A — planning/spec only.** This document adds **no** runtime code, UI,
> CSS, schema, migrations, env, or deploy. It is a sequencing plan for closing the
> remaining **red/orange** functional gaps after the sale/demo package was completed,
> without breaking the **locked, approved design**.
>
> Builds on (does not replace): [`sale/FEATURES_AND_LIMITS.md`](./sale/FEATURES_AND_LIMITS.md),
> [`sale/FINAL_BUYER_HANDOFF.md`](./sale/FINAL_BUYER_HANDOFF.md),
> [`sale/OWNER_DECISION_CHECKLIST.md`](./sale/OWNER_DECISION_CHECKLIST.md),
> [`sale/PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./sale/PAYMENT_DELIVERY_PROVIDER_RESEARCH.md),
> [`SALE_READY_MVP_ROADMAP.md`](./SALE_READY_MVP_ROADMAP.md),
> [`PAYMENTS_SPEC.md`](./PAYMENTS_SPEC.md), [`DELIVERY_SPEC.md`](./DELIVERY_SPEC.md),
> [`backend/ADMIN_SUPERPANEL_ROADMAP.md`](./backend/ADMIN_SUPERPANEL_ROADMAP.md).
>
> **Honesty rule preserved:** no claim of integrated payments, carrier APIs, customer
> accounts, fiscalization, or production deploy beyond what is true today.

---

## 1. Purpose

After the sale/demo package reached handoff-ready state, the owner wants to **close
the remaining red/orange functional gaps** in a controlled order — not all at once.
This roadmap:

1. Lists every current red/orange functional gap.
2. Classifies each as *implementable now*, *owner/legal/provider-gated*, *unsafe yet*,
   or *delayed*.
3. Recommends the exact implementation order.
4. Defines the next 5–8 stages.
5. Picks the single best immediate target.
6. Explains why payment/delivery APIs must stay deferred.
7. Defines guardrails so the **design stays locked**.

This is a **map**, not an implementation. Each named stage is its own future work.

---

## 2. Current baseline (verified against the repo, 2026-06-20)

- **Ukrainian storefront/catalog** ready: home, categories (`bijouterie`/`gifts`),
  product pages, search, favorites, info pages — `app/`, `src/components`.
- **Sale/demo package** ready and handoff-clean (`docs/sale/*`, screenshots).
- **Manual payment/delivery exists** and is the honest live model: `paymentMethod`
  (`cash_on_delivery` / `manual_online`), `deliveryMethod` + free-text note. Server
  re-computes price (client cannot set the amount); money in integer minor units.
- **Admin catalog/orders foundation exists**: catalog CRUD, variants, stock, gallery,
  orders inbox/detail, lifecycle `submitted→processing→completed/cancelled` with
  restock-on-cancel, audit log, dashboard. Admin is **local/internal by design**
  (`ensureLocalAdmin` → 404 under `NODE_ENV=production`; `requireAdminSession`).
- **Customer account NOT ready.** Login/Register exist only as **UI-only modals**
  (`src/components/auth/*`, forms call `e.preventDefault()`); there is **no customer
  `User` model, no session, no API**. Checkout is guest-only.
- **Full CMS / site constructor NOT ready.** `app/admin/settings` is an
  `AdminPlaceholder`. Brand name, contacts, footer, and info-page copy are **static**
  in components / `src/data/info-pages.ts` — not owner-editable at runtime.
- **Payment/delivery APIs NOT ready.** No acquiring, webhooks, "paid" state, carrier
  API, address model, cost calc, or TTN/tracking. (Specs exist as *plans only*.)
- **Production deploy NOT ready.** No hosted shop; deploy is planning-only.
- **Prisma models present:** `Category`, `Product`, `ProductVariant`, `ProductImage`,
  `Order`, `OrderItem`, `AnalyticsEvent`, `AdminAuditLog`. **No** `User`,
  `SiteSetting`, `Page`, or `Payment` model yet.

---

## 3. Red/orange gap matrix

Color: 🔴 red = launch-blocking and not started; 🟠 orange = partial / manual MVP /
needs hardening; 🟢 = effectively done (listed only where relevant for context).

| Area | Current status | Color | Owner-gated? | Implementation risk | Recommended action |
|---|---|---|---|---|---|
| Payment acquiring | Manual only; no provider, webhook, or "paid" state | 🔴 | **Yes** (provider + ФОП + bank + sandbox) | High (secrets, signatures, money) | SPEC only, after owner checklist — see §5, §10 |
| Delivery / carrier API | Manual method + note; no API/address/TTN/tracking | 🔴 | **Yes** (carrier business account + key) | High (keys, address model) | SPEC only, after owner checklist |
| Customer auth | UI-only modals; no `User` model/session/API | 🟠 | No | Medium (security-sensitive but self-contained) | Implementable now — SPEC then build |
| Customer account / cabinet | None; guest checkout only | 🟠 | No | Medium (depends on auth + order linking) | Implementable after auth; reuse existing `Order` data |
| Admin CMS / site settings | `/settings` placeholder; brand/contacts/copy static | 🟠 | No (content only) | Low–Medium (must not become a page builder) | **Implementable now — best first target (§7)** |
| Admin content editing (info pages / public copy) | Static `src/data/info-pages.ts`; not editable | 🟠 | No | Low–Medium (sanitization required) | Implementable now — fold into CMS foundation |
| Fuller admin editing capabilities | Catalog/orders solid; settings/content thin | 🟠 | No | Low | Implementable now via CMS + targeted admin gaps |
| Production demo / deploy | Planning-only; admin 404s in prod by design | 🟠 | **Partly** (owner approval + domain) | Medium (env, hosting, secrets) | Delay until after account/CMS; SPEC exists |
| Legal / fiscalization (РРО/ПРРО, offer, privacy) | Documented as owner/lawyer decision | 🔴 | **Yes** (lawyer/accountant) | N/A (not our code to decide) | Document + provide editable copy slots only |
| Product imagery | Honest placeholders; slots exist | 🟠 | **Yes** (owner-supplied/licensed photos) | Low (upload path exists) | Keep placeholders; owner provides assets |
| Notifications (email/SMS) | None | 🟠 | Partly (provider/keys) | Medium | Delay; pairs with payment/account maturity |
| Automated browser E2E | None; server logic covered by `db:verify:*` | 🟠 | No | Low | Optional smoke harness, low priority |

---

## 4. What can be implemented now (no owner credentials / no provider keys)

These need **no** merchant account, provider key, legal sign-off, or deploy:

- **Admin CMS / site-settings foundation** — make a small, safe set of **content**
  values owner-editable (brand display name, public contacts, social links, public
  payment/delivery copy, info-page text), persisted in a new `SiteSetting` model,
  read by existing components. **Content only — never layout/CSS/design.**
- **Admin editing of public info pages / contact / settings copy** — migrate
  `src/data/info-pages.ts` content into editable records (same render, editable text).
- **Customer auth foundation** — real `User` model, registration/login, hashed
  passwords, session; wire the **existing** login/register modals to a backend
  (UI unchanged, behavior added).
- **Customer account / order history** — read **existing** `Order` rows for the
  signed-in customer (by email/owner link); order detail for the authenticated owner.
  No new payment data required.
- **Better manual delivery/payment details (UX hardening)** — clearer copy, validation
  hints, structured-but-still-manual fields — **within the locked layout**.
- **E2E smoke harness** (optional) — automate the storefront→checkout→confirmation
  happy path to protect against regressions. Pure test tooling.

None of the above changes design, CSS, cards, gallery visuals, or composition.

---

## 5. What is blocked (owner / legal / provider-gated)

Do **not** implement until the owner resolves
[`sale/OWNER_DECISION_CHECKLIST.md`](./sale/OWNER_DECISION_CHECKLIST.md):

- **LiqPay / WayForPay real integration** — needs ФОП/ТОВ, UAH account, merchant
  approval, sandbox, webhook domain, security review.
- **Nova Poshta / Ukrposhta API** — needs carrier business account + free API key,
  address/cost/TTN model decisions.
- **Fiscalization (РРО/ПРРО)** — accountant/lawyer decision; precedes taking real money.
- **Production launch / deploy** — owner approval + domain + hosting + secrets.
- **Real product imagery** — owner-supplied or licensed photos only (no AI/stock).
- **Legal / privacy / public-offer (оферта) / returns texts** — owner-provided content
  (we provide *editable slots*, not the legal wording).

---

## 6. Recommended implementation sequence

Ranked. Each entry is a future stage; SPEC precedes implementation for anything
security-sensitive or schema-touching.

1. **46B — Admin CMS / Site Settings SPEC** *(implementable-now, docs)* ← next.
2. **46C — Admin CMS / Site Settings foundation** *(implementation; `SiteSetting`
   model + admin form + read path; content-only)*.
3. **47A — Customer Auth + Account SPEC** *(implementable-now, docs; `User` model,
   sessions, order linking, security posture)*.
4. **47B — Customer Account implementation** *(auth backend wired to existing modals;
   account page; order history from existing `Order` data)*.
5. **48A — Manual delivery/payment UX hardening** *(copy/validation within locked
   layout; keep COD + manual selectable)*.
6. **48B — E2E smoke harness** *(optional; storefront→checkout happy path)*.
7. **49A — Payment Integration SPEC** *(only after the owner checklist is filled and
   one provider chosen — LiqPay **or** WayForPay; sandbox-first)*.
8. **49B — Delivery Integration SPEC** *(only after checklist; Nova Poshta first;
   sandbox-first)*.
9. **50A — Persistent demo / deploy environment SPEC** *(if/when a hosted demo is
   wanted; behind the existing deploy-readiness audit + owner approval)*.

Manual + COD remain the live order path throughout, so onboarding/legal delays never
block taking orders.

---

## 7. Immediate next target

**Target: Admin CMS / Site Settings foundation — starting with stage 46B (SPEC).**

Justification:

- **Improves the "constructor" capability** the owner explicitly asked for, in the
  safest possible slice (content/settings, not a freeform page builder).
- **High buyer value** — turns hardcoded brand/contacts/copy into owner-editable
  fields, which is the most visible "I can run this myself" gain.
- **Not owner-gated** — needs no provider key, merchant account, or legal sign-off.
- **No payment/provider dependency** — fully self-contained.
- **Preserves the locked design** — it edits *content and visible copy only*; layout,
  CSS, cards, gallery visuals, spacing, typography, and colors are out of scope.
- It is the **prerequisite surface** for later admin content work (legal/offer/privacy
  copy slots) without committing to any legal wording.

Customer auth/account (47A/47B) is the strong **second** target: also not owner-gated,
but it is more security-sensitive and benefits from landing after the settings/admin
persistence pattern is established.

---

## 8. Admin CMS / Site Settings scope proposal (for 46B)

**Editable first (content/settings only):**

- Brand display name (currently hardcoded `AURELIA` in Header/Footer).
- Public contacts: email, phone, address/city, working hours.
- Social links (Instagram / Telegram / etc.).
- Header/footer **text labels** (only where stored safely as data, not structure).
- Info-page **text content** (migrate `src/data/info-pages.ts` to editable records;
  same components render it).
- Public **payment/delivery copy** (checkout + info pages) — the honest manual-model
  wording.
- Homepage **text blocks** (only low-risk copy, e.g. SEO text / promo captions — not
  layout).
- **Feature flags** for visible customer copy (e.g. show/hide a notice banner).

**Explicitly NOT editable (guardrails):**

- ❌ Layout / CSS / design tokens / spacing / typography / colors / hover states.
- ❌ Cards, gallery visuals, image composition, or screenshots.
- ❌ Arbitrary page builder / drag-drop / freeform block tree.
- ❌ Raw HTML without strict sanitization (prefer plain text / constrained markdown).
- ❌ Auth, secrets, env, schema-of-secrets, or provider keys.
- ❌ Price logic, money, or order-state fields (those stay server-authoritative).

**Shape:** a `SiteSetting` (key/value, typed, validated) model + a few structured
content records; an admin form under the existing `/admin/settings`; a read helper
consumed by existing components. Audit each change via the existing `AdminAuditLog`.

> **Full spec:** [`admin/ADMIN_CMS_SITE_SETTINGS_SPEC.md`](./admin/ADMIN_CMS_SITE_SETTINGS_SPEC.md)
> (stage 46B) details the data model, admin UI, validation, storefront fallback, and
> the 46C–46G implementation stages.
>
> **Status:** 46C done — `SiteSetting` model + `/admin/settings` editor for the 11 v1
> keys shipped (admin-side only; storefront integration is 46D). 46D done — storefront
> Header/Footer read site settings (brand, tagline, blurb, copyright, public phone)
> with static fallback; design unchanged.

---

## 9. Customer Account scope proposal (for 47A/47B)

Define later (not in 46-series):

- Customer **registration / login** — wire the existing `LoginModal` / `RegisterModal`
  (currently `e.preventDefault()`) to a real backend; **UI unchanged**.
- New `User` model (hashed passwords, email identity); secure session; rate-limit and
  validation in SPEC.
- Customer **profile** (name, contacts, saved delivery note) — no payment data.
- **Order history** — list the customer's existing `Order` rows.
- **Order detail by authenticated owner** — reuse the existing order snapshot data,
  authorization scoped to the owner.
- **Guest checkout remains** the default; account is additive.
- **Guest-to-account linking** strategy (match by email at registration/login;
  define merge rules in SPEC).
- **No payment history** surfaced until real acquiring + a `Payment` model exist
  (avoid implying paid/settled states that don't exist).

---

## 10. Payment / delivery path

- **Keep the manual payment + COD + manual delivery model now** — honest, working,
  needs no merchant onboarding; stays the live path while anything else is built.
- **Do not implement real provider APIs before owner decisions.** Both viable Ukraine
  options (LiqPay, WayForPay) onboard a business, settle in UAH, and use a hosted page;
  the choice is an **owner business decision**, and the checklist gates it.
- **Why delay is correct, not laziness:**
  - Real acquiring/carrier work needs **secrets** (keys, signatures) that must live
    outside the repo and outside chat — premature work risks leaking or faking them.
  - A real "paid" state without a verified webhook + amount/currency check would be a
    **dishonest claim** and a financial-correctness risk.
  - Carrier APIs need a **business account + key** the owner does not have yet; the
    address/cost/TTN model depends on owner policy (who pays shipping, COD fees).
  - Building these before the owner is merchant-ready produces throwaway or unsafe code.
- **Prepare architecture/spec later** (49A/49B), sandbox-first, **only after** the
  owner checklist is green, and **with a security review before any code** (signature
  verification, amount/currency verification, idempotency).
- Manual + COD stay **selectable as fallback** even after a provider is added.

---

## 11. Readiness targets (estimated movement)

Honest, directional — not guarantees. Baseline today (from handoff audit): buyer/demo
~90%, technical MVP ~80–85%, real launch ~25–30%, payment/delivery APIs ~10–15%.

| After phase | Buyer/demo | Technical MVP | Real launch | Notes |
|---|---|---|---|---|
| **Admin CMS foundation (46B/46C)** | ~92–94% | ~85% | ~30% | Owner can edit brand/contacts/copy; big "self-serve" uplift, design untouched |
| **Customer account (47A/47B)** | ~94% | ~88% | ~35% | Account + order history closes a named gap; still guest-first |
| **Manual UX hardening + E2E (48A/48B)** | ~95% | ~90% | ~37% | Sturdier flow + regression safety |
| **Payment + delivery APIs (49A/49B → impl)** | — | ~90%+ | **~60–75%** | The big launch jump; **owner/legal/provider-gated** |
| **Production demo deploy (50A)** | live demo | — | +deploy | Behind readiness checklist + owner approval |
| **Real imagery (owner-supplied)** | +~5% visible | — | — | Biggest *visible* polish; owner provides licensed photos |

The gap to real launch stays dominated by **owner/legal/provider** items, not core
engineering — closing CMS + account raises buyer value while those remain pending.

---

## 12. Recommended next stage prompt summary

- **Next stage: 46B — Admin CMS / Site Settings SPEC.**
- **Docs/spec first, then implementation (46C).** Define the `SiteSetting` model,
  the exact editable content set (§8), validation/sanitization, the admin form under
  the existing `/admin/settings`, the read path for existing components, and the
  guardrails that keep layout/CSS/design locked.
- **No `/clear` needed** unless context is dirty after this stage.
- Keep manual + COD live; keep payment/delivery APIs deferred behind the owner
  checklist; keep the approved design locked.
