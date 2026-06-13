# AURELIA — API Plan (Этап 14A)

> Specification only — **no code, no routes implemented**. Describes future
> Route Handlers (public JSON) and Server Actions (mutations from the UI).
>
> Convention:
> - **Read / public, cacheable** → Route Handler `GET /api/...` (or RSC data fn).
> - **Mutation tied to a form/click** → Server Action.
> - All money is server-computed. All inputs are validated server-side (zod).
> - Errors return a typed shape `{ error: { code, message } }`.

## Catalog (public, read)

| Method | Path / Action | Purpose | Notes |
| --- | --- | --- | --- |
| GET | `/api/products` | list products | query: `category, status, sort, q, page` |
| GET | `/api/products/[slug]` | product detail | 404 if missing |
| GET | `/api/categories` | list categories | for nav + filters |
| GET | `/api/search` | search results | `q, sort, status`; mirrors `searchProducts` |

These back the existing `src/lib/catalog` functions. Initially the data layer
may still read the mock array; the HTTP/RSC seam stays stable.

## Cart (mutation, guest or user)

| Action | Purpose | Input | Server rules |
| --- | --- | --- | --- |
| `cart.get` | load current cart | guest token / session | returns lines with **server prices** |
| `cart.addItem` | add product | `{ slug, qty }` | validate product exists & purchasable |
| `cart.updateQty` | set qty | `{ slug, qty }` | qty>=1, else remove |
| `cart.removeItem` | remove line | `{ slug }` | — |
| `cart.clear` | empty cart | — | — |
| `cart.merge` | merge guest → user on login | local entries | dedupe, sum qty |

Replaces `CartProvider` localStorage logic; the provider keeps its API
(`addItem/removeItem/increment/decrement/clear`) but calls server actions.

## Favorites (mutation, user)

| Action | Purpose | Input |
| --- | --- | --- |
| `favorites.list` | user favorites | — |
| `favorites.toggle` | add/remove | `{ slug }` |
| `favorites.merge` | merge local slugs on login | `slug[]` |

Guests keep `localStorage`; on login, local favorites merge into the account.

## Checkout & Orders (mutation)

| Action | Purpose | Input | Server rules |
| --- | --- | --- | --- |
| `checkout.createDraft` | build an order draft from cart | cart id | recompute totals server-side |
| `checkout.updateContact` | save contact/delivery to draft | `{ name, phone, email, city, delivery }` | validate, never trust client totals |
| `order.create` | finalize draft → order | draft id | re-validate stock + price, set `pending` |
| `order.get` | fetch order (owner only) | order id | authz: owner or admin |

First backend cycle stops at `order.create` with **no real payment**; a
`Payment(status="placeholder")` is attached.

## Auth / Session

| Action | Purpose | Input |
| --- | --- | --- |
| `auth.register` | create user | `{ email, password }` |
| `auth.login` | start session | `{ email, password }` |
| `auth.logout` | end session | — |
| `auth.me` | current user | — |

Wires the existing login/register modals to a real session (httpOnly cookie).
Rate-limited; see `SECURITY_NOTES.md`.

## Admin (protected, role-gated)

| Method | Path / Action | Purpose |
| --- | --- | --- |
| GET/POST/PATCH/DELETE | `admin.products.*` | product CRUD |
| GET/PATCH | `admin.categories.*` | category management |
| GET/PATCH | `admin.orders.*` | list / update order status |
| (later) | `admin.variants.*`, `admin.images.*` | variant + image management |

Every admin mutation writes an `AuditLog`. Admin auth is **separate** from
customer auth.

## Info pages

- Stay static (`src/data/info-pages.ts`). No API initially.
- Optional later: `GET /api/info/[slug]` if moved to DB/CMS.

## Cross-cutting

- **Validation:** every action validates input with a schema before touching the
  DB. Reject unknown fields.
- **Pricing:** the server recomputes `subtotal/total` from DB on every cart and
  order operation; client-sent prices are ignored.
- **Pagination:** list endpoints accept `page`/`pageSize`, return `total`.
- **Idempotency:** `order.create` is idempotent per draft to avoid double orders.
