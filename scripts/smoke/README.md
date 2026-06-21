# AURELIA — Smoke harness (Этап 50A)

Dependency-free HTTP **route render smoke** for the business-critical flows. It runs
against an already-running AURELIA server using Node's built-in `fetch` — **no browser
engine, no new dependency**. GET-only: it never writes data and never submits an order.

## What it checks

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
