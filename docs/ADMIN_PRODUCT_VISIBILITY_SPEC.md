# Admin Product Visibility / Archive — SPEC (Этап 26K)

> **Status:** docs-only SPEC / data-model planning. No code, no schema, no
> migration, no seed. This document plans the safe way for the store owner to
> remove a product from the storefront **before** any implementation.
>
> **Design is out of scope.** Nothing here changes the storefront design, cards,
> placeholders, CSS, or layout.

---

## 1. Purpose

Today the owner can **create** and **edit** products (26I) and an admin-created
slug serves at runtime (26J). The one safe operation still missing is **taking a
product off the storefront** — either temporarily (hide / unpublish) or
permanently (archive / soft-delete).

We need a visibility/archive model *before* we ever consider a hard `DELETE`,
because:

- a hard delete is irreversible and easy to trigger by accident;
- a hard delete can break — or visibly degrade — order history;
- "hide from storefront" and "delete forever" are two different intentions and
  should not be the same button.

This SPEC defines the data model, storefront behavior, admin behavior, migration
plan, and verification plan so the next stage can implement visibility safely.

---

## 2. Current repo reality

Described honestly from the code as it exists at commit `3a9a2f6`.

### 2.1 What `ProductStatus` exists today

`prisma/schema.prisma`:

```prisma
enum ProductStatus {
  available
  coming_soon
}

model Product {
  ...
  status   ProductStatus @default(available)
  price    Int?          // minor units; null allowed for coming_soon
  ...
  @@index([categoryId])
  @@index([status])
}
```

So there are exactly **two** statuses: `available` and `coming_soon`. There is
**no** `archived` value, **no** `isPublished` field, **no** `isArchived` /
`archivedAt` / `publishedAt` field. There is no concept of "hidden".

### 2.2 How products reach the storefront

All storefront reads go through `src/lib/catalog/server.ts` and **none of them
filter by status or visibility** — they return every `Product` row:

- `getAllProductsFromDb()` → home (`app/page.tsx`) + client catalog snapshot
  (`getCatalogSnapshotForClient`, hydrated into `app/layout.tsx` → search,
  cart, favorites, recently-viewed).
- `getProductsByCategorySlugFromDb(slug)` → `app/category/bijouterie` and
  `app/category/gifts` (and "similar" on the PDP).
- `getProductBySlugFromDb(slug)` → `app/product/[slug]/page.tsx`
  (`dynamicParams = true`; unknown slug → `notFound()`).
- `getAllProductSlugsFromDb()` → `generateStaticParams` for prerendered PDPs.

**Conclusion: every product in the DB is publicly visible.** The only
differentiation is `status`:

- `available` → buyable card (`canBuy = status === 'available' && !!slug` in
  `src/components/product/ProductCard.tsx`).
- `coming_soon` → still rendered in lists, still has a PDP, just not buyable.

`coming_soon` is therefore a *marketing/teaser* state, **not** a hide state.

### 2.3 How `OrderItem` stores its snapshot

`OrderItem` (in `prisma/schema.prisma`) is an **immutable line snapshot** taken
at order time:

```prisma
model OrderItem {
  ...
  productId   String?  // nullable → order survives product deletion
  productSlug String
  productName String
  productSku  String?
  unitPrice   Int      // minor units snapshot
  quantity    Int
  lineTotal   Int
  ...
}
```

Crucially: `productName`, `productSlug`, `productSku`, and `unitPrice` are all
**copied** onto the order line. `productId` is **nullable** and has **no FK
relation** to `Product` in the schema (it is a loose id, like analytics). So an
order's *displayed* content does not depend on the `Product` row still existing.

### 2.4 Why hard delete is dangerous

Even with the snapshot above, a hard `DELETE` of a `Product` is the wrong first
tool:

1. **Irreversible.** A misclick erases the catalog entry, its variants, and its
   images (`onDelete: Cascade` on `ProductVariant` / `ProductImage`), plus the
   uploaded files on disk. There is no undo.
