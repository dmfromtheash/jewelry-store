# Product Variants — Implementation SPEC (Этап 30A)

Status: **planning / docs-only**. No schema or app code changes in 30A.
Implementation is split into 30B → 30C → 30D (see §11). Variants stay **blocked
until 30B**.

This SPEC is the contract for adding selectable product variants (e.g. покрытие:
Позолота / Родирование / Сталь) without breaking the existing catalog, cart,
checkout, order snapshots, or inventory (26M / 27A–27E / 28A–28C / 29A).

---

## 1. Goal

Jewelry/accessory items are usually sold in **variants of the same design** —
different coating (позолота/родий/сталь), and later size/length. The customer
must be able to pick the exact variant, and the order must record **which**
variant was bought (price + stock can differ per variant).

**Product Variants v1 must support:**

- admin can create / edit / delete variants of a product;
- a product page shows a variant selector **when** the product has variants, and
  requires a choice before add-to-cart;
- a cart line records the chosen variant (product + variant), not just the slug;
- checkout/order snapshots the variant (id + human label + unit price), so the
  order stays correct even if the variant later changes or is deleted;
- a product **without** variants behaves exactly as it does today;
- existing localStorage carts and existing orders remain valid (no breakage).

---

## 2. Current State

### Schema (today)

`ProductVariant` is an **attribute-row** model — one row per selectable value:

```prisma
model ProductVariant {
  id        String   @id @default(cuid())
  productId String
  product   Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  name      String   // attribute name, e.g. "coating"
  value     String   // attribute value, e.g. "Позолота"
  sortOrder Int      @default(0)
  isDefault Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@unique([productId, name, value])
  @@index([productId])
}
```

- It exists and is linked to `Product` (M:1, cascade delete).
- It has `name`, `value`, `sortOrder`, `isDefault` — but **no** `price`/
  `priceDelta`, **no** `stockQuantity`, **no** `sku`, **no** `status`.
- Used **only** for `name: 'coating'` today. `src/lib/catalog/map.ts` flattens
  coating rows into `Product.coatings: string[]`; the seed creates them from
  `src/data/products.ts` `coatings`.

### Storefront / cart / order (today)

- `ProductInfo` (server component) renders the coatings as **decorative**
  buttons — `type="button"`, no client state, not wired to the cart.
  `AddToCartButton` takes **only** `slug`.
- `CartProvider` cart entry = `{ slug, qty }`, **keyed by slug** throughout
  (add/remove/increment/decrement/find). Persisted in `localStorage`
  (`aurelia-cart`). Resolves display + purchasability from the catalog snapshot.
- Checkout submits `items: lines.map(l => ({ slug, qty }))`.
- `createOrderDraft` builds `Map<slug, qty>`, fetches products by slug
  (`isPublished` + purchasable-status gate), snapshots `OrderItem`
  (`productId?`, `productSlug`, `productName`, `productSku?`, `unitPrice`,
  `quantity`, `lineTotal`), and decrements `Product.stockQuantity` (28B) inside
  one transaction; cancel restock (28C) re-increments `Product.stockQuantity`.
- `OrderItem` has **no** `variantId` and **no** variant snapshot fields.

### Guards that variants MUST NOT break

26M visibility (`isPublished`), 28A purchasable status, 28B product stock,
28C restock-on-cancel, 27A UAH baseline, 27B payment/delivery, 27E lifecycle,
29A multi-image gallery, server-authoritative pricing (client never sends price).

---

## 3. Chosen v1 Scope

Minimal, single-axis variants with safe fallback:

- **Single attribute group per product** (e.g. «Покрытие»). Multiple values
  (rows) under one `name`. No multi-axis combination matrix in v1.
- Admin can **create / edit / delete** variant rows and set optional
  `priceDelta`, `stockQuantity`, `sku` per variant.
- Product page shows a **working** selector only when the product has variants;
  it pre-selects the `isDefault` row (or the first by `sortOrder`).
- Add-to-cart for a variant product carries the chosen `variantId`; cart line
  identity becomes **(slug, variantId)**.
- Checkout/order snapshots the variant: `OrderItem.variantId?` +
  `variantName?`/`variantValue?` + a unit price that already includes
  `priceDelta`.
- **Product without variants = unchanged** (variantId omitted end-to-end).
- **Backward compatibility (critical):** a cart/checkout line **without** a
  variantId for a product that *does* have variants resolves to the product's
  **default variant** (never rejected). Existing localStorage carts and existing
  orders (no variantId) therefore stay valid.
- No `ProductCard` visual redesign; reuse existing `.au-variant*` styles for the
  selector.
- No complex option matrix; no barcode/fiscalization; no payment/delivery/
  provider changes.

---

## 4. Out of Scope (v1)

