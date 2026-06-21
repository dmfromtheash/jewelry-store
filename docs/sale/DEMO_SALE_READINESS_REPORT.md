# Demo / Sale Readiness Report — AURELIA (Stage 53A)

> Package index: [`README.md`](./README.md) · top-level handoff:
> [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) · honest limits:
> [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md) · deploy-readiness audit:
> [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md).
>
> **Readiness verification, not a deployment.** This report and its checks are local and
> read-only. **Nothing is deployed, tunneled, hosted, or exposed.** No design/CSS, schema,
> `.env`, or secrets are changed or printed. dm-bot PostgreSQL on `localhost:5432` is never
> touched.

The single honest answer to "is AURELIA ready to show a buyer, and what can I promise?",
backed by **runnable** automated checks.

---

## 1. Ready for a buyer demo (local / supervised)

- **Storefront** — home, categories, product pages (variants, gallery), search, info pages,
  client cart, **guest checkout**, inline order confirmation (`AUR-XXXXXXXX`). UAH pricing,
  server-authoritative.
- **Customer accounts** — registration / login / logout, scrypt hashing, a personal cabinet
  (`/account`) with profile editing, password change, and **order history / order detail**
  scoped to the owner. Guest checkout is preserved alongside accounts.
- **Admin (local only)** — catalog CRUD, publish/hide, gallery + variants + stock, orders +
  status flow, site settings, info pages (CMS), and an audit log (admin + `customer.*` events).
- **Security** — durable DB-backed auth rate limiting (49A/51A), session revocation
  (47C), customer-auth audit (49A), admin gated + local-only by construction.

## 2. What the automated checks cover

Run them via the rehearsal (see §3). Each is local + safe (GET-only smokes; rolled-back or
self-cleaning DB verifies; nothing committed).

| Check | Command | Covers |
|---|---|---|
| Preflight gate | `npm run demo:preflight` | security posture + tooling/docs + DB target = 6700 |
| Types / schema | `npm run typecheck` · `npx prisma validate` | compiles; schema valid |
| Sale-docs consistency | `npm run demo:sale-docs-check` | buyer docs don't contradict the build |
| Customer auth | `npm run db:verify:customer-auth` | hashing, sessions, throttle (durable), audit, scoping (51/51) |
| Orders / checkout | `npm run db:verify:orders` etc. | order tables, lifecycle, confirmation, manual methods |
| Route render | `npm run smoke:routes` | 21 routes render; admin routes **gated** when unauthenticated |
| Authenticated admin | `npm run smoke:admin` | 6 admin surfaces render **with** a local session, **gated** without |
| Build | `npm run build` | production build green |

## 2a. Sale claims matrix

The honest "can I promise this to a buyer?" table. **Status:** ✅ done · 🟡 manual MVP (works,
no integration) · 🚫 not implemented / owner-gated.

| Capability | Status | Evidence / command / doc | Promise to buyer? | Caveat |
|---|---|---|---|---|
| Ukrainian storefront / catalog (DB) | ✅ | `smoke:routes`; `db:verify` | **Yes** | UAH; copy uk-UA, admin chrome stays Russian |
| UAH manual checkout | 🟡 | `db:verify:checkout-options`, `…order-confirmation` | **Yes, as manual** | no acquirer; payment confirmed off-system |
| Guest checkout | ✅ | `db:verify:customer-auth` (guest path) | **Yes** | preserved alongside accounts |
| Customer account / auth / order history | ✅ | `db:verify:customer-auth` (51/51); `/account` | **Yes** | email immutable in v1; no email reset/verify |
| Admin catalog / orders | ✅ | `smoke:admin`; `db:verify:orders`, `…order-lifecycle` | **Yes, local only** | admin 404s in production by design |
| Admin settings / content CMS | ✅ | `smoke:admin` (`/admin/settings`, `/admin/content`) | **Yes, local only** | text/settings only; no logic change |
| Product variants / inventory / restock | ✅ | `db:verify:product-variants`, `…inventory-lifecycle` | **Yes** | restock-on-cancel covered |
| Auth audit log (`customer.*`) | ✅ | `db:verify:customer-auth`; `/admin/audit-log` | **Yes** | no PII/secrets stored |
| Durable auth rate limiting | ✅ | `db:verify:customer-auth` (durable section) | **Yes, single-instance** | multi-instance atomic limiting deferred |
| Sale docs / screenshots package | ✅ | `demo:sale-docs-check`; `docs/sale/` | **Yes** | screenshots predate `/account` shot (see §10) |
| Preflight / rehearsal / smoke checks | ✅ | `demo:preflight`, `demo:rehearsal`, `smoke:*` | **Yes** | local, read-only; not a deploy |
| Real payment provider API | 🚫 | — (manual model only) | **No** | LiqPay/WayForPay etc. not integrated |
| Carrier API / TTN / tracking | 🚫 | — (manual delivery note only) | **No** | Nova Poshta/Ukrposhta not integrated |
| Email reset / verification | 🚫 | — (deferred) | **No** | no email provider wired |
| Public deploy / live demo | 🚫 | — (local only) | **No** | nothing hosted/tunneled |
| Legal / fiscalization (РРО/ПРРО) | 🚫 | — (owner/lawyer-gated) | **No** | not addressed in code |
| Real product imagery | 🚫 | placeholder (gem empty-state) | **No** | owner supplies licensed images |

