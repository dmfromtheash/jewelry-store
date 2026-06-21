# AURELIA — Smoke harness (Этап 50A · 53A)

Dependency-free HTTP **render smokes** for the business-critical flows. They run against an
already-running AURELIA server using Node's built-in `fetch` — **no browser engine, no new
dependency**. GET-only: they never write data and never submit an order.

```sh
npm run smoke:routes   # storefront + admin-gating (unauthenticated)
npm run smoke:admin    # authenticated admin surfaces (53A)
```

## Authenticated admin smoke (`scripts/smoke/admin-smoke.mjs`, 53A)

`npm run smoke:admin` smoke-tests the **authenticated** admin surfaces (`/admin`,
`/admin/orders`, `/admin/catalog`, `/admin/settings`, `/admin/content`, `/admin/audit-log`)
locally and safely:

- It loads `.env` into the process via Node's built-in `process.loadEnvFile()` and **mints a
  local `au_admin_session` cookie** (mirroring `src/lib/admin/auth.ts`). The secret, the token,
  and admin page bodies are **never printed**; the cookie is sent only to localhost.
- For each surface it asserts BOTH: **with** the session → 200 + the authenticated shell
  marker (`au-adm-shell`); **without** it → still **gated** (redirect to `/admin/login`). So it
  proves admin renders for an authenticated local operator yet stays closed otherwise.
- It does **not** weaken `ensureLocalAdmin` (admin still 404s in production / off-localhost),
  does not expose admin, and writes nothing. If `ADMIN_USERNAME` / `ADMIN_SESSION_SECRET` are
  not configured it **SKIPs cleanly** (exit 0) — there is nothing to mint and that is fine.

## What the route smoke checks

`scripts/smoke/route-smoke.mjs` (run via `npm run smoke:routes`):

- **Storefront renders 200 + HTML:** home, both categories, a product page (slug
  auto-derived from the home page), `coming-soon`, search, info pages (`contacts`,
  `delivery`, `help`, `returns`, `stores`, `about`), `favorites`, `checkout`,
  `checkout/success`.
- **Customer account:** `/account` renders its logged-out in-page login prompt (200).
- **Admin gate:** `/admin/login` renders; protected `/admin/*` pages (`audit-log`,
  `orders`, `catalog`, `dashboard`) are **gated** — a redirect to `/admin/login` in dev
  (no session) or a 404 in production (admin does not exist there). A `200` render of
  protected admin content, or any `5xx`, is a FAILURE.

The deeper auth/order/catalog **business logic** (registration/login/throttle/scoping,
order pricing/lifecycle/confirmation, catalog visibility) is covered separately by the
`db:verify:*` scripts, which use always-rolled-back transactions.

## How to run

```sh
# 1. Start the isolated AURELIA PostgreSQL (port 6700 only; never touches 5432).
npm run db:start

# 2. Start the app in another terminal. Admin pages only exist in dev mode
#    (ensureLocalAdmin 404s under NODE_ENV=production), so the local demo uses dev:
npm run dev            # http://127.0.0.1:5000

# 3. Run the route smoke (defaults to http://127.0.0.1:5000).
npm run smoke:routes

# 4. When done:
#    stop the dev server (Ctrl+C), then
npm run db:stop
```

Override the target with `SMOKE_BASE_URL` (e.g. a `next start` production server, where
admin routes are expected to 404):

```sh
SMOKE_BASE_URL=http://127.0.0.1:3000 npm run smoke:routes
```

Exit code is non-zero on any failed route or if the server is unreachable.

## Safety

- GET-only; no writes; no order submission; no external services.
- Reads no secrets (the app reads its own env); prints none.
- Touches only the AURELIA stack — never dm-bot PostgreSQL on `localhost:5432`.
