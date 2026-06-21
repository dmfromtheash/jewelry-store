# Final Buyer Handoff — AURELIA

> The top-level "how to present and hand off AURELIA" document. It **summarizes and
> links** the rest of the package — start here, then open the linked docs as needed.
> Package index: [`README.md`](./README.md).
> **Honest by design:** no claims of live payments, carrier APIs, deployment, or real
> product photos beyond what is true today.

## 1. What AURELIA is

A **Ukraine-first, sale-ready demo MVP** online store for a small Ukrainian
**jewelry / accessories / gifts** brand: a Ukrainian storefront + admin + end-to-end
order flow, currency **₴ (UAH)**, on a real stack (Next.js 15 / React 19 / TypeScript
/ Prisma / PostgreSQL). It is **showable and adaptable**, **not** a live shop taking
money. For a small brand that today takes orders by DM, it's a real structured store
instead of a chat thread.

## 2. Current readiness (honest ranges, from the 40A audit)

| Dimension | Readiness |
|---|---|
| Buyer / demo package | **~90%** |
| Technical MVP | **~80–85%** |
| Ukrainian localization | **~95%** |
| Real launch | **~25–30%** |
| Payment / delivery APIs | **~10–15%** |

**Demoable now; not launch-ready.** The gap to launch is owner/legal/provider
decisions + imagery — not core engineering.

## 3. What is ready to show

- **Ukrainian storefront** (home, categories `bijouterie`/`gifts`, product pages,
  search, favorites, info pages).
- **Ukrainian catalog** (product names, categories, descriptions, specs, variant
  values).
- **Product variants** (real selector; price/stock aware).
- **Cart** (guest, variant-aware lines).
- **Checkout** (guest; server-authoritative pricing; manual payment + delivery).
- **Manual payment/delivery model** (оплата при отриманні / за реквізитами;
  Самовивіз / Нова Пошта / Укрпошта / курʼєр).
- **Order confirmation** (inline, with `AUR-…` code).
- **Admin** (catalog CRUD, gallery/variants/stock, orders inbox/detail, lifecycle
  `submitted→processing→completed/cancelled` with restock-on-cancel, audit log,
  dashboard) — **Russian/internal by design**.
- **Customer accounts** (registration/login/logout, scrypt hashing, a separate customer
  session cookie, profile editing, password change with stale-session invalidation,
  order history + own order detail) — **guest checkout preserved**.
- **Auth security & readiness tooling** — **durable DB-backed auth rate limiting**
  (49A → 51A; survives restart) and a **customer-auth audit log** (49A); plus local,
  read-only readiness checks (`demo:preflight`, `demo:rehearsal`, `smoke:routes`,
  `smoke:admin`, `demo:sale-docs-check`). The honest readiness answer + **sale claims
  matrix** is [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md).
- **Sale docs + screenshots + runbook** — [`README.md`](./README.md),
  [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md),
  [`DEMO_SCREENSHOT_CHECKLIST.md`](./DEMO_SCREENSHOT_CHECKLIST.md).

## 4. What to show in a live demo (10–15 min)

1. **Homepage** — Ukrainian storefront from the DB.
2. **Category** (Біжутерія / Подарунки).
3. **Product with a variant** (`/product/serogi-kaplya`) — switch coating, price updates.
4. **Cart** — variant-aware line in the drawer.
5. **Checkout** — safe demo data; Нова Пошта + a manual payment option.
6. **Confirmation** — order code, honest manual-payment note.
7. **Admin** (local dev) — dashboard + order detail + catalog/variants/stock.
8. **Sale docs / readiness package** — features/limits, provider research, owner checklist.

