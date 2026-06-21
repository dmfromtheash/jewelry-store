# AURELIA — Demo readiness scripts (Этап 52A · 53A)

Dependency-free, **local, read-only** gates to run **before** any public-demo / tunnel /
deploy decision. Same Node-built-ins style as `scripts/smoke/`. They make it hard to
accidentally expose the project in an unsafe state, and keep the sale package honest.

> **None of these deploy.** They do not deploy, tunnel, expose, start a server, reset/seed a
> DB, and they never read or print `.env` / secrets (the preflight reads only the
> `DATABASE_URL` **port**; the admin smoke loads `.env` into memory to mint a *local* session
> but never prints the secret or token).

## Commands

```sh
npm run demo:preflight        # static security gate — fast; no DB, no server, no build
npm run demo:preflight:full   # static gate + typecheck + prisma validate (safe child checks)
npm run demo:sale-docs-check  # buyer-facing sale docs don't contradict the build (53A)
npm run demo:rehearsal        # offline checks now + prints the ordered live sequence (53A)
```

```sh
npm run demo:capture          # screenshot unauthenticated demo pages via headless Edge (55A)
```

Related (in `scripts/smoke/`): `npm run smoke:routes` (route render + admin gating) and
`npm run smoke:admin` (authenticated admin surfaces — 53A).

Exit code is non-zero only on a **hard FAIL**. `WARN` / `INFO` items never fail the gate —
they are flagged for a human to review.

## `demo:capture` (55A)

Captures **unauthenticated** demo screenshots using the already-installed Microsoft Edge in
headless mode (no Playwright/Puppeteer, no npm dependency). Needs a running local dev server
(`npm run db:start && npm run dev`); GET-only; never reads/prints `.env`/secrets; writes only
its named target PNGs into `docs/sale/screenshots/` (does **not** overwrite the curated set).
Authenticated screens are captured **manually** — see
[`../../docs/sale/SCREENSHOT_INVENTORY.md`](../../docs/sale/SCREENSHOT_INVENTORY.md).

## `demo:rehearsal` (53A)

One command to rehearse local demo/sale readiness. It runs the **offline** checks
(`demo:preflight`, `typecheck`, `prisma validate`, `demo:sale-docs-check`) and then **prints**
the ordered **live** sequence that needs the AURELIA DB (6700) + a running dev server
(`db:verify:*`, `smoke:routes`, `smoke:admin`, `build`). It never starts a server/DB itself.

## `demo:sale-docs-check` (53A)

Scans the **buyer-facing** sale docs (not the operator/meta readiness docs, which legitimately
discuss limitations) for claims that contradict the current build — stale negatives
("guest-checkout-only", "no customer account / order history") and false features ("payment
API implemented", "carrier API integrated", "deployed to production", "public admin ready",
"real imagery complete"). Lines that are honest negations/disclaimers are skipped. It **fails**
on a contradiction and never rewrites docs.

## What it verifies

**Hard (FAIL → exit 1):**
- Safety tooling is present (`typecheck`, `build`, `smoke:routes`, `db:verify:customer-auth`,
  `db:start`, `db:stop` npm scripts).
- Required files/docs exist (`scripts/smoke/route-smoke.mjs`, and the three readiness docs:
  `PRE_PUBLIC_DEMO_READINESS`, `LIVE_DEMO_DEPLOY_READINESS`, `LOCAL_TUNNEL_DEMO_RUNBOOK`).
- **Security posture in code:** the schema carries `CustomerAuthThrottle` (durable rate
  limiting), `Customer` + `sessionVersion` + `passwordChangedAt` (session revocation), and
  `AdminAuditLog`; the admin guard (`src/lib/admin/guard.ts`) still 404s outside local dev
  (`ensureLocalAdmin` / `notFound` / `production`).
- **DB target:** if `DATABASE_URL` is loaded in the process, its **port** is `6700` (the
  isolated AURELIA DB) — a `5432` target (dm-bot) is a hard fail. Only the port is read; the
  user / password / host are never read or printed.

**Soft (WARN — review, but does not fail):**
- Git hygiene: on `main`, working tree clean, in sync with `origin/main`.
- No `5432` reference in app code (`src/` / `prisma/`).
- The readiness doc still carries honest gating language (payment/admin/deploy disclaimers).
- `DATABASE_URL` not loaded in the preflight process (normal — Prisma/Next load it at runtime).

`--full` additionally runs the two **safe** child checks that need no live server
(`npm run typecheck`, `npx prisma validate`) and **prints** the DB/server-dependent commands
to run manually (it never starts a server or DB itself):

```sh
npm run db:start && npm run db:verify:customer-auth   # then npm run db:stop
npm run dev   (separate terminal)  &&  npm run smoke:routes
npm run build
```

## What it intentionally does NOT do

- No deploy, no tunnel, no cloud resource, no public exposure.
- No DB connection / start / migration / seed; never touches dm-bot on `localhost:5432`.
- No reading or printing of `.env` / `.env.local` / secrets.
- It is **not** owner approval — a public demo still needs explicit, per-demo owner sign-off,
  and a live/production demo needs a separate DB + secrets + access plan + admin-exposure and
  legal review. See [`../../docs/sale/LIVE_DEMO_DEPLOY_READINESS.md`](../../docs/sale/LIVE_DEMO_DEPLOY_READINESS.md)
  and [`../../docs/sale/PRE_PUBLIC_DEMO_READINESS.md`](../../docs/sale/PRE_PUBLIC_DEMO_READINESS.md).
