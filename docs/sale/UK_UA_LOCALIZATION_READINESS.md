# uk-UA Localization Readiness — AURELIA

> Package index: [`README.md`](./README.md) · honest limits: [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).

## 1. Purpose

A **readiness audit** for translating AURELIA's user-facing copy to **Ukrainian
(uk-UA)** for a Ukraine-first launch. This is **not** an implementation: no UI/code
text, design, schema, or data is changed here. It maps what is Russian today, what to
localize first, and how to do it **without touching the approved design**.

## 2. Current language baseline

- **Storefront UI: Russian.** Confirmed by source scan — e.g. `Купить`, `Корзина`,
  `Оформление заказа`, `Заказ принят`, `Поиск украшений`, `Главная`. **No
  Ukrainian-distinct words** (`Кошик`, `Купити`, `Замовлення`, `Пошук`) exist in
  `app/` or `src/`.
- **Checkout: Russian.** Method labels in `src/lib/orders/methods.ts`
  (`Самовывоз`, `Новая Почта`, `Укрпочта`, `Курьер / локальная доставка`;
  `Оплата при получении`, `Онлайн-оплата по реквизитам`).
- **Admin: Russian.** `Дашборд`, `Заказы`, `Каталог`, `Войти` / `Выйти`.
- **Sale docs: mixed.** Buyer-facing docs are Russian (`FEATURES_AND_LIMITS`,
  `SELLER_OFFER_ONE_PAGER`, `BUYER_DEMO_SCRIPT`, `DEMO_RUNBOOK`, etc.); newer index/
  research docs are English (`README`, `PAYMENT_DELIVERY_PROVIDER_RESEARCH`,
  `OWNER_DECISION_CHECKLIST`).
- **Product / demo data: Russian.** `src/data/products.ts` (seed source) + DB catalog
  (`Серьги AURELIA «Капля»`, categories like `Серьги · позолота`, coatings
  `Позолота / Родирование / Сталь`).
- **Already Ukraine-correct:** currency is **₴ (UAH)** throughout.
- **Locale mismatches to fix during localization (not full Russian, but not UA either):**
  - Header shows a **RU-style toll-free number** `8 800 600-20-26` and a **`RU`**
    language label (`src/components/layout/Header.tsx`).
  - Checkout **phone placeholder is `+7 ___ ___-__-__`** (Russian country code) while
    the market is Ukraine **`+380`** (`src/components/checkout/CheckoutPageClient.tsx`).
  - These are demo placeholders, not real data — but they signal RU locale and should
    be corrected as part of localization.

## 3. Localization priority map

| Area | Current language | Priority | Why | Implementation risk |
|---|---|---|---|---|
| Homepage / header / navigation | Russian | **P1** | First impression; brand language | Medium — header is dense; phone/lang label + nav width |
| Category / product pages | Russian | **P1** | Core shopping copy (status, tabs, perks) | Low–Medium — variant/perk strings vary in length |
| Cart (drawer) | Russian | **P1** | Conversion step | Low — short strings, fixed-width drawer |
| Checkout | Russian | **P1** | Conversion + trust; includes `+7` placeholder | Medium — labels + selects + notes; method labels are shared |
| Order confirmation | Russian | **P1** | Closes the purchase honestly | Low — short block |
| Admin shell | Russian | **P4** | Internal/owner-only; not buyer-facing | Low — defer |
| Admin products | Russian | **P4** | Internal | Low — defer |
| Admin orders | Russian | **P4** | Internal | Low — defer |
| Sale docs (buyer-facing) | Russian/English | **P3** | Handoff readability | None (docs) |
| Demo product data | Russian | **P2** | Buyer replaces with real UA catalog anyway | Low — data, not layout |
| System / error / validation messages | Russian | **P2** | Trust; shown on bad input | Low — short strings |

## 4. Candidate files/directories to inspect/change later

(From inspection; **list only — do not edit in this stage**.)