Full narrated flow: [`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md); operational
runbook: [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md).

## 5. What is intentionally not finished

- **Real payment provider** (no acquiring/webhooks/"paid" state) — manual only.
- **Carrier API / TTN / tracking** — delivery is a chosen method + note.
- **Production deploy** — no live hosted shop.
- **Real product photos** — placeholders only (see §6).
- **Fiscalization (РРО/ПРРО) / legal texts** — owner + lawyer/accountant.
- **Notifications (email/SMS)** and **customer-account email features** (password reset,
  email verification) — accounts/login/profile/history exist; these are deferred.
- **Admin Ukrainian localization** — admin stays Russian/internal by design.

Detail: [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).

## 6. Product imagery decision for now

- **Current placeholders remain — intentionally.** The card/gallery design is
  approved and the image slots exist, but no real photos are shipped.
- **No demo / AI / stock product images are added yet** — this avoids fake product
  claims and licensing risk.
- **Real buyer/owner photos are the preferred path** for launch imagery.
- The gap, options, and staged plan are in
  [`PRODUCT_IMAGERY_GAP_PLAN.md`](./PRODUCT_IMAGERY_GAP_PLAN.md). It is the **biggest
  visible** sale-polish gap (≈ +5% demo uplift when closed safely).

## 7. What the buyer/owner must provide

- [ ] Brand: name, logo, tone/texts.
- [ ] **Real product photos** (licensed/owned).
- [ ] Real products / SKUs / stock / prices.
- [ ] **ФОП / ТОВ** (legal entity) status.
- [ ] **UAH settlement account** (bank).
- [ ] **Payment provider** decision (LiqPay or WayForPay).
- [ ] **Carrier** decision (Nova Poshta first; Ukrposhta second).
- [ ] **Legal / fiscal / accounting** decisions (РРО/ПРРО, offer, returns, privacy).
- [ ] **Domain / hosting / deploy** decision.

Full intake: [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md);
adaptation steps: [`SETUP_AND_HANDOFF_CHECKLIST.md`](./SETUP_AND_HANDOFF_CHECKLIST.md).

## 8. Suggested sale positioning

- Sell as a **ready technical foundation + adaptation package** — *not* an
  already-launched, money-taking business.
- **Strongest value:** DB-backed storefront + variant cart + server-authoritative
  checkout + audited admin + **full Ukrainian localization** + an honest buyer
  package. This is the expensive-to-build part, done and verified.
- **Biggest visible gap:** real product images (§6) — frame it as a quick, cheap
  adaptation step with the buyer's own photos.
- Value framing (no market price asserted): see `docs/SALE_READY_MVP_ROADMAP.md` §9.

## 9. Suggested next paid / adaptation work

- **Brand adaptation** (name/logo/colours by agreement, texts, contacts).
- **Real product image upload / catalog import** (buyer photos into existing slots).
- **Live demo deploy** (behind the readiness checklist + owner approval).
- **Payment provider integration** — *after* owner merchant/legal setup.
- **Nova Poshta integration** — *after* owner business account.
- **Legal / fiscal text integration** (offer, returns, privacy, РРО/ПРРО).
- **Email notifications + remaining account hardening** (email password reset/verification,
  guest-order linking, per-device sessions, multi-instance rate limiting) — later. *(Durable
  single-instance rate limiting and customer-auth audit logging are already done — 49A/51A.)*

## 10. Red lines / honesty rules

- ❌ Do not claim **payments are integrated**.
- ❌ Do not claim **delivery/carrier API is integrated**.
- ❌ Do not claim a **production deployment** exists.
- ❌ Do not present **placeholders as real products**.
- ❌ Do not use **unlicensed images**.
- ❌ Do not **promise launch** without the owner's legal/merchant documents.

## 11. Current final snapshot

- **Customer-accounts audited baseline:** `e9c7664 feat: harden customer session security`
  (customer accounts 47A–47C).
- **Local `main` also includes since then:** customer-auth audit + abuse protection (49A),
  pre-public demo smoke (50A), durable DB-backed rate limiting (51A), the public-demo
  preflight gate (52A), and the complete demo/sale readiness checks (53A) — see
  [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md).
- Local demo orders exist for screenshots — safe fictional data; the owner may cancel
  them in admin (cancel restocks).
- *This tracks formally-audited milestones, not every commit — refresh it at handoff milestones.*