2. **Loses catalog truth.** Re-creating the product later means a new id, new
   audit lineage, and no link back to past orders.
3. **Operational risk.** "Remove from shop for now" (seasonal, out of stock,
   re-shoot photos) is a *frequent* need; "destroy forever" is a *rare* one.
   Making the frequent action destructive guarantees accidents.
4. **Analytics drift.** `AnalyticsEvent.productId` references survive deletion by
   design, but the product they point at no longer resolves to a catalog row.

The snapshot protects *order display*, but it does not make destruction safe or
reversible. We want **hide/restore** as the everyday tool and treat any true
delete as a separate, later, guarded decision.

---

## 3. Problem

- The admin **can** create and edit a product, **but cannot hide it** from the
  storefront. The only lever is `available ↔ coming_soon`, and both states are
  fully visible.
- A hard delete is **not** an acceptable first step (Section 2.4).
- `coming_soon` ≠ archived. `coming_soon` means "shown, teased, not buyable
  yet"; archived means "gone from the shop".
- `available` and `coming_soon` are **both visible**, so neither can express
  "remove from the shop".

Net: there is no safe, reversible way for the owner to pull a product off the
storefront while keeping catalog truth and order history intact.

---

## 4. Options considered

### Option A — Add `ProductStatus.archived`

Add a third enum value; storefront reads exclude `archived`.

- **Pros:** small surface; one field already indexed (`@@index([status])`);
  storefront filter is a single `where`.
- **Cons:** conflates two orthogonal axes — *buyable?* (`available` vs
  `coming_soon`) and *visible?* (shown vs hidden). A product can legitimately be
  "coming soon AND hidden" or "available AND hidden"; an enum cannot express
  both at once. Archiving a `coming_soon` product loses its prior status.
- **Storefront impact:** every read must add `status: { not: 'archived' }`.
- **Admin impact:** restore must guess whether to return to `available` or
  `coming_soon` (information was overwritten).
- **Migration complexity:** low (enum value + index already present), BUT enum
  changes in Postgres are slightly more involved than a boolean column.
- **Risks:** status overloading; lossy restore; future "draft" state makes the
  enum grow unbounded.

### Option B — Add `boolean isPublished`

A visibility flag orthogonal to `status`. `isPublished = false` hides the product
everywhere on the storefront; `status` keeps meaning buyable-vs-teaser.

- **Pros:** clean separation of concerns (visible vs buyable); reversible with no
  information loss (status is untouched); trivial mental model for the owner
  ("Показать / Скрыть"); cheap query (`where: { isPublished: true }`).
- **Cons:** a boolean alone records *what* but not *when/why*; doesn't by itself
  distinguish "temporarily hidden" from "archived forever".
- **Storefront impact:** add `isPublished: true` to the storefront `where`
  clauses; admin reads stay unfiltered.
- **Admin impact:** add a hide/show toggle; admin list shows all, flags hidden
  rows.
- **Migration complexity:** low — add a `Boolean @default(true)` column +
  index; existing rows default to published (no behavior change).
- **Risks:** minimal. If we *also* want a hard "archive" tier later, a boolean
  doesn't cover it on its own (see D / recommendation).

### Option C — Add `boolean isArchived`

A soft-delete flag. `isArchived = true` removes the product from the storefront
and (optionally) from the default admin list.

- **Pros:** expresses *soft delete / restore* directly; reversible; keeps the row
  and order links intact.
- **Cons:** semantically this is "deleted-but-recoverable", which is a heavier,
  rarer action than "temporarily hide". Using it for everyday hiding muddies the
  meaning. No timestamp/actor without an extra field.
- **Storefront impact:** add `isArchived: false` to storefront `where` clauses.
- **Admin impact:** archive/restore actions; archived rows likely filtered out of
  the main list (need a "show archived" view).
