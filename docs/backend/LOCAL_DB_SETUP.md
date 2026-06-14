# AURELIA — Local DB setup (Этапы 15A–15B)

Backend catalog runtime: Prisma + PostgreSQL. The schema, seed, client helper
and verification script live in `prisma/` and `src/lib/db/`.

> **15B does NOT switch the storefront to the DB.** The frontend still reads the
> static mock catalog from `src/data/products.ts` via `src/lib/catalog/*`. This
> stage only stands up the DB, migration and seed so later stages can adopt it.

> **Day-to-day operation** (start / stop / status / health / backup) is covered
> in [LOCAL_DB_OPERATIONS.md](./LOCAL_DB_OPERATIONS.md). Quick reference:
> `npm run db:start | db:stop | db:status | db:health | db:backup`.

## What's included

- `prisma/schema.prisma` — `Category`, `Product`, `ProductVariant`,
  `ProductImage` (catalog only; no User/Order/Payment/Admin yet).
- `prisma/migrations/` — committed migration history (`init_catalog`).
- `prisma/seed.ts` — idempotent import of the mock catalog.
- `prisma/verify-catalog.ts` — read-only DB check (counts + sample slugs).
- `src/lib/db/prisma.ts` — `PrismaClient` singleton (not yet used by any UI).

## Port convention

AURELIA's PostgreSQL uses **port 6700**, deliberately NOT the default `5432`
(which on this machine hosts an unrelated cluster). The AURELIA website stays on
`http://localhost:5000`. Keep these isolated.

## Option A — native portable PostgreSQL (used for 15B)

A portable PostgreSQL 16 lives at `C:\tmp\postgresql-16.11\pgsql\bin`. AURELIA
runs its **own isolated cluster** in a separate data directory and port, so it
never touches any other local cluster.

```powershell
$bin  = 'C:\tmp\postgresql-16.11\pgsql\bin'
$data = 'C:\tmp\aurelia-postgres-data'

# One-time: initialise an isolated cluster (superuser=postgres, scram auth)
& "$bin\initdb.exe" -D $data -U postgres -A scram-sha-256 --pwfile=<pwfile> -E UTF8 --locale=C

# Start it on 6700 (logs into the cluster's own data dir)
& "$bin\pg_ctl.exe" -D $data -o '-p 6700' -l "$data\server.log" start

# One-time: create the app role + database (run as superuser)
#   CREATE ROLE aurelia LOGIN CREATEDB PASSWORD '<dev-only>';
#   CREATE DATABASE aurelia OWNER aurelia;
#   \c aurelia
#   GRANT ALL ON SCHEMA public TO aurelia; ALTER SCHEMA public OWNER TO aurelia;

# Stop the cluster when done (does NOT delete data)
& "$bin\pg_ctl.exe" -D $data stop
```

> The `aurelia` role needs `CREATEDB` so `prisma migrate dev` can manage its
> temporary shadow database.

## Option B — Docker (future / other machines)

If Docker is available, `docker-compose.yml` provides an equivalent cluster on
**the same port 6700** (container `aurelia-postgres`, volume
`aurelia-postgres-data`). Use **either** Option A or Option B, not both at once
(they share port 6700).

```bash
docker compose up -d        # start aurelia-postgres on localhost:6700
docker compose down         # stop (keeps the named volume / data)
```

## 1. Configure `DATABASE_URL`

Copy the example env file and set the real dev password:

```bash
cp .env.example .env
```

```
DATABASE_URL="postgresql://aurelia:<dev-password>@localhost:6700/aurelia?schema=public"
```

`.env` is **gitignored** — never commit it. `.env.example` carries only a
placeholder.

## 2. Generate the Prisma client

```bash
npm run prisma:generate
```

## 3. Validate the schema

```bash
npm run prisma:validate
```

## 4. Apply migrations (needs the DB running)

```bash
npm run db:migrate          # prisma migrate dev
```

## 5. Seed the catalog (needs the DB running)

Imports the mock products. Safe to re-run — every write is an upsert, so it
never creates duplicates:

```bash
npm run db:seed
```

## 6. Verify the data landed

```bash
npm run db:verify           # prints counts; asserts 2 categories, 10 products
```

## 7. Inspect (optional)

```bash
npm run db:studio
```

## Notes & conventions

- **Money** is stored as integer **minor units (kopecks)** — the seed converts
  whole-RUB mock prices (`2490` → `249000`). Never store money as float.
- **Prices are server-authoritative**; `coming-soon` products have `price = null`.
- `ProductImage.url` is `null` for now (UI renders a gem placeholder); the row
  reserves the ordered image slot for real assets later.
- **Migrate / seed / verify require a reachable PostgreSQL on 6700** and are NOT
  run as part of build/typecheck.
- Prisma is pinned to **6.x** on purpose: Prisma 7 removed `url = env(...)` from
  the schema (it requires `prisma.config.ts` + a driver adapter), out of scope
  for this foundation.
