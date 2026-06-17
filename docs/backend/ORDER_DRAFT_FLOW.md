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
   slug), filtered to **`isPublished: true`** (visibility gate, Этап 26M) **and
   `status` in `PURCHASABLE_PRODUCT_STATUSES`** (availability gate, Этап 28A) —
   selecting price/name/sku/status.
4. Rejects any item that is missing or not purchasable (`isProductPurchasable`:
   non-available status such as `coming_soon`, or a null price). A
   published-but-`coming_soon` product can therefore never be ordered.
5. Recomputes `unitPrice` (DB minor units), `lineTotal = unitPrice * qty`, and
   `subtotalAmount` / `totalAmount` **on the server**. A tampered client price
   is impossible because the client price is never read.
6. Creates `Order` + `OrderItem[]` via a nested create (a single Prisma
   transaction), retrying only on the rare order-code collision.

Money is stored as integer **minor units (kopecks)**; the UI divides by 100.

**Purchasability policy (Этап 28A + 28B).** `src/lib/catalog/availability.ts` is the
single source of truth: `PURCHASABLE_PRODUCT_STATUSES` (only `available`) +
`isProductPurchasable(product)` = purchasable status **and** a real price **and**
in stock (`isInStock`). The client cart (`CartProvider`) uses it too — a
`coming_soon`, hidden, or **out-of-stock** item left in `localStorage` is shown as
**unavailable**, kept out of totals, never submitted, and removable (the same UX
as a hidden product from 26M).

**Inventory quantity (Этап 28B).** `Product.stockQuantity Int?`: `null` = NOT
tracked (legacy/demo, purchasable on status+price alone), `0` = out of stock,
`>0` = in stock. The order action validates stock and, inside the **same
transaction** as the order create, decrements each tracked line with a conditional
`updateMany(where stockQuantity >= qty)` — so stock **can never go negative** and
concurrent/duplicate submissions cannot oversell (a losing race rolls the whole
order back). Admin create/edit sets it via the «Остаток» field. **Product-level
only** — variant-level inventory and reservations/holds remain future stages.

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
- An order **leaves** the inbox as soon as its status changes — including the new
  manual fulfillment path below, so the owner clears it by **processing**, not only
  by cancelling.
- **No external notifications** (email/SMS/Telegram) and **no external API** — the
  owner sees new orders entirely inside the local admin. Push notifications remain
  a separate future stage.

## Manual fulfillment lifecycle (27E — processing/fulfillment v1)

- The `OrderStatus` enum gained two **additive** values: `processing` («В обработке»)
  and `completed` («Выполнен»). Checkout still creates `submitted`; only the admin
  moves an order forward, and only `submitted` counts as needs-attention.
- Allowed manual transitions (audited, enforced by `transitions.ts` + the status
  action): `submitted → processing → completed`, plus `submitted → cancelled` and
  `processing → cancelled`. `completed` and `cancelled` are **terminal**; backward
  or skip jumps (`submitted → completed`, `completed → processing`, …) are rejected.
- No payment/carrier automation — every move is a manual admin action. Payment-aware
  states (`paid` / `shipped` / `refunded` …) and notifications remain future stages
  (see `ORDER_LIFECYCLE_SPEC.md`).

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