- **Migration complexity:** low — same shape as B.
- **Risks:** if used as the *only* lever, the owner has no lightweight "hide for
  a week" option distinct from "archive".

### Option D — Add `publishedAt` / `archivedAt` (nullable timestamps)

Model visibility/archival as nullable `DateTime`s instead of booleans.
Visible = `archivedAt == null` (and optionally `publishedAt <= now`).

- **Pros:** records *when* it happened (useful for audit/reporting); supports
  future scheduled publishing (`publishedAt` in the future); reversible
  (null the field).
- **Cons:** more logic on every read (now-comparisons, null handling); easy to
  get subtly wrong; over-engineered for a small shop that just needs
  show/hide today.
- **Storefront impact:** reads grow a date condition; risk of timezone/now bugs.
- **Admin impact:** richer but heavier UI; scheduling UI is extra scope.
- **Migration complexity:** low to add columns, higher to get the read logic and
  tests right.
- **Risks:** complexity now for features (scheduling) not yet requested.

### Option E — Hard delete only

Keep the schema; implement a destructive `DELETE` action.

- **Pros:** nothing to add to the schema.
- **Cons:** irreversible; the everyday "remove for now" need becomes a
  destructive action (Section 2.4); cascades drop variants/images + disk files;
  loses catalog lineage.
- **Storefront impact:** product disappears (and its prerendered/revalidated PDP
  must be invalidated and then 404).
- **Admin impact:** needs a strong confirmation; no restore.
- **Migration complexity:** none.
- **Risks:** **highest.** Rejected as a first step.

---

## 5. Recommended model

**Recommended for AURELIA v1 (26L): Option B — `boolean isPublished` (default
`true`)** as the everyday visibility lever, with `isArchived` (Option C)
explicitly **deferred** to a later, separately-guarded archive stage.

Rationale for a small shop:

- The frequent, real need is **"hide / show"**, not "destroy". A boolean toggle
  is the simplest correct model the owner can reason about (Показать / Скрыть).
- It is **fully reversible** and **lossless**: `status` (available vs
  coming_soon) is preserved, so restoring a product brings back exactly its
  prior buyable state — unlike Option A.
- It is **orthogonal**: visibility and buyability are independent axes, which the
  current enum cannot represent together.
- It is **cheap and safe to migrate**: one `Boolean @default(true)` column means
  every existing product stays visible with zero behavior change.
- Hard delete (Option E) stays off the table; soft archive (Option C) can be
  layered on later as a second, more guarded tier (e.g. `isArchived` +
  `archivedAt`) **without** redoing `isPublished`.

Timestamps (Option D) are **not** adopted now: scheduled publishing isn't a
requested feature, and now-comparison logic adds bug surface for no v1 benefit.
If audit-of-when is wanted, the existing `AdminAuditLog` already records the
event with `createdAt` + actor — no schema timestamp required for v1.

> **Single-sentence recommendation:** add `Product.isPublished Boolean
> @default(true)` (indexed), filter storefront reads to published-only, give the
> admin a hide/show toggle with audit, and defer hard delete and any
> `isArchived`/`archivedAt` tier to a later guarded stage.

---

## 6. Storefront behavior (planned)

- **Home / category / search / similar / client snapshot:** show **only**
  `isPublished = true` products. Concretely, the storefront read helpers in
  `src/lib/catalog/server.ts` (`getAllProductsFromDb`,
  `getProductsByCategorySlugFromDb`, `getAllProductSlugsFromDb`,
  `getCatalogSnapshotForClient`) gain a `where: { isPublished: true }`.
  `coming_soon` published products keep their current "teaser, not buyable"
  rendering — visibility is independent of buyability.
- **`/product/[slug]` of a hidden product:** treat as not available →
  `notFound()` (same path as an unknown slug). `getProductBySlugFromDb` should
  return `null` for unpublished products so the PDP 404s. (Decision to confirm in
  26L: a plain 404 is simplest and consistent; no separate "hidden" page is
  needed.)
