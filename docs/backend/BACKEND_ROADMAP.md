# AURELIA — Backend Roadmap (Этап 14A)

> Specification only. Sequence of small, reviewable backend stages. Each stage
> ships behind the existing UI seam (`src/lib/catalog`, providers) so the
> storefront keeps working at every step. Stages are independent commits with
> visual/functional review, mirroring the frontend workflow.

Stack assumed: **Next.js Route Handlers + Server Actions + Prisma +
PostgreSQL** (see `BACKEND_SPEC.md`). Dev port stays **5000**.

---

## Implementation status (actual stages shipped)

The roadmap below is the original spec; the executed work is tracked as 15A–16A:

- **15A** — backend catalog foundation (Prisma 6, schema, seed, client helper).
- **15B** — local DB migration + seed runtime (isolated Postgres on **6700**).
- **15C** — local DB operations scripts (`db:start/stop/status/health/backup`).
- **15D** — storefront catalog now reads from PostgreSQL (this roadmap's 15B+15C).
- **16A** — **checkout order drafts** (this roadmap's "15E"): server-priced guest
  order creation. Models `Order` + `OrderItem`; server action
  `createOrderDraft`; success page; `npm run db:verify:orders`. **No payment /
  auth / admin.** See `ORDER_DRAFT_FLOW.md`.

Still ahead: payment (placeholder → real), customer auth + order history, admin
order tools.

---

## 15A — Backend Foundation setup
- **Goal:** install/configure the backend toolchain without changing runtime UI.
- **Scope:** add Prisma + Postgres deps; `prisma/schema.prisma` (empty/baseline);
  `.env.example` with placeholder names; typed env loader; `src/server/` folder;
  db connection helper; npm scripts (`db:*`). DB reachable locally.
- **Запреты:** no entities/migrations with data yet; no UI changes; no real
  secrets committed.
- **Done when:** `prisma` connects, `npm run build` still passes, storefront
  unchanged.

## 15B — Product DB + seed
- **Goal:** model the catalog in the DB and seed it from the mock.
- **Scope:** `Product`, `Category`, `ProductVariant`, `ProductImage` (placeholder)
  in schema; first migration; **seed script** that imports `src/data/products.ts`
  → DB. Verify row counts match mock.
- **Запреты:** UI still reads mock (no switch yet); no admin; no prices trusted
  from anywhere but seed.
- **Done when:** migration + seed run cleanly; DB holds all current products.

## 15C — Product API / server data
- **Goal:** flip the catalog data source from mock → DB behind the seam.
- **Scope:** implement `getAllProducts/getProductBySlug/getProductsByCategorySlug`
  (+ search/sort/filter) against the DB; keep signatures identical; wire
  `/product/[slug]` (`generateStaticParams` from DB), categories, search.
  Remove/retire `src/data/products.ts` as a runtime source (keep for seed).
- **Запреты:** no cart/order persistence yet; UI markup unchanged.
- **Done when:** all catalog pages render from DB; build passes; no UI diff.

## 15D — Cart / Favorites persistence
- **Goal:** move cart + favorites from localStorage to the server.
- **Scope:** `Cart`/`CartItem`, `Favorite`; guest cart via httpOnly cookie token;
  server actions (`cart.*`, `favorites.*`); providers call actions but keep their
  public API; **server-side price recompute**. Define merge-on-login behavior
  (deferred wiring until auth exists, but logic ready).
- **Запреты:** no checkout/orders; no real auth required yet (guest token ok).
- **Done when:** cart/favorites survive reload via server; prices come from DB.

## 15E — Checkout / order draft
- **Goal:** turn the demo checkout into real order drafts + creation.
- **Scope:** `Order`/`OrderItem`/`Address` (+ `Payment` placeholder);
  `checkout.createDraft`, `checkout.updateContact`, `order.create`; server
  validation; idempotent order creation; totals server-computed; **no payment**.
- **Запреты:** no real payment/charge; do not auto-clear cart until order
  confirmed by server; no admin order tools yet.
- **Done when:** a cart becomes a persisted order (status `pending`) with a
  placeholder payment; checkout UI submits to it.

## 15F — Admin foundation
- **Goal:** protected admin surface for catalog + orders.
- **Scope:** `AdminUser`/`Role`/`AuditLog`; admin auth (separate from customers);
  role-gated `admin.products.*`, `admin.categories.*`, `admin.orders.*`; audit
  logging on every mutation; minimal admin UI shell.
- **Запреты:** no customer-facing changes; deny-by-default authz; no destructive
  bulk ops without confirmation.
- **Done when:** an admin can CRUD products and change order status; all actions
  audited; non-admins blocked.

## 15G — Auth (customers)
- **Goal:** real customer sessions wired to the existing modals.
- **Scope:** `auth.register/login/logout/me`; httpOnly session cookies; password
  hashing; rate limiting; **merge** guest cart + localStorage favorites into the
  account on login.
- **Запреты:** no third-party social login required (optional later); no PII in
  logs.
- **Done when:** users register/log in; cart + favorites bind to the account and
  merge correctly.

## 15H — Payment placeholder → real integration (later)
- **Goal:** introduce payment, starting as a guarded placeholder.
- **Scope (phase 1):** keep `Payment(status="placeholder")`; add the checkout
  payment step UI hook; no charges.
- **Scope (phase 2, dedicated):** integrate a hosted/tokenized provider;
  server-to-server signed webhooks set order `paid`; keys in secrets manager.
- **Запреты:** never store raw card data; never trust client "paid" callbacks;
  do not start phase 2 until phases 15A–15G are stable.
- **Done when (phase 1):** checkout has a clear placeholder payment step and
  orders remain unpaid until a real provider is added.

---

### Recommended first steps
Start with **15A → 15B → 15C**: stand up the toolchain, model + seed products,
then flip the catalog read path to the DB behind the existing `src/lib/catalog`
seam. This delivers a real backend-backed catalog with **zero UI change** and the
lowest risk, before touching cart/orders/auth.
