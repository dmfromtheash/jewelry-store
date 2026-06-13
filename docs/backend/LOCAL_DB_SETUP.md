# AURELIA — Local DB setup (Этап 15A)

Backend catalog foundation: Prisma + PostgreSQL. This stage adds the schema,
seed and client helper. **It does NOT switch the storefront to the DB** — the
frontend still reads the static mock catalog from `src/data/products.ts`.

## What's included

- `prisma/schema.prisma` — `Category`, `Product`, `ProductVariant`,
  `ProductImage` (catalog only; no User/Order/Payment/Admin yet).
- `prisma/seed.ts` — idempotent import of the mock catalog.
- `src/lib/db/prisma.ts` — `PrismaClient` singleton (not yet used by any UI).

## Prerequisites

- A local (or remote) **PostgreSQL** instance.
- Node 18+ (this repo uses Node 22).

## 1. Configure `DATABASE_URL`

Copy the example env file and edit the connection string:

```bash
cp .env.example .env
```

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/aurelia?schema=public"
```

`.env` is gitignored — never commit it. Create the `aurelia` database in your
PostgreSQL server first (e.g. `createdb aurelia`).

## 2. Generate the Prisma client

Required after install and after any schema change (generates types used by
`typecheck`):

```bash
npm run prisma:generate
```

## 3. Validate the schema

```bash
npm run prisma:validate
```

## 4. Run the migration (needs a reachable PostgreSQL)

Creates the tables and the initial migration history:

```bash
npm run db:migrate
```

## 5. Seed the catalog (needs a reachable PostgreSQL)

Imports the current mock products into `Category` / `Product` /
`ProductVariant` / `ProductImage`. Safe to re-run — every write is an upsert,
so it never creates duplicates:

```bash
npm run db:seed
```

## 6. Inspect the data (optional)

```bash
npm run db:studio
```

## Notes & conventions

- **Money** is stored as integer **minor units (kopecks)** — the seed converts
  whole-RUB mock prices (`2490` → `249000`). Never store money as float.
- **Prices are server-authoritative**; `coming-soon` products have `price = null`.
- `ProductImage.url` is `null` for now (the UI renders a gem placeholder); the
  row reserves the ordered image slot for real assets later.
- **Migrate and seed require `DATABASE_URL`** and a reachable PostgreSQL. They
  are NOT run automatically as part of build/typecheck.
- Prisma is pinned to **6.x** on purpose: Prisma 7 removed `url = env(...)` from
  the schema (it requires `prisma.config.ts` + a driver adapter), which is out
  of scope for this minimal foundation.
