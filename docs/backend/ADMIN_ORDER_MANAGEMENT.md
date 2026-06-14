# AURELIA — Admin Order Management (Этап 17A)

A **local/dev-only** admin foundation for viewing and managing order drafts.
This is NOT production-ready admin — there is no real authentication yet.

## Access & safety

- Routes live under `/admin/orders` and are gated by `ensureLocalAdmin()`
  (`src/lib/admin/guard.ts`):
  - blocked entirely when `NODE_ENV === 'production'` → `notFound()`;
  - allowed only when the request host is `localhost` / `127.0.0.1` / `::1`.
- Admin pages are **not linked from the public header/footer** and are
  `noindex`.
- Customer PII (name/phone/email) is selected only on the detail page, behind
  the guard.
- A real admin auth system (AdminUser / roles / sessions) is a later stage. Until
  then, do **not** expose these routes publicly or deploy them.

## How to open it

```bash
npm run db:start      # AURELIA Postgres on 6700 (if not running)
npm run db:health
npm run dev           # http://localhost:5000
```

Then open **http://localhost:5000/admin/orders**.

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

## Not in 17A

No real auth/login, no admin users/roles, no payment, no order deletion, no
catalog/admin product tools. Next: customer/admin auth + protecting these routes
before any non-local exposure.