| Path | Type of copy | Notes |
|---|---|---|
| `src/components/layout/Header.tsx`, `Footer.tsx` | Nav, search placeholder, phone, lang label, footer columns | Includes the `8 800…` number + `RU` label |
| `src/components/home/*` (`Benefits`, `CategoryCircles`, `PromoBlocks`, `SeoTextBlock`) | Home sections, SEO text | SeoTextBlock is long-form |
| `src/components/product/*` (`ProductInfo`, `ProductBuyPanel`, `ProductTabs`, `ReviewsEmpty`, `ProductCard`) | Status, “Купить”, tabs, perks | `ProductBuyPanel` has the default coatings strings |
| `src/components/category/*` | Filters, toolbar, pagination, empty states | Sort/filter labels |
| `src/components/cart/*` (`CartDrawer`, `CartButton`, `AddToCartButton`) | Cart UI | Short strings |
| `src/components/checkout/CheckoutPageClient.tsx` | Field labels, placeholders, notes | Fix `+7` placeholder → `+380` |
| `app/checkout/success/page.tsx` | Success/confirmation page | Pairs with inline confirmation |
| `src/components/search/*`, `src/components/favorites/*`, `src/components/auth/*` | Search, favorites, login/register modals | Buyer-facing |
| `src/components/content/InfoPageLayout.tsx` + `src/data/info-pages.ts` | Delivery/returns/help/about/contacts copy | Long-form info pages |
| `src/lib/orders/methods.ts` | Delivery/payment **labels** | Single source — high leverage |
| `src/lib/orders/validate.ts` | Validation/error messages | Buyer sees these |
| `src/data/products.ts` + `prisma/seed.ts` (+ DB) | Demo catalog names/categories/specs | Data localization (P2) |
| `app/**/page.tsx`, `app/layout.tsx` | `metadata` titles/descriptions | SEO/meta copy |
| `app/admin/**`, `src/lib/admin/**` | Admin copy | **Defer (P4)** unless owner wants UA admin |

## 5. What should be localized first

Practical MVP order:

1. **Storefront + cart + checkout** (P1) — header/nav, category/product, cart drawer,
   checkout (incl. `+380` placeholder fix) + `methods.ts` labels.
2. **Order confirmation** (P1) — inline confirmation + `/checkout/success`.
3. **Buyer-facing docs** (P3) — Ukrainian (or bilingual) versions for handoff.
4. **Product demo data** (P2) — or skip if the buyer supplies a real UA catalog.
5. **Admin** (P4) — later, or keep RU/admin-only (owner decision).

## 6. What should remain unchanged for now

- **Design / visual layout** — spacing, typography, colors, cards, placeholders,
  gallery, composition (design is locked).
- **Screenshots** — re-capture only **after** localization ships (not before).
- **Payment / delivery provider logic** — out of scope for localization.
- **Prisma schema / migrations** — no change unless a true multi-language i18n
  architecture is later required (see §8).
- **Admin** — if it stays internal/owner-only, leave Russian for now.

## 7. Design / layout risk notes

- Ukrainian strings are often **longer or shorter** than Russian — buttons, nav items,
  table headers, and the cart/checkout selects can wrap or overflow.
- Implementation must **preserve the approved spacing and visuals** — translate copy
  only; do **not** resize/restyle components to fit.
- Do **not** redesign cards, placeholders, or the gallery to accommodate text.
- After localization, **test responsive/mobile** (390px) for wraps/overflow, then
  re-capture screenshots.

## 8. Recommended implementation path

- **39B — Storefront + checkout copy localization** (P1): header/nav, category/product,
  cart, checkout, `methods.ts`, validation messages; fix `+7`→`+380`, header phone/lang.
- **39C — Product / demo data localization review** (P2): seed data + DB catalog copy
  (or confirm the buyer replaces it).
- **39D — Buyer-facing sale docs**: Ukrainian or bilingual handoff versions.
- **Later — i18n architecture** only if **multiple** languages (ru/uk/en switcher) are
  actually required; a single uk-UA pass needs **no** schema/i18n framework.

> Keep each as a separate, design-preserving stage. Do not attempt all at once.

### 39B result (done)

**Storefront + checkout customer-facing copy localized to uk-UA** (copy-only, design
preserved — no CSS/layout/schema changes):

- **Header / nav / footer:** topbar + category nav + footer columns; header phone
  placeholder `8 800…` → `0 800 000 00 00` and language label `RU` → `UA`.
- **Home:** section titles, benefits, category circles, promo/SEO blocks, placeholder
  customer states.
- **Category / product:** titles, chips, SEO paragraphs, breadcrumbs (`Главная` →
  `Головна`), category labels, tabs/specs, perks, status (`В наявності`), variant
  label (`Покриття`), reviews-empty, recently-viewed; buy CTA → `Додати`.
- **Cart drawer:** title `Кошик`, item/qty/empty/unavailable states, totals, CTA
  `Оформити замовлення`.
- **Checkout:** all field labels/placeholders, delivery/payment **labels**
  (`src/lib/orders/methods.ts`), validation messages (`validate.ts`), server order
  errors (`actions.ts`), manual-payment notes; phone placeholder `+7…` → `+380…`.
- **Order confirmation:** inline confirmation + `/checkout/success` fallback.
- **Search / favorites / auth modals:** states, buttons, aria-labels.
- **Info pages** (`src/data/info-pages.ts`): delivery, returns, stores, help, about,
  contacts — fully translated (mock pre-launch copy).
- **Metadata:** `html lang="ru"` → `"uk"`; page `title`/`description`/keywords.
- Currency stays **₴ (UAH)**; enum/code values unchanged (only labels translated).
- Validated: `npm run typecheck` ✅ and `npm run build` ✅.

