# Pre-Public Demo Readiness — AURELIA (Stage 50A)

> Package index: [`README.md`](./README.md) · top-level handoff:
> [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) · deploy-readiness audit:
> [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) · honest limits:
> [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
>
> **Readiness verification, not a deployment.** This stage added an automated smoke
> layer and produced this honest report. **Nothing is deployed, tunneled, hosted, or
> exposed.** No design/CSS, no schema, no `.env`, no secrets, and no payment/delivery/
> email integrations were added. dm-bot PostgreSQL on `localhost:5432` was never touched.

---

## 1. Purpose

Answer, with **repeatable automated evidence**, whether the main business flows render and
behave safely enough for a **local/supervised demo** — and state plainly what still blocks a
**public demo** and a **real launch**. It complements the planning docs above with an
*executable* check set.

Baseline verified: `e4453c9` (customer accounts 47A–47C + auth abuse protection/audit 49A).

---

## 2. How to run the automated checks

All checks are local, dependency-free, and DB-isolated to the AURELIA PostgreSQL on
**port 6700 only**.

```sh
# Server-side business logic (rolled-back / self-cleaning transactions):
npm run db:start
npm run db:verify:customer-auth        # 51/51 — auth, sessions, throttle (in-mem + durable DB), audit, scoping
npm run db:verify:orders               # order tables + create path (rolled back)
npm run db:verify:order-lifecycle      # submitted → processing → completed
npm run db:verify:order-confirmation   # confirmation renderable from keys; privacy-safe
npm run db:verify:checkout-options     # manual payment/delivery validation + UAH
npm run db:verify:audit-log            # AdminAuditLog write path (rolled back)

# Route render smoke (needs the app running; admin pages exist in dev only):
npm run dev                            # http://127.0.0.1:5000  (separate terminal)
npm run smoke:routes                   # 21 routes render / gate as expected

npm run db:stop                        # when finished
```

See [`../../scripts/smoke/README.md`](../../scripts/smoke/README.md) for the smoke harness
details and the production-mode (`next start`) variant.

### Preflight gate (run this FIRST — Stage 52A)

Before touching any demo URL / tunnel / deploy, run the dependency-free, read-only gate:

```sh
npm run demo:preflight        # static security gate — no DB, no server, no deploy
npm run demo:preflight:full   # + typecheck + prisma validate (safe child checks)
```

It asserts the security posture is intact (admin stays local-only by construction, durable
auth rate limiting + session revocation are present in the schema, the DB target is the
isolated **6700** and never dm-bot's **5432**) and that the safety tooling/docs exist. It
**never deploys, tunnels, starts a server, touches a DB, or reads/prints `.env`** — only the
`DATABASE_URL` **port** is ever read, never credentials. A green preflight is a *readiness
gate, not approval to deploy*. Details: [`../../scripts/demo/README.md`](../../scripts/demo/README.md).

### Full local rehearsal + sale-doc consistency + authenticated admin (Stage 53A)

```sh
npm run demo:rehearsal         # offline checks now + prints the ordered live sequence
npm run demo:sale-docs-check   # buyer-facing docs don't contradict the build
npm run smoke:admin            # authenticated admin surfaces (needs the dev server + ADMIN_* in .env)
```

- **`demo:rehearsal`** orchestrates the offline checks (preflight, typecheck, prisma validate,
  sale-docs) and prints the ordered **live** sequence (DB + dev server) — it never starts a
  server/DB, deploys, tunnels, resets, seeds, or prints secrets.
- **`demo:sale-docs-check`** scans the buyer-facing sale docs for claims that contradict the
  build (e.g. "guest-checkout-only", "payment API implemented", "deployed to production",
  "public admin ready", "imagery complete") and fails on them.
- **`smoke:admin`** mints a **local** admin session (never printing the secret/token) and
  asserts the 6 admin surfaces render when authenticated **and** stay gated when not. It
  **SKIPs cleanly** if `ADMIN_*` is not configured. The full picture lives in
  [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md).

---

## 3. What automated checks cover (verified)

### A. Storefront → product → checkout render (`npm run smoke:routes`, 21 routes)

HTTP GET render smoke using Node's built-in `fetch` — **no browser engine, no new
dependency**, GET-only (no writes, no order submission). All pass:

- **Storefront (200 + HTML):** home, `/category/bijouterie`, `/category/gifts`, a product
  page (slug auto-derived from the home page), `/product/coming-soon`, `/search`, info pages
  (`/contacts`, `/delivery`, `/help`, `/returns`, `/stores`, `/about`), `/favorites`,
  `/checkout`, `/checkout/success`.
- **Customer account:** `/account` renders its logged-out in-page login prompt (200).
- **Admin gate:** `/admin/login` renders; protected `/admin/*` (`audit-log`, `orders`,
  `catalog`, `dashboard`) are **gated** — redirect → `/admin/login` (dev, no session) or 404
  (production, where admin does not exist). A 200 render of protected admin content would be
  a FAILURE; none occurred.

### B. Cart / checkout / order flow (server-side)

Browser order submission is intentionally **not** scripted (Next server actions can't be
invoked reliably by raw HTTP, and a submit would write data). The order pipeline is instead
verified at the data/logic layer, where it can be rolled back or self-cleaned:

- `db:verify:orders` — order/orderItem tables accessible; create path works (rolled back).
- `db:verify:order-lifecycle` — manual status machine submitted → processing → completed;
  admin inbox clears; hidden-product guard intact.
- `db:verify:order-confirmation` — confirmation is renderable from method keys alone (no
  unsafe public by-code lookup), payment/delivery labels resolve, UAH default, deliveryDetails
  preserved.
- `db:verify:checkout-options` — manual payment/delivery allowlist validation; UAH guard.

### C. Customer auth / account (after 49A) — `db:verify:customer-auth`, 45/45

scrypt hashing (never plaintext); HMAC session token incl. `ver` (47C) with legacy-token
reject; password change bumps `sessionVersion` → stale tokens invalidated, current device
re-issued; registration/profile/password validation + email normalisation; **abuse
protection** (49A + **durable DB-backed limiter 51A**) — per-scope throttle trips at its
budget, clears on success, resets an expired window, and is isolated per identifier and per
scope, now exercised against the real `CustomerAuthThrottle` table (rolled back); **audit
logging** (49A) — every `customer.*` action is labelled, uses the `customer.*` namespace, and
the write path works (rolled back).
Cross-customer order scoping: A can never load B's or a guest's order by code. Nothing is ever
committed (customer/order/audit counts asserted unchanged).

### D. Admin demo-safety

- Admin is **local-only by construction** (`ensureLocalAdmin` 404s under
  `NODE_ENV=production` or a non-localhost host) **and** session-gated
  (`requireAdminSession`). The route smoke confirms protected pages stay gated without a
  session.
- `db:verify:audit-log` confirms the `AdminAuditLog` write path; `db:verify:customer-auth`
  confirms the `customer.*` labels the admin audit-log page now merges (49A). Authenticated
  admin page *content* (audit-log table, orders, catalog) is exercised **manually** in the
  demo (login required) — see §4.

---

## 4. What remains manual (not automated here)

- **Authenticated admin walk-through** — login with `ADMIN_*` env credentials, then visit
  `/admin/audit-log` (see `customer.*` rows render with Russian labels), `/admin/orders`,
  `/admin/catalog`. Not scripted because it needs a real session + secrets.
- **Full click-through purchase** — add to cart → fill checkout → submit → confirmation code.
  Covered server-side (§3B); the visual/interactive path is a manual demo step
  ([`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md), [`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md)).
- **Visual / responsive / cross-browser QA** — design is locked; reference shots in
  [`screenshots/`](./screenshots/) and [`DEMO_SCREENSHOT_CHECKLIST.md`](./DEMO_SCREENSHOT_CHECKLIST.md).
- **Customer email-side flows** — password reset / email verification are **not implemented**
  (deferred); nothing to test.

---

## 5. Blockers

### Blocks a PUBLIC demo (beyond local/supervised)

- **DB-backed, server-rendered app** — needs a reachable Postgres at runtime; not a static
  upload. See [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) §2.
- **Auth throttle is now durable for a single instance** (DB-backed `CustomerAuthThrottle`,
  51A — counts survive restart). Sufficient for a single-instance public demo; a
  **multi-instance / high-abuse production** deployment still needs a shared store with atomic
  ops (Redis or Postgres advisory locks) — `src/lib/customer/rate-limit.ts` is the swap-in
  point.
- **Admin is dev/localhost-only by design** — a public deployment has *no* admin UI; admin
  must stay on the owner's machine (or behind separate, owner-approved protection).
- **Product imagery is placeholder** (gem empty-state) — see
  [`PRODUCT_IMAGERY_GAP_PLAN.md`](./PRODUCT_IMAGERY_GAP_PLAN.md).
- A public link should use the **temporary, supervised tunnel** path only —
  [`LOCAL_TUNNEL_DEMO_RUNBOOK.md`](./LOCAL_TUNNEL_DEMO_RUNBOOK.md) (storefront only; not
  executed by this stage).

### Blocks a REAL launch (owner/legal/provider-gated)

- **No real payment acquiring** (LiqPay/WayForPay/etc.), no webhooks/"paid" state/refunds.
- **No carrier API / TTN / tracking** (delivery is a manual choice + free-text note).
- **No email provider** → no password reset, email verification, or notifications.
- **No production hosting/domain/deploy**, no fiscalization (РРО/ПРРО) / legal compliance.
- See [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md) and
  [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md).

---

## 6. Security notes (after 49A)

- Customer passwords: scrypt, never stored/logged in plaintext; constant-time verify; login
  returns a generic error (no account-existence leak); a fixed dummy-hash verify keeps timing
  similar for unknown accounts.
- Sessions: separate httpOnly customer cookie (distinct signing key from admin); `sessionVersion`
  revocation invalidates all-device tokens on password change.
- **Abuse protection (49A + 51A):** per-scope rate limiting — login/register by IP,
  password/profile per customer id. Now a **durable DB-backed limiter** (`CustomerAuthThrottle`,
  51A) whose counts survive a restart; the identifier is sha256-hashed (no raw IP/id stored)
  and it fails over to in-memory if the DB hiccups. **Limitation:** single-instance, no atomic
  cross-instance locking — production multi-instance needs a shared store (swap-in point:
  `src/lib/customer/rate-limit.ts`).
- **Audit logging (49A):** customer auth events recorded to `AdminAuditLog` under `customer.*`;
  stores only event + customer id (cuid, not PII) or `anonymous` + a machine reason. Never
  stores email, password, hash, cookie/token, or raw request data. Visible in the local
  admin audit-log page.
- Order privacy: no unsafe public by-code lookup; customer order detail is hard-scoped by
  `customerId`.

Full spec: [`../customer/CUSTOMER_AUTH_ACCOUNT_SPEC.md`](../customer/CUSTOMER_AUTH_ACCOUNT_SPEC.md).

---

## 7. Database & isolation

- All checks use the **isolated AURELIA PostgreSQL on `localhost:6700`** (portable PG, data
  dir `C:\tmp\aurelia-postgres-data`) via the documented `npm run db:start|stop|status`
  scripts.
- **dm-bot PostgreSQL on `localhost:5432` is never touched.**
- The route smoke is GET-only (no writes). The `db:verify:*` scripts use rolled-back or
  self-cleaning transactions; no `reset`/`drop`/`seed` is run by this readiness layer.

---

## 8. Stage 50A scope confirmation

- ✅ No design/CSS/layout/typography/colour/imagery changes.
- ✅ No `.env` / `.env.local` touched or printed; no secrets printed.
- ✅ No payment, delivery, or email integrations added.
- ✅ No deploy, tunnel, or cloud resource created.
- ✅ No DB reset/drop/seed; dm-bot 5432 untouched.
- ✅ One minimal non-visual fix: corrected stale Russian label assertions in
  `prisma/verify-order-confirmation.ts` to match the current Ukrainian method labels
  (27B localisation) — a false-failing readiness check, not a product change.

---

## 9. Remaining risks / recommended next block

- The auth throttle is now **durable for a single instance** (51A); the remaining limiter gap
  is **multi-instance atomic** rate limiting (Redis / Postgres advisory locks), only needed for
  a real multi-instance production deployment.
- Owner/legal/provider decisions (payment, carrier, entity, hosting, fiscalization) remain the
  gating path to a real launch — none are code-side and none are addressed here.
- Authenticated admin content rendering is the main flow still verified only manually; a future
  block could add a safe, session-minting admin smoke if desired.
