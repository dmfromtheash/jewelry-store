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
show inline confirmation
(client state), clear cart
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

## After success (27C — order confirmation)

- `CheckoutPageClient` renders an **inline confirmation from client state**: the
  `orderCode` returned by the action plus the payment/delivery method + optional
  `deliveryDetails` the customer just submitted (labelled via
  `src/lib/orders/methods.ts`). The copy is honest about the manual payment path
  (`manual_online` → manager sends details; `cash_on_delivery` → pay on receipt).
- The cart is **cleared only after** the server confirms the order is persisted,
  so the same cart can't be re-submitted.
- **No by-code public order lookup.** The confirmation needs no DB read, so no
  order contents are fetched by a guessable code and no PII is exposed.
  `/checkout/success?order=<code>` remains only as a **safe static fallback**
  (direct hit / refresh): it performs **no database lookup** — at most it echoes
  the code already present in the URL. The old `src/lib/orders/read.ts`
  (`getOrderSummaryByCode`) was removed.

## Admin new-orders inbox (27D — owner attention v1)

- Every storefront order is created as **`submitted`**, so that status doubles as
  the **"needs attention"** inbox: orders the owner hasn't actioned yet.
- `/admin/dashboard` shows a **«Новые заказы»** KPI (count of `submitted`) + a CTA
  to the filtered list; `/admin/orders` shows a needs-attention count with a
  **«Показать только новые»** quick filter (`?status=submitted`). No schema change
  — both are reads over the existing status (`getNeedsAttentionOrderCount`).
- An order **leaves** the inbox as soon as its status changes (today the available
  move is `submitted → cancelled`; a dedicated "fulfilled/processed" status is a
  future lifecycle stage, see `ORDER_LIFECYCLE_SPEC.md` §5).
- **No external notifications** (email/SMS/Telegram) and **no external API** — the
  owner sees new orders entirely inside the local admin. Push notifications remain
  a separate future stage.

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