- Variant-level media gallery (variants reuse the product's images — 29A).
- Multi-axis option matrix (coating × size × length) — the row model can carry
  more `name` groups later, but v1 selects **one** group only.
- Reservations / holds.
- Warehouse / location / multi-stock model.
- Payment/delivery provider integration.
- Customer account.
- Any visual redesign (cards, gallery, placeholder, spacing, colors, type).

---

## 5. Data Model Plan (additive-only; lands in 30B)

The existing row model is enough for single-axis selection. Two **additive,
non-destructive** migrations (all new columns nullable / defaulted):

**`ProductVariant` (+):**
- `priceDelta Int?` — minor units (kopecks) added to the product price; `null`/0
  = same as product price. Keeps pricing server-authoritative.
- `stockQuantity Int?` — variant-level stock. `null` = NOT tracked at the
  variant level → **falls back to product stock** (28B semantics). `0` = out of
  stock, `>0` = on hand.
- `sku String?` — optional variant SKU (snapshotted onto the order line).

**`OrderItem` (+):**
- `variantId String?` — loose id (nullable, **no hard FK / no cascade**) so the
  order survives variant deletion, exactly like `productId?` today.
- `variantName String?` — attribute name snapshot, e.g. "coating" / "Покрытие".
- `variantValue String?` — attribute value snapshot, e.g. "Позолота".

**Compatibility:**
- Existing `ProductVariant` rows: new columns are null/0 → behave as "no delta,
  not tracked, no sku" — identical to today.
- Existing `Order`/`OrderItem` rows: `variantId`/`variantName`/`variantValue`
  stay null → render as a plain (no-variant) line, unchanged.
- No column drops, no type changes, no data rewrite. `npx prisma migrate dev`
  with additive fields only; verify the generated SQL is `ALTER TABLE … ADD
  COLUMN` only before applying.

---

## 6. Cart & Checkout Plan

**Cart line identity → (slug, variantId).**
- `CartEntry` gains optional `variantId?: string`. Line identity key becomes
  `` `${slug}::${variantId ?? ''}` `` so the same product in two coatings are two
  lines. add/remove/increment/decrement switch from slug-equality to
  composite-key equality.
- `readStorage()` accepts entries with or without `variantId` → **old carts load
  unchanged** (variantId undefined).

**Old entries without variantId.**
- Product has no variants → behaves exactly as today.
- Product has variants → resolved to the **default variant** for display and
  submission (never dropped). Storefront may also surface a gentle "выберите
  покрытие" prompt, but the default keeps it orderable.

**Checkout validation (server, `createOrderDraft`).**
- Item input gains optional `variantId`. The server, per line:
  1. fetches the product (existing `isPublished` + purchasable-status gate, 28A);
  2. if the product has variants: resolve the variant by `variantId`; if missing
     → use the product's `isDefault` variant (fallback); the variant **must**
     belong to that product (else reject `product_unavailable`);
  3. compute `unitPrice = product.price + (variant.priceDelta ?? 0)`
     (server-authoritative; client never sends price);
  4. snapshot `variantId`/`variantName`/`variantValue`/variant `sku` onto the
     `OrderItem`.
- A `variantId` that doesn't belong to the product, or a variant of an
  unpublished/non-purchasable product, is rejected — same failure path as a bad
  slug today.

**Preserved guards:** 26M hidden, 28A coming_soon, stock-0 (see §7), 27A UAH,
27B payment/delivery, 27E lifecycle — all unchanged; variant logic sits *inside*
the existing per-line loop and transaction.

---

## 7. Inventory Plan

Product stock (28B) stays the **fallback**; variant stock is opt-in:

- **Decrement (checkout):** if the chosen variant has `stockQuantity != null`,
  decrement the **variant** stock (same race-safe conditional
  `updateMany(where stockQuantity >= qty)`). If variant stock is `null`, fall
  back to decrementing **product** stock (28B) exactly as today.
- **Purchasability:** out-of-stock check uses the variant stock when tracked,
  else the product stock. `null` at both levels = untracked = purchasable on
  status+price alone.
- **Restock on cancel (28C):** mirror the decrement target — if
  `OrderItem.variantId` is set and that variant is stock-tracked, re-increment
  the **variant**; else re-increment the **product**. The existing
  count-guarded, transactional, no-double-restock design (28C) is reused; the
  only change is *which* row gets the increment.
- Deleted variant on a cancelled order → nothing to restock (loose id), same as
  a deleted product today.

v1 may ship variant stock as **tracked-but-optional**: a variant with null stock
simply uses product stock, so admins can adopt variant stock incrementally.

---

## 8. Admin Plan (lands in 30C)

Reuse the existing admin form/table patterns (`.au-adm-*`, `.au-field`,
`.au-btn`); **no redesign**.

- On the product **edit** page (where the 29A gallery section already lives), add
  a «Варианты» card:
  - lists current variants (name, value, priceDelta, stock, sku) in an
    `.au-adm-table`;
  - add-variant inline form (name/value required; priceDelta/stock/sku optional);
  - edit-variant (small inline form per row, or an edit route reusing the form);
  - delete-variant button (cascade-safe; removing a variant must not touch
    `OrderItem` snapshots — they keep their copied values).
- Server actions in `src/lib/admin/catalog-actions.ts`
  (`addVariantAction` / `updateVariantAction` / `deleteVariantAction`): local
  admin guard + session, `recordAuditEvent`, `revalidateStorefront`. Validate
  `priceDelta`/`stock` as integers; respect `@@unique([productId, name, value])`
  (friendly duplicate error).
- Mark exactly one `isDefault` per attribute group (default the first if none).

---

## 9. Storefront Plan (lands in 30D)

- Product page variant selector reuses the existing `.au-variant`/`.au-variant-
  row` markup, but becomes **interactive**: a small client component holds the
  selected `variantId`, toggles `is-active`, and feeds it to `AddToCartButton`.
  This converts the currently-decorative selector into a real one **without
  changing its look**.
- Price display may reflect the selected variant's `priceDelta` (optional in v1;
  if deferred, show the base price and let the server compute the exact unit
  price — never trust client price).
