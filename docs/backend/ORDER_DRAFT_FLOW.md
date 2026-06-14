# AURELIA — Order Draft Flow (Этап 16A)

How the checkout creates a persisted **draft order**. No payment, no auth, no
admin — a guest submits the form and the server stores a server-priced order.

## Overview

```
Checkout form (client)                Server action            PostgreSQL
─────────────────────────             ──────────────           ──────────
contact fields + cart                 createOrderDraft()
{ slug, qty }[]  ───────────────────▶ validate fields
                                      load products by slug ◀──▶ Product
                                      reject coming-soon / missing
                                      recompute prices (DB)
                                      create Order + items   ───▶ Order / OrderItem
                  ◀── { ok, orderCode } ──
clear cart, go to
/checkout/success?order=CODE
```

## What the client sends

Only **slugs + quantities** and the contact/delivery fields. The client never
sends prices, names or totals:

```ts
{ customerName, customerPhone, customerEmail?, deliveryCity,
  deliveryMethod, paymentMethod, items: [{ slug, qty }] }
```

## Server-side price integrity (anti-tampering)

`src/lib/orders/actions.ts` (`createOrderDraft`, a `'use server'` action):

1. Validates the contact fields with the shared rules in
   `src/lib/orders/validate.ts` (also used by the form for instant feedback).
2. Normalises items: quantity must be an integer **1–99**.
3. Loads the referenced products **from the DB** (`prisma.product.findMany` by
   slug) — selecting price/name/sku/status.
4. Rejects any item that is missing, `coming_soon`, or has a null price.
5. Recomputes `unitPrice` (DB minor units), `lineTotal = unitPrice * qty`, and
   `subtotalAmount` / `totalAmount` **on the server**. A tampered client price
   is impossible because the client price is never read.
6. Creates `Order` + `OrderItem[]` via a nested create (a single Prisma
   transaction), retrying only on the rare order-code collision.

Money is stored as integer **minor units (kopecks)**; the UI divides by 100.

## Data model (16A)

- **Order**: `orderCode` (unique, e.g. `AUR-1A2B3C4D`), `status`
  (`submitted` for new drafts), contact + delivery/payment placeholders,
  `subtotalAmount` / `totalAmount` (minor units), `currency`.
- **OrderItem**: immutable snapshot — `productSlug`, `productName`, `productSku`,
  `unitPrice`, `quantity`, `lineTotal`, nullable `productId` (survives product
  deletion).
- **OrderStatus** enum: `draft` / `submitted` / `cancelled` (only `submitted`
  is produced now).

## After success

- The cart is cleared **only after** the server confirms the order is persisted.
- The browser navigates to `/checkout/success?order=<code>`, a server component
  that reads the order summary by code (`src/lib/orders/read.ts`) — it shows the
  order code, line items and total, and intentionally **does not** show customer
  contact details (the code travels in the URL).

## Not in 16A

- No real payment (the order is a non-paid draft; `paymentMethod` is a
  placeholder). No auth / accounts. No admin order tools. No shipping/logistics.

## Verify

`npm run db:verify:orders` — non-destructive: counts orders/items and exercises
the create path inside a transaction that is always **rolled back** (no test
data committed; no `deleteMany`/raw SQL).

## Next

Payment integration (placeholder → real provider), customer auth + order
history, and admin order management — each a separate, reviewed stage.
