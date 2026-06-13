# AURELIA — Backend Specification (Этап 14A)

> Status: **specification only** — no backend code, no dependencies, no schema.
> This document defines *what* the backend will do and *how* it fits the
> existing frontend-only storefront. Implementation happens in later stages
> (see `BACKEND_ROADMAP.md`).

## 1. Current state (frontend-only foundation)

The storefront is a Next.js 15.5.19 / React 19 / TypeScript app with plain CSS.
Everything is **static / client-only** today:

| Area | Today | Source of truth |
| --- | --- | --- |
| Catalog | mock array | `src/data/products.ts` via `src/lib/catalog` |
| Product pages | `/product/[slug]`, `generateStaticParams`, `dynamicParams=false` | mock catalog |
| Categories | `/category/bijouterie`, `/category/gifts` | mock catalog filtered by `categorySlug` |
| Search / filter / sort | in-memory over mock catalog | `src/lib/catalog/search.ts` |
| Cart | client state + `localStorage` key `aurelia-cart` (`{slug, qty}[]`) | `CartProvider` |
| Favorites | client state + `localStorage` key `aurelia-favorites` (`slug[]`) | `FavoritesProvider` |
| Recently viewed | `localStorage` key `aurelia-recently-viewed` (`slug[]`, max 8) | `RecentlyViewed` |
| Checkout | demo UI, **no submit**, cart not cleared | `CheckoutPageClient` |
| Auth | UI-only modals (login/register), no real session | `AuthModalProvider` |
| Info pages | static content | `src/data/info-pages.ts` |

Prices today live only in the mock data and are rendered client-side.

## 2. Backend goal

The backend must turn the demo storefront into a real shop while preserving the
existing UI. Concretely it should provide:

1. **A real product catalog** in a database (replacing `src/data/products.ts`),
   served to the frontend so content can change without redeploys.
2. **Server-authoritative pricing & availability** — the client must never be
   trusted for price or stock.
3. **Persistent cart** (guest + logged-in) replacing `localStorage` cart.
4. **Persistent favorites** tied to a user account (after auth) replacing
   `localStorage` favorites.
5. **Order drafts and order creation** from the checkout UI (no real payment in
   the first backend cycle — payment is a placeholder).
6. **Authentication / sessions** for customers, and a separate **admin** surface
   for catalog and order management.

### What stays frontend-only (for now)

- Recently-viewed (purely a UX nicety) can stay in `localStorage` indefinitely.
- Info pages (`delivery`, `returns`, `stores`, `help`, `about`, `contacts`) stay
  as static code content; a CMS is optional and deferred.
- Real payment processing — placeholder only until a dedicated stage.
- Search can remain in-memory at first (small catalog), moving server-side when
  the catalog grows.

### What gets replaced (mock/localStorage → backend)

| Replaced | Becomes |
| --- | --- |
| `src/data/products.ts` | DB-seeded `Product` table, fetched via server data layer |
| `localStorage aurelia-cart` | guest cart (cookie/session id) → user cart on login |
| `localStorage aurelia-favorites` | `Favorite` rows tied to `User` |
| checkout demo button | `Order` draft → `Order` create (server) |
| client price math | server-side recomputation from DB prices |
| UI-only auth modals | real session-backed auth |

## 3. Recommended stack

**Primary recommendation (best fit for this repo):**

- **Next.js Route Handlers + Server Actions** (already on Next 15 / React 19).
  Keep the app as a single deployable unit; use Server Actions for mutations
  (cart, favorites, order draft) and Route Handlers for any public JSON API.
- **Prisma** as the ORM / schema source of truth and migration tool.
- **PostgreSQL** as the database.
- **Secrets via environment variables** (`.env` / `.env.local`, never committed);
  a typed env loader validates them at boot.
- **No payments** in the first backend cycle — `Payment` is a placeholder entity
  and a stubbed step in checkout.

Rationale: zero new runtime services beyond Postgres, types shared end-to-end,
Server Actions remove a lot of API boilerplate for the storefront mutations, and
Prisma gives safe migrations + a clean seed path from `src/data/products.ts`.

### Alternatives (brief)

| Option | Pros | Cons | Verdict |
| --- | --- | --- | --- |
| **Supabase** (Postgres + Auth + RLS + storage) | Fast auth & storage, hosted Postgres, RLS | Vendor coupling, RLS learning curve, auth model imposed | Strong if we want managed auth/storage quickly; revisit at auth stage |
| **Headless CMS** (Sanity/Strapi/Payload) | Great content editing for catalog/info pages | Overkill for orders/cart; another service | Only worthwhile for content-heavy catalog; not for cart/orders |
| **Separate backend** (NestJS/Express + Postgres) | Clear separation, independent scaling | Two deploys, duplicated types, CORS/session plumbing | Unnecessary at current scale |

**Recommendation:** start with **Next.js (Route Handlers + Server Actions) +
Prisma + PostgreSQL**. Consider Supabase specifically for **auth + image
storage** when we reach those stages, layered behind the same data layer.

> No dependencies are installed in 14A. Choosing the stack here only guides the
> roadmap; `package.json` is untouched.

## 4. Architecture shape

```
app/                      ← UI (unchanged)
  api/...                 ← (later) public Route Handlers (JSON)
src/
  data/products.ts        ← (later) becomes seed source, then removed
  lib/catalog/            ← (later) reads from server data layer instead of mock
  server/                 ← (later) data-access + services (price, order, etc.)
prisma/                   ← (later) schema.prisma + migrations + seed
```

Key principle: the existing `src/lib/catalog` public functions
(`getAllProducts`, `getProductBySlug`, `getProductsByCategorySlug`,
`searchProducts`, `sortProducts`, …) become the **seam**. Their signatures stay;
their implementation swaps from the mock array to DB queries. UI components do
not need to change when the data source flips.

See `DATA_MODEL.md`, `API_PLAN.md`, `BACKEND_ROADMAP.md`, `SECURITY_NOTES.md`.
