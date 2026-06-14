# AURELIA — Admin Order Management (Этап 17A; auth 18A)

A **local/dev-only** admin foundation for viewing and managing order drafts,
now behind a real local sign-in (Этап 18A).

## Access & safety

- Routes live under `/admin/orders` and are gated by **two** server-side checks,
  both re-run on every protected read and on the mutation action:
  1. `ensureLocalAdmin()` (`src/lib/admin/guard.ts`) — the local-only gate:
     blocked when `NODE_ENV === 'production'` → `notFound()`; allowed only when
     the request host is `localhost` / `127.0.0.1` / `::1`.
  2. `requireAdminSession()` (`src/lib/admin/auth.ts`) — identity: a valid signed
     session cookie, otherwise `redirect('/admin/login')`.
- Admin pages are **not linked from the public header/footer** and are
  `noindex`.
- Customer PII (name/phone/email) is selected only on the detail page, behind
  both checks — never rendered to an unauthenticated request.

## Admin auth (Этап 18A)

- **Sign-in:** `/admin/login` (server component + server action, no client JS).
  Credentials come from env; comparison is constant-time; errors are generic.
- **Session:** an `httpOnly`, `SameSite=Lax`, `path=/admin` cookie
  (`au_admin_session`), signed with HMAC-SHA256 (`ADMIN_SESSION_SECRET`) and
  carrying an expiry (12h). `secure` is set in production. Signature + expiry are
  verified on every protected read/mutation; tampering or expiry → no session.
- **Logout:** the admin bar (rendered by `app/admin/layout.tsx` when signed in)
  posts to `logoutAction`, which clears the cookie and redirects to login.
- **Env (names only — set in your gitignored `.env`, see `.env.example`):**
  `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET` (≥32 chars). If
  unset, sign-in fails closed and admin pages stay inaccessible.
- No customer accounts, no roles/audit log, no payment — those remain later
  stages.

## How to open it

```bash
npm run db:start      # AURELIA Postgres on 6700 (if not running)
npm run db:health
# Set ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET in .env first
npm run dev           # http://localhost:5000
```

Open **http://localhost:5000/admin/orders** → redirected to `/admin/login` →
sign in → back to the orders list.

## Orders list — `/admin/orders`

- Columns: order code (link), status badge, customer, city, item count, total,
  created date.
- **Filter** by status (`draft` / `submitted` / `cancelled`) and **search** by
  order code / customer name / phone (`?status=&q=`, a plain GET form).
- Empty state when there are no orders / no matches.

## Order detail — `/admin/orders/[orderCode]`

- Order contents (items: name, sku, unit price, qty, line total), subtotal/total.
- Customer (name/phone/email) and delivery (city/method) blocks.
- A note that **payment is not connected** (orders are drafts/demo).
- **Status change**: a `<form>` posting to the `updateOrderStatusAction` server
  action — updates ONLY the status, never items/prices/contact, never deletes.

## Data layer

`src/lib/admin/orders.ts` (server-only, Prisma):
- `getAdminOrders({ status, query })` — filtered/sorted list (max 200).
- `getAdminOrderByCode(orderCode)` — full detail incl. items.
- `updateAdminOrderStatus(orderCode, status)` — status-only update.

`src/lib/admin/actions.ts` (`'use server'`): re-checks the guard, validates the
status against the enum, updates, and `revalidatePath`s the admin pages.

## Verify

```bash
npm run db:verify:admin-orders
```
Read-only: counts orders, checks the `OrderStatus` enum, and reads one order by
code if any exist. No writes, no deletes, no raw SQL.

## Not in 18A

No admin users table/roles, no audit log, no rate limiting, no customer
accounts, no payment, no order deletion, no catalog/admin product tools. A
single env-based admin identity is intentional for this local foundation.