## 3. How to run the local rehearsal

```sh
npm run demo:rehearsal     # offline checks now + prints the ordered live sequence
```

The rehearsal runs the offline checks (preflight, typecheck, prisma validate, sale-docs) and
prints the ordered **live** sequence (DB + dev server: `db:verify:*`, `smoke:routes`,
`smoke:admin`, `build`). It never starts a server/DB itself, never deploys, tunnels, resets,
seeds, or prints secrets. Details: [`../../scripts/demo/README.md`](../../scripts/demo/README.md).

## 4. How admin is protected

- **Local-only by construction:** `ensureLocalAdmin` returns 404 under `NODE_ENV=production`
  or any non-localhost host — a hosted/tunneled deploy serves the storefront only, with **no
  admin UI**.
- **Session-gated:** every admin page + mutation calls `requireAdminSession`; no session →
  redirect to `/admin/login`. The route smoke proves the gate; the admin smoke proves both the
  authenticated render and the unauthenticated gating, using a **locally minted** session
  (never a printed secret).

## 5. Still owner-gated (decisions only the owner can make)

Brand identity + real content/images; payment provider (LiqPay / WayForPay); carrier (Nova
Poshta / Ukrposhta); legal entity (ФОП / ТОВ) + merchant/bank account; domain / hosting /
deploy plan; fiscalization (РРО/ПРРО), taxes, receipts; delivery / refund / return policy.
See [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md).

## 6. Still not implemented (deferred, by design)

Real online payment acquiring + webhooks / "paid" state / refunds; carrier API / TTN /
tracking (delivery is a manual choice + note); email features (password reset, email
verification, notifications); production deploy / hosting; multi-instance atomic rate
limiting; full uk-UA / EN localization. Product imagery is placeholder. See
[`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).

## 7. Before any public demo URL

1. `npm run demo:preflight` green (security posture + DB target 6700).
2. `npm run demo:rehearsal` offline green **and** the live sequence green.
3. A **temporary, supervised tunnel** only — [`LOCAL_TUNNEL_DEMO_RUNBOOK.md`](./LOCAL_TUNNEL_DEMO_RUNBOOK.md)
   (storefront only; admin stays local). **Explicit, per-demo owner approval.**
4. Honest framing — no production/real-payment claims.

## 8. Before a real launch

A separate hosted DB + secrets + access plan; payment + carrier providers integrated and
tested; legal entity + fiscalization + policies in place; an admin-exposure security decision;
durable multi-instance rate limiting. All owner / provider / lawyer-gated — none are addressed
here. See [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md).

## 9. What must NOT be promised to a buyer

Keep the pitch honest. Do **not** tell a buyer that AURELIA already:

- takes real online card payments, or has an acquirer / payment gateway wired up — it uses a
  **manual** payment model only;
- prints carrier waybills or tracks parcels via a courier API — delivery is a **manual** choice
  plus an optional note;
- is hosted / deployed / running as a public production shop — it is a **local** demo;
- has a publicly reachable admin panel — admin is **local-only** and 404s in production;
- ships with finished real product photography — imagery is **placeholder** until the owner
  supplies licensed images;
- is **guest-checkout-only** — it now has full customer accounts **and** guest checkout.

The `npm run demo:sale-docs-check` script guards the buyer-facing docs against these specific
contradictions; keep it green.

## 10. Screenshot / package inventory note (Stage 54A audit)

The screenshot set (`docs/sale/screenshots/` + `…/production/`) was audited for consistency,
**not redesigned or recaptured** (no visual/design change in this stage):

- **Accurate for what it shows** — storefront (home, categories, product + variant, gallery),
  cart-with-variant, filled checkout, order confirmation, and admin (dashboard, catalog,
  product-edit gallery/variants/stock, order detail). These flows are unchanged, so the shots
  remain valid and **acceptable for the buyer package**.
- **Predates** the customer account cabinet (47A–47C) and the customer-auth audit rows (49A):
  there is **no `/account` screenshot**, and the audit-log shot does **not** show `customer.*`
  events. Nothing shown is wrong — these features are simply not pictured.
- **Optional future block (not done here):** add `/account` (profile + order history) and an
  audit-log shot with `customer.*` rows, using the existing safe local-capture workflow. This
  is a polish nicety, not a correctness gap, and is intentionally deferred.

---

*This report is verification, not a deployment record, and not proof of a live shop. Re-run the
rehearsal at each handoff milestone.*
