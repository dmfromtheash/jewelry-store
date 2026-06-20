# Product Imagery Gap Plan — AURELIA

> Package index: [`README.md`](./README.md) · honest limits:
> [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
> **Docs-only plan — no images are created, generated, downloaded, or added here, and
> no design/CSS/layout changes are proposed.**

## 1. Purpose

Close the **main remaining sale/demo visual gap** from the 40A audit: AURELIA is a
jewelry / accessories / gifts store, but it currently ships with **no real product
photos**. Every other sale dimension is strong (UA storefront + catalog, buyer
package, screenshots, honest limits); imagery is the single biggest lever left on
*perceived* value. This plan decides **how** to close it safely — without touching
the approved design.

## 2. Current state

- The **card / gallery design system exists and is approved** (locked). Cards have a
  media box; the product page has a square primary + a thumbnail row.
- **Image slots exist in the data model** — `ProductImage` rows (`position`, `url`,
  `alt`, `isPrimary`); the seed creates **one placeholder slot per product with
  `url = null`**. Admin can upload real images (`src/lib/admin/media*`,
  `public/uploads/products/`).
- **Current visuals are placeholders** — with `url = null` the UI shows the designed
  empty state (gem icon, «Незабаром зʼявиться прикраса»). `public/uploads/products/`
  contains only `.gitkeep` → **zero real photos**.
- **Screenshots are current for the Ukrainian UI/catalog** (39D), but they therefore
  show the **placeholder** imagery — they are not final brand imagery.
- **No images are added in this stage.**

## 3. Where imagery is needed

| Area | Image need | Current state | Priority | Notes |
|---|---|---|---|---|
| Product cards (home/category/search/favorites) | 1 primary thumbnail per product | placeholder gem | **P1** | Biggest visual surface; drives "real store" impression |
| Product detail — primary image | 1 large square per product | placeholder | **P1** | First thing on the PDP |
| Product gallery — secondary images | 2–4 per hero product | thumbnail placeholders | **P2** | Only needs depth on a few hero items |
| Category / home featured cards | reuse product primaries | placeholder | **P2** | No separate assets if cards reuse product images |
| Screenshots / sale package | re-shot after images land | UA but placeholder imagery | **P2** | Recapture in 42E once images exist |
| Buyer handoff / demo | enough to look like a store | placeholders | **P1 (demo)** | Minimum set (§4) is enough to demo |
| Future brand adaptation | buyer's real catalog photos | n/a | later | Buyer replaces demo images with their own (§5) |

## 4. Minimum demo image set

Practical minimum to make the demo read as a real store (not a full catalog shoot):

- **1 primary image per demo product** (10 products) — fills every card + PDP primary.
- **2–4 gallery images** for **2–3 hero products** (e.g. `serogi-kaplya`,
  `nabor-serogi-kulon`) — shows the gallery working without shooting everything.
- **Consistent background/style** (one neutral light backdrop) so the grid looks
  coherent.
- **No fake branded claims** — generic jewelry imagery, not impersonating a real brand.
- **Mobile-safe composition** — subject centered, key detail not near edges (cards
  crop to the existing media box; **do not change the ratio/layout**).
- **Neutral Ukrainian small-brand aesthetic** — clean, minimal, gift-friendly.

> This set fits the existing slots: drop a primary into each product's `position 0`
> slot; add extra `position`-ordered slots only for the hero products.

## 5. Ideal buyer-provided image set

Checklist for the real store owner (for launch, beyond the demo):

- [ ] **Product photo per SKU** (and per variant where the look differs).
- [ ] **Front / side / detail / lifestyle** shots for hero products.
- [ ] **Dimensions / scale** photo (on hand/model or with a reference).
- [ ] **Packaging / gift-box** photo (supports the "gifts" category).
- [ ] **Brand / logo assets** (for header/footer/marketing, separate from products).
- [ ] **Permission / license confirmation** in writing for every image used.

## 6. Safe source options

(No image is sourced or added in this stage — options only.)

- **Buyer-owned photos — best.** The real owner's own product photography; zero
  licensing risk; becomes launch assets.
- **Commissioned product shoot — best for sale.** A small mock/product shoot for the
  demo identity; clean, consistent, fully licensed.
- **Properly licensed stock/reference imagery — only with license proof.** Acceptable
  for a demo **if** the license permits this use and proof is recorded; keep the
  license/source noted.
- **AI-generated placeholder imagery — only if clearly marked and the owner accepts
  it.** Can fill the grid for a demo, but must be labelled as illustrative, not real
  products, and the owner must agree (provenance/IP terms vary).
- **Current placeholders — acceptable for a *technical* demo, weak for a *sale*.**
  Honest and zero-risk, but they undersell a jewelry store to a buyer.

## 7. What not to do

- ❌ **Do not scrape** images from any site.
- ❌ **Do not use marketplace / competitor / brand photos** without written permission.
- ❌ **Do not claim placeholder or illustrative images are real products.**
- ❌ **Do not redesign** cards / gallery / placeholders.
- ❌ **Do not change image ratio / aspect / layout** without explicit owner approval
  (design is locked — images fit the existing boxes).
- ❌ **Do not hide the limitation** in buyer docs — keep `FEATURES_AND_LIMITS.md`
  honest about demo vs real imagery.

## 8. Recommended implementation path

1. **42B — choose imagery strategy** (owner decision: placeholders vs licensed stock
   vs commissioned vs AI-marked vs buyer photos; record license terms).
2. **42C — add safe demo images** (or buyer images) into `public/uploads/products/`
   via the admin upload flow — **only licensed/owned assets**, no design change.
3. **42D — update product image references / gallery data** (ProductImage rows: set
   `url`/`alt`/`isPrimary`, add hero gallery slots) using a guarded, idempotent path
   like the 39C catalog script — no schema change.
4. **42E — re-capture final demo screenshots** (production + dev sets) now showing
   real imagery; refresh `DEMO_SCREENSHOT_CHECKLIST.md`.
5. **43A — final buyer demo script / sale handoff** refresh once imagery is in.

> Each is a separate stage; imagery work (42C/42D) must stay asset/data-only and
> preserve the locked design.

## 9. Readiness impact

| Scenario | Sale/demo package | Notes |
|---|---|---|
| **Now — placeholders** | ~90% | Honest, functional; undersells a jewelry store visually |
| **Safe demo imagery (min set §4)** | ~95% | Reads as a real store; strongest cheap uplift |
| **Owner-provided launch imagery** | launch-grade visuals | Real catalog photos; part of the broader (owner/legal-gated) launch path |

Imagery lifts **perceived sale value**; it does **not** change technical MVP or
launch readiness (still gated on payment/delivery/owner decisions).

## 10. Owner decisions

- [ ] **Strategy:** placeholders **vs** licensed stock **vs** commissioned shoot
  **vs** AI-marked **vs** buyer's own photos.
- [ ] **License proof** required and recorded for any non-owned imagery.
- [ ] **Brand aesthetic** (background, styling, tone) for the demo set.
- [ ] **Product count to image first** (all 10, or hero subset for the demo).
- [ ] **Demo-only vs real launch assets** — whether sourced images are throwaway demo
  filler or intended to become the live catalog.

---

**Scope reminder:** this is a docs-only plan — no images added, no design/CSS/schema
changes, no DB/build/dev commands. It feeds the staged 42B–42E imagery work.