- **Product without variants:** selector not rendered; add-to-cart works exactly
  as today (no variantId).
- **Add-to-cart requires a variant** only when the product has variants; the
  default is pre-selected so it's always satisfiable (and old carts fall back to
  default — §6).
- `ProductCard` and gallery visuals are untouched.

---

## 10. Verify / Test Plan

Add `db:verify:product-variants` (mirrors server logic on throwaway
`zzz-verify-variant-` rows; no seed/reset/drop), asserting at minimum:

- a product **without** variants still orders + decrements product stock (28B);
- a variant product resolves a **valid** variant and snapshots it on the
  `OrderItem` (`variantId`/`variantName`/`variantValue`/unitPrice incl.
  priceDelta);
- a `variantId` not belonging to the product is **rejected**;
- a missing `variantId` on a variant product **falls back to the default**
  variant (not rejected) — backward compatibility;
- variant stock decrements when tracked; **product stock** decrements when
  variant stock is null (fallback);
- cancel restocks the **correct** level (variant vs product), with no double
  restock (28C);
- 26M hidden / 28A coming_soon / stock-0 guards still reject;
- 27A UAH + 27B payment/delivery preserved on a variant order;
- an **old-shape** cart line (no variantId) degrades safely.

Keep green (re-run): `db:verify:inventory`, `db:verify:inventory-lifecycle`,
`db:verify:order-lifecycle`, `db:verify:checkout-options`,
`db:verify:product-availability`, `db:verify:catalog-crud`,
`db:verify:catalog-gallery`, `db:verify:runtime`, `db:verify:currency`.

---

## 11. Implementation Split

- **30B — Data model + server/order/inventory + verify foundation**
  Additive migrations (§5), `prisma generate`, `createOrderDraft` variant
  resolution/validation/pricing, variant-vs-product decrement + 28C restock,
  `OrderDraftItemInput.variantId?`, `db:verify:product-variants`. **No UI.**
- **30C — Admin variant management**
  Admin read + `add/update/deleteVariantAction`, «Варианты» card on the product
  edit page, audit + revalidation. Existing patterns only.
- **30D — Storefront selector + cart + checkout integration**
  Interactive variant selector (client), cart line `variantId` (composite
  identity + old-cart fallback), checkout passes `variantId`. No redesign.

This order is safest: the DB/server contract (30B) is provable by verify scripts
before any admin or storefront wiring exists, and each stage stays one commit.

---

## 12. Acceptance Criteria

**30B (foundation):**
- [ ] Additive-only migration applied (ADD COLUMN only); `npx prisma validate`
      green; existing rows/orders unaffected.
- [ ] `createOrderDraft` accepts optional `variantId`, resolves/validates it,
      computes server-side unit price incl. `priceDelta`, snapshots variant.
- [ ] Variant stock decrements when tracked; product stock when not (fallback).
- [ ] Cancel restocks the correct level; no double restock.
- [ ] `db:verify:product-variants` passes; all prior verify scripts stay green.
- [ ] No UI/admin changes; typecheck + build green.

**30C (admin):**
- [ ] Admin can add/edit/delete variants with optional priceDelta/stock/sku.
- [ ] Duplicate (productId,name,value) handled with a friendly error.
- [ ] Audit + revalidation fire; deleting a variant never alters order snapshots.
- [ ] No design changes; existing patterns/classes only.

**30D (storefront):**
- [ ] Variant product shows a working selector (existing styles), default
      pre-selected; variant-less product unchanged.
- [ ] Add-to-cart carries `variantId`; cart shows variant per line; two coatings
      = two lines.
- [ ] Old localStorage carts load and order without error (default fallback).
- [ ] Checkout submits `variantId`; order detail shows the variant snapshot.
- [ ] No `ProductCard`/gallery/placeholder visual change; build green.

---

_See also: `docs/backend/DATA_MODEL.md` (ProductVariant / OrderItem),
`docs/backend/ORDER_DRAFT_FLOW.md` (checkout + inventory), and the 28B/28C/29A
notes for the guards this feature must preserve._
