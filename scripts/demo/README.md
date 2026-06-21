# AURELIA — Public-demo preflight (Этап 52A)

A dependency-free, **local, read-only** gate to run **before** any public-demo / tunnel /
deploy decision. Same Node-built-ins style as `scripts/smoke/`. It exists to make it hard
to accidentally expose the project in an unsafe state.

> **Preflight is not a deployment.** It does not deploy, tunnel, expose, start a server,
> or touch any database, and it never reads or prints `.env` / secrets.

## Commands

```sh
npm run demo:preflight        # static gate — fast; no DB, no server, no build
npm run demo:preflight:full   # static gate + typecheck + prisma validate (safe child checks)
```

Exit code is non-zero only on a **hard FAIL**. `WARN` / `INFO` items never fail the gate —
they are flagged for a human to review.

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