**Deferred / unchanged:**
- **Admin** stays Russian/internal (out of scope, per decision).
- **Product demo data** (`src/data/products.ts` + DB catalog) stays Russian — handled
  in **39C** (or replaced by the buyer's real UA catalog).
- One Russian developer **comment** remains in `app/layout.tsx` (not user-facing).
- **Screenshots need re-capture** to reflect the Ukrainian UI (dev set 35B and
  production set 36A still show the previous Russian copy).

### 39B-V responsive visual check (done)

Checked the localized customer-facing pages at **390 / 768 / 1366 px** (home,
categories, product, search, cart drawer, checkout, order confirmation, favorites,
info page) on the dev server.

- **No blockers.** Ukrainian chrome fits at all three widths — no header/nav wrap,
  no button overflow, no broken breadcrumbs, cart drawer + checkout form render
  cleanly, currency stays **₴**.
- **One non-blocking issue:** on **mobile (390px)** the product page's third tab
  **«Доставка та повернення»** is clipped at the right edge (longer than the former
  RU «Доставка и возврат»). The tab row is the standard overflow component; **not
  fixed in 39B-V** (would require a CSS/UX decision). Candidate for a later
  copy-shortening (e.g. «Доставка/повернення») **or** a small tab-row scroll/spacing
  tweak — only with explicit approval, since design is locked.
- **Expected (deferred to 39C):** product names/categories/variant values and
  product descriptions are still Russian (demo data), so Ukrainian search terms
  (e.g. «сереж») return few/zero matches until 39C.

### 39B-F product tab copy fix (done)

- Addressed the 39B-V mobile finding: the product details tab label
  **«Доставка та повернення» → «Доставка/повернення»** (`src/components/product/ProductTabs.tsx`).
- **Copy-only** — no CSS, layout, component, schema, or data changes; design unchanged.
- Re-checked at **390px**: the shorter label reduces the overhang at the default
  scroll position. Note the mobile tab strip (`.au-tabs`) is already
  `overflow-x: auto` (horizontally scrollable, scrollbar hidden), so the last tab is
  reachable by swipe — it was never a hard/inaccessible clip. No CSS was touched.

### 39C result (done)

**Product/demo catalog data localized to Ukrainian** — closes the last customer-facing
Russian area:

- **Source** (`src/data/products.ts`): product names, category labels, descriptions,
  specs (labels + values), `COATINGS` (`Родирование` → `Родіювання`), tag
  `Хит` → `Хіт`. Kept: slug, sku, price, `tag: 'New'`, stock, IDs.
- **Seed source** (`prisma/seed.ts`): `CATEGORY_NAMES` → `Біжутерія` / `Подарунки`
  (for future fresh seeds; logic unchanged, **seed not run**).
- **Running local DB**: updated **in place** by a guarded one-off script
  (`scripts/catalog/localize-catalog-uk.ts`, idempotent, single transaction):
  Category.name, Product name/categoryLabel/description/specs/tag by slug, and
  `ProductVariant.value` coating `Родирование` → `Родіювання` via in-place
  `updateMany` (Позолота/Сталь identical RU/UA). **`db:seed` deliberately NOT used**
  (the variant upsert key includes `value` → would duplicate renamed variants).
- **Integrity preserved:** variant count 18 → 18 (no duplicates), slugs/SKUs/prices/
  stock/variant IDs unchanged; **demo orders `AUR-C205BFBF` / `AUR-C33C3360` frozen
  `OrderItem` snapshots verified unchanged** (still «Серьги AURELIA «Капля»» /
  `coating/Родирование`). `ProductVariant.name` stays `coating`.
- **Verified:** `db:verify` ✅, `db:verify:product-variants` ✅, `db:verify:orders` ✅,
  `typecheck` ✅, `build` ✅. Backup taken before the write (`backups/db/`).
- **Deferred:** **screenshots need re-capture in 39D** (35B dev + 36A production sets
  still show the old Russian catalog). **Admin** localization still deferred.

## 9. Readiness gates before code

- [ ] **Target language confirmed:** uk-UA only **vs** bilingual ru/uk (decides whether
      an i18n switcher/architecture is needed at all).
- [ ] Owner confirms a **Ukrainian storefront** is wanted.
- [ ] **Admin language** decision made (UA, or stay RU/internal).
- [ ] **Payment/delivery terminology** approved (e.g. `Нова Пошта`, `Укрпошта`,
      `Накладений платіж`, `Оплата при отриманні`, `Оплата за реквізитами`).
- [ ] Acknowledged that **screenshots need re-capture** after localization.
- [ ] **No design changes allowed** — copy-only.

---

**Scope reminder:** this audit changes **no** code, design, schema, or data. It is the
input for the staged 39B–39D localization work, each of which must preserve the locked
design.