- **Admin visibility:** the admin **must** see hidden products (otherwise it
  can't restore them). Admin reads in `src/lib/admin/catalog.ts`
  (`getAdminProductsForImages`, `getAdminProductForEdit`) stay **unfiltered** and
  surface the published/hidden state in the list.
- **Cached / revalidated paths:** hiding/showing must `revalidatePath` exactly
  the surfaces the existing image/CRUD actions already revalidate
  (`revalidateStorefront` in `catalog-actions.ts`: `/`, `/category/bijouterie`,
  `/category/gifts`, `/search`, `/product/<slug>`, and the admin catalog path).
  Because `generateStaticParams` would no longer emit a hidden slug, its
  prerendered PDP must be revalidated so it flips to 404; with
  `dynamicParams = true` a restored slug renders again on demand.

---

## 7. Admin behavior (planned)

- **Where:** in the existing `/admin/catalog` table (`app/admin/catalog/page.tsx`)
  — add a visibility indicator column/badge and a hide/show control per row,
  built from the existing admin primitives. **No redesign, no new layout.** The
  edit form (`app/admin/catalog/_components/ProductForm.tsx`) may also surface the
  flag, but the table toggle is the primary control.
- **Actions needed** (new server actions in
  `src/lib/admin/catalog-actions.ts`, mirroring the existing
  guard+session+audit+revalidate pattern):
  - `hideProductAction` — set `isPublished = false`.
  - `showProductAction` (restore visibility) — set `isPublished = true`.
  - (Both re-run `ensureLocalAdmin()` + `requireAdminSession()` first, exactly
    like the current image/CRUD actions.)
- **Confirmations:** hide is reversible, so a lightweight inline confirm (or a
  distinct, clearly-labeled button) is enough — **no** destructive-style modal.
  (Any *future* hard delete WILL require a strong typed confirmation; out of
  scope here.)
- **Audit events:** add stable identifiers to `AUDIT_ACTIONS` in
  `src/lib/admin/audit.ts`, e.g. `admin.product.hidden` /
  `admin.product.shown` (with Russian labels in `AUDIT_ACTION_LABELS`), recorded
  via `recordAuditEvent` with `entityType: 'product'`, `entityId: slug`, and a
  safe summary. No PII.
- **Edit vs hide vs restore — keep them distinct:**
  - *Edit* = change fields (existing `updateProductAction`); never silently
    changes visibility.
  - *Hide* = `isPublished = false`; reversible; keeps `status` and all data.
  - *Restore* = `isPublished = true`; brings the product back exactly as it was.
  - Visibility actions must **not** be entangled with the edit form submit, so
    saving an edit never accidentally hides/shows a product.

---

## 8. Data migration plan (planned — NOT implemented here)

- **New field:** `Product.isPublished Boolean @default(true)`.
- **Default for existing rows:** `true` — every current product stays visible, so
  the migration is behavior-preserving (no surprise hiding on deploy).
- **Indexes:** add `@@index([isPublished])` (or a composite
  `@@index([isPublished, categoryId])`) since storefront reads will filter on it.
  Confirm against actual query shapes in 26L before committing the exact index.
- **Seed impact:** `prisma/seed.ts` needs no change — the column defaults to
  `true`; optionally make the seed explicit for clarity. Seed stays idempotent;
  **no reset/drop**.
- **Rollback considerations:** the migration is additive (new column with a
  default), so forward-deploy is safe. Rolling back the *code* while keeping the
  column is harmless (old code ignores the column). Dropping the column in a down
  migration is only safe once no code references it. No data is destroyed either
  way.
- **Deferred (NOT in 26L):** a second archive tier (`isArchived` +
  `archivedAt`) and any hard-delete path — each its own future migration + SPEC.

---

## 9. Verify / testing plan (planned)

A new verify script (e.g. `prisma/verify-catalog-visibility.ts`, wired as
`db:verify:catalog-visibility`) following the existing self-cleaning pattern of
`verify-catalog-crud.ts` — operate only on a throwaway `zzz-verify-*` slug,
clean up in `finally`, never touch real rows, **no reset/seed/drop**:

- **Hide removes from storefront lists:** a hidden product is absent from the
  published-filtered reads (all/category/snapshot/slug list).
- **Hidden product direct PDP:** `getProductBySlugFromDb(hiddenSlug)` returns
  `null` (→ PDP 404s).
- **Restore returns the product:** after `isPublished = true`, it reappears in
  lists and `getProductBySlugFromDb` resolves it again, with the **same**
  `status` it had before hiding (lossless restore).
- **Admin still sees it:** admin reads (`getAdminProductsForImages` /
  `getAdminProductForEdit`) return the product in both states.
- **Order snapshots intact:** hiding/showing a product does not alter any
  `OrderItem` snapshot fields (`productName` / `unitPrice` / etc.).
- **Audit events written:** `admin.product.hidden` / `admin.product.shown` rows
  exist with correct actor/entity and no PII.
- **DB verify scripts:** `npm run db:verify` (catalog) continues to pass
  unchanged.

---

## 10. What NOT to do

- **No hard delete as the first step.** Hide/restore is the everyday tool;
  destruction is a separate, later, guarded decision.
- **No design changes.** No storefront cards/placeholder/CSS/layout changes; no
  `docs/design/*` edits. Admin UI reuses existing primitives only.
- **No payment / delivery / customer-account / notifications scope.**
- **No seed / reset / drop.** Migration is additive; seed stays idempotent.
- **No archive without audit.** Every visibility change records an audit event.
- **No touching dm-bot's PostgreSQL on `localhost:5432`.** AURELIA DB is port
  `6700` only.

---

## 11. Recommended next implementation stage

### Этап 26L — Admin Product Visibility v1

- **Scope:** add `Product.isPublished` (default `true`, indexed); filter
  storefront reads to published-only; add `hide`/`show` admin actions
  (guard + session + audit + revalidate); add a visibility badge + toggle to the
  `/admin/catalog` table; PDP of a hidden product → `notFound()`; add a
  self-cleaning visibility verify script. **No design changes. No hard delete.**
- **Files likely changed:**
  - `prisma/schema.prisma` (+ one additive migration) — `isPublished` field +
    index.
  - `src/lib/catalog/server.ts` — `where: { isPublished: true }` on storefront
    reads.
  - `src/lib/admin/catalog.ts` — surface `isPublished` in admin reads.
  - `src/lib/admin/catalog-actions.ts` — `hideProductAction` /
    `showProductAction` (+ reuse `revalidateStorefront`).
  - `src/lib/admin/audit.ts` — new `AUDIT_ACTIONS` + labels.
  - `app/admin/catalog/page.tsx` — visibility badge + toggle (existing
    primitives only).
  - `prisma/verify-catalog-visibility.ts` + `package.json` script.
  - Possibly `prisma/seed.ts` (explicit `isPublished: true`, optional).
- **Checks:** `git status` / `git diff --check`, `npm run typecheck`,
  `npm run build`, `npm run db:status` / `db:health`, and the new
  `db:verify:catalog-visibility` plus existing `db:verify`.
- **Risks:** forgetting a storefront read path (a hidden product leaks on home /
  search / similar — mitigated by centralizing the filter and the verify script);
  stale prerendered PDP of a hidden slug (mitigated by `revalidatePath` +
  `dynamicParams`); accidentally filtering admin reads (admin must still see
  hidden products); index choice (validate against real query shapes).
- **Explicitly deferred to a later stage/SPEC:** soft-archive tier
  (`isArchived`/`archivedAt`) and any hard-delete flow.
