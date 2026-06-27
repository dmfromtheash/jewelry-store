# AURELIA — Customer Account & «Вопросы / Ответы» UX Redesign — SPEC (Этап 85A)

**Status:** SPEC / UX PLAN only. **No code, no schema, no migration, no CSS/design change, no push in 85A.**
**Author stage:** 85A · **Baseline HEAD:** `7de3b9c` · **Branch:** `main`

> This document is a *plan*. It analyses the current customer account (`/account`) and the public
> «Вопросы / Ответы» page (`/help`), then designs a richer customer dashboard and a cleaner Q&A
> page. It honours every existing constraint (Ukrainian-first storefront, **locked design** — reuse
> existing classes only, **no real email sending**, server-authoritative inventory, no payment/
> carrier APIs, no-PII, admin local-only). It deliberately **reuses existing models** wherever
> possible and flags clearly what (if anything) would need new schema.
>
> **Explicitly out of scope (deferred, untouched here):** the entire 24-hour reservation / hold
> lifecycle (`reservedQuantity`, FIFO hold queue, `hold_*` states) — see
> `docs/support/HELP_CENTER_PRODUCT_QA_RESERVATION_SPEC_78A.md` §E; real email sending/provider;
> payment/delivery/deploy logic; product cards/gallery/placeholders.

---

## 0. Context — what already exists (verified against the codebase)

This SPEC reuses foundations already in `main` rather than inventing parallel systems.

| Concern | Existing building block | File(s) |
|---|---|---|
| Account page (server) | Single long server component, login-prompt when logged out, hard-scoped by `customerId` | `app/account/page.tsx` |
| Account data aggregator | `getAccountDashboard(customerId)` batches orders/wishlist/review-counts/saved-searches/interests + engagement | `src/lib/customer/account-dashboard.ts` |
| Account sub-routes | order detail, password recover/reset | `app/account/orders/[orderCode]/page.tsx`, `app/account/recover/page.tsx`, `app/account/reset/page.tsx` |
| Account form components | profile (name/phone), password change, email-verification status, open-login | `app/account/_components/{ProfileForm,PasswordForm,EmailVerification,OpenLoginButton,RecoverForm,ResetForm}.tsx` |
| Customer orders read | `getCustomerOrders` (up to 100, newest first), `getCustomerOrderByCode` | `src/lib/customer/repo.ts` |
| Wishlist | server-side `CustomerWishlistItem` + `getWishlistProducts` + remove action | `src/lib/customer/wishlist-{repo,actions}.ts` |
| Saved searches | `CustomerSavedSearch` + list/remove + `buildSavedSearchUrl` | `src/lib/customer/saved-search*.ts` |
| Product interests (login-only) | `CustomerProductInterest` (active/cancelled/fulfilled), `listActiveInterests`, cancel | `src/lib/customer/product-interest-{repo,actions}.ts` |
| Engagement label (non-financial) | `computeEngagement` (new/active/loyal — no money/points) | `src/lib/customer/engagement.ts` |
| Help questions | `HelpQuestion` (has nullable `customerId` SetNull) + submit action | `src/lib/help/question-*.ts`, schema `HelpQuestion` |
| Product Q&A | `ProductQuestion` (has nullable `customerId` SetNull) + public read + submit | `src/lib/product-qa/*.ts`, schema `ProductQuestion` |
| Availability interest (guest+email) | `ProductAvailabilityInterest` (has nullable `customerId`) + record/dedupe | `src/lib/availability/*.ts`, schema `ProductAvailabilityInterest` |
| Help Center page | `/help` → `HelpCenter` (intro, hero block, search, category chips, articles, ask form) | `app/help/page.tsx`, `src/components/help/{HelpCenter,HelpQuestionForm}.tsx`, `src/lib/help/{content,search}.ts` |
| Info hint | reusable `InfoHint` "i" tooltip (plain CSS `au-hint*`) | `src/components/ui/InfoHint.tsx`, `src/styles/hint.css` |
| Existing account/help CSS | checkout/account classes `au-co-*`, help block `au-help-*`, info-page `au-info-*` | `src/styles/{checkout,content,hint}.css` |

**Key reuse fact (drives almost all of Section B):** `HelpQuestion`, `ProductQuestion`, and
`ProductAvailabilityInterest` **already carry a nullable `customerId`** set from the verified
session at submit time. That means a **logged-in** customer's Help questions, product questions, and
email-based availability interests **can be read back and shown in the account today — with no
schema change**. Only **guest** submissions (customerId null) cannot be linked (known, honest gap).

**Hard invariants this SPEC preserves:**
1. Storefront copy **Ukrainian-first**; admin copy **Russian**.
2. **Design locked** — reuse existing classes only; no product-card/gallery/placeholder change.
3. **No real email is ever sent** — all notification flows remain no-send; copy says so.
4. **Inventory server-authoritative**; no reservation/hold work in this cycle.
5. **No raw PII/token/secret** exposed; everything **hard-scoped by `customerId`**.
6. Admin remains **local-only** (`notFound()` in production).

---

## A. Current-state audit

### A.1 Customer account — `/account`

**Flow.** Auth is modal-based (`OpenLoginButton` opens the existing login modal). Logged out,
`/account` renders an **in-page login prompt** (no redirect → no redirect loop). Logged in, it loads
`getAccountDashboard(customer.id)` and renders one long server page. Logout is a server-action
button. Password **recover/reset** live at `/account/recover` and `/account/reset`.

**Current layout** (single page, two-column `au-checkout-grid`, no tabs):

| Block | Location | Data shown | Actions | Empty state |
|---|---|---|---|---|
| Профіль | left | email, phone, **engagement label** + one-line activity counts | edit name/phone (`ProfileForm`), logout | n/a |
| Email verification | left (inside Профіль) | verified / not-verified status | request verification (no-send) | n/a |
| Зміна пароля | left | — | change password (`PasswordForm`) | n/a |
| Обране | left | up to 4 recent wishlist products + count | remove, link to `/favorites` | honest "поки порожньо" |
| Збережені пошуки | left | saved catalog searches + count | open, delete | honest empty w/ how-to |
| Стежу за наявністю | left | active `CustomerProductInterest` + count | "Не стежити" (cancel) | honest empty w/ no-send note |
| Мої замовлення | right | up to **4 recent** orders + total count | open order detail, link to catalog | honest "ще немає замовлень" |
| Мої відгуки | right | review **counts** (approved/pending/rejected) | — | honest empty |

**Strengths (keep):** correct hard-scoping by `customerId`; honest no-send copy throughout;
graceful logged-out prompt; real working actions (remove favorite, delete saved search, cancel
interest, edit profile, change password); reuses existing classes (no design debt); engagement label
is non-financial and clearly informational.

**Missing / weak (the owner's "too poor and shallow"):**
1. **No dashboard/overview** — it is a flat stack of sections; no greeting, no status cards, no
   "at a glance" landing. First impression is a settings form, not a control panel.
2. **No navigation/structure** — everything is on one scrolling page. No tabs/sections the user can
   jump to. Long page = hard to find anything.
3. **Help questions invisible** — a logged-in user who asked via «Вопросы / Ответы» and received an
   admin answer has **no way to read the answer in their account** (the data carries `customerId`
   but is never read back). This is the biggest functional gap.
4. **Product Q&A invisible** — same: their own product questions + admin answers + moderation status
   are not surfaced anywhere in the account.
5. **Email-based availability interest invisible** — the account shows only the 69A login-only
   `CustomerProductInterest`; the 79A `ProductAvailabilityInterest` (the PDP "Повідомити про
   наявність" email form) is **not** shown even for logged-in users, so the two "waiting" concepts
   are split and one is hidden.
6. **Order history truncated** — only 4 recent orders; no "all orders" view (data supports up to
   100 already).
7. **Reviews shown as bare counts** — the user can't see their own review texts/targets/status list.
8. **No single place** that ties the account's value together ("here is everything you're tracking").

### A.2 «Вопросы / Ответы» — `/help`

**Current structure** (`HelpCenter.tsx`, top→bottom):
1. Breadcrumbs + `h1` «Вопросы / Ответы» + CMS intro paragraph.
2. **`au-help-hero`** block — explanatory sentence **+ an InfoHint**.
3. **Search** form (GET `?q=`) **+ an InfoHint** + "Знайти" button.
4. **Category chips** nav (`?category=`) with a leading **InfoHint** in its own `span`.
5. Article list (`au-info-faq` items) **or** empty state.
6. **`HelpQuestionForm`** — always-expanded long form (category, subject, message, name, email,
   conditional consent, honeypot, submit, no-send note) **+ an InfoHint** in its title.

**Strengths (keep):** content is honest/curated (no fake claims); search + category filter work and
are statically cacheable (GET); the ask form is robust (validation, honeypot, durable throttle,
consent-gated email, generic success, no-send copy); reuses existing classes.

**UX problems (the owner's "cluttered/rough"):**
1. **Hint overload** — **four** InfoHints on one page (hero, search, categories, form title) compete
   for attention and add visual noise; several restate what the visible copy already says.
2. **Competing top blocks** — intro paragraph **+** `au-help-hero` sentence **+** search **+** chips
   stack vertically before any answer is visible; the hero largely duplicates the intro.
3. **Search is not visually primary** — it's one row among several, not the clear main entry point.
4. **The ask form dominates** — a long always-open form sits directly under the articles with no
   separation, so the page "ends" in a wall of inputs instead of a clear, contained CTA.
5. **Weak hierarchy** — categories (secondary navigation) and the form (a distinct action) sit at
   the same visual weight as the answers (the primary content).
6. **No cross-link to product Q&A** — a visitor with a product-specific question gets no pointer to
   the PDP "Запитання про товар" block.

---

## B. Proposed customer account dashboard

Turn `/account` from a flat stack into a **dashboard shell with sections**, using only existing
classes. Recommended approach: a **lightweight section model** (an overview landing + named
sections). Because the storefront is statically/SSR-rendered and auth is modal-based, prefer
**URL-driven sections via `?tab=` (or sub-paths under `/account/...`)** over client-only tab state,
so each section is linkable, server-rendered, and hard-scoped server-side. (Exact mechanism is an
86A implementation choice; see Section H.)

### B.1 Sections (RU names below are the *internal* labels; storefront copy is UA)

| Section (UA label) | Purpose | Buildable now? |
|---|---|---|
| **Огляд** (Overview) | Landing dashboard: greeting + status cards + recent activity + quick actions | **Yes** (compose existing reads) |
| **Замовлення** (Orders) | Full order history + links to order detail | **Yes** (`getCustomerOrders` already returns up to 100) |
| **Обране** (Favorites) | Wishlist management | **Yes** (exists) |
| **Вопросы / Ответы** (My questions & answers) | The customer's OWN Help questions + admin answers, and OWN product questions + answers + status | **Yes — no schema change** (data carries `customerId`) |
| **Очікування товарів** (Waiting for stock) | Both login-only interests **and** the user's email-based availability interests | **Mostly yes** — login-only now; email-based needs a small scoped read (no schema change) |
| **Збережені пошуки** (Saved searches) | Saved catalog filters | **Yes** (exists) |
| **Відгуки** (Reviews) | The customer's own reviews + moderation status (list, not just counts) | **Yes** (`ProductReview` carries `customerId`) |
| **Профіль і безпека** (Profile & security) | Email (read-only) + verification, name/phone edit, password change, logout, sessions note | **Yes** (exists) |

#### Per-section detail

**Огляд (Overview)** — see Section C.

**Замовлення (Orders)**
- *Data:* full list (newest first) — order code, status (`customerOrderStatusLabel`), date, item
  count, delivery + payment method, total, optional discount/promo snapshot.
- *Actions:* open order detail (`/account/orders/[orderCode]`).
- *Empty:* honest "ще немає замовлень" + link to catalog (existing copy).
- *Privacy:* only the customer's own orders (`where: { customerId }`), customer-safe projection only
  (no admin/audit columns) — already enforced in `repo.ts`.
- *Now/new/deferred:* **now** (render the already-fetched fuller list; current page only shows 4).

**Обране (Favorites)** — unchanged behaviour; *now*.

**Вопросы / Ответы (My questions & answers)** — see Section D. *Now, no schema change.*

**Очікування товарів (Waiting for stock)** — see Section E. *Login-only now; email-based = small
scoped read, no schema change.*

**Збережені пошуки (Saved searches)** — unchanged behaviour; *now*.

**Відгуки (Reviews)**
- *Data:* the customer's own reviews — product name/link, short excerpt, rating, status
  (approved/pending/rejected), date. (Today: counts only.)
- *Actions:* link to the product; (edit/delete is **out of scope** unless owner asks).
- *Empty:* honest existing copy.
- *Privacy:* `where: { customerId }`; never show other users' reviews or moderation notes.
- *Now/new/deferred:* **now** (list read; no schema change). Listing texts is optional polish.

**Профіль і безпека (Profile & security)**
- *Data:* email (read-only) + verification status, name, phone, password change, logout. Optionally
  a plain "session" line (no device list — per-device sessions are **deferred**).
- *Actions:* edit name/phone, change password, request email verification (no-send), logout.
- *Privacy:* never render password hash, tokens, session secrets, or `sessionVersion`.
- *Now/new/deferred:* **now** (all components exist).

### B.2 Privacy / security rules (all sections)
- Every read is **hard-scoped by `customerId`** re-derived from the verified session server-side; a
  client-supplied id is never trusted.
- Never expose: `passwordHash`, any token/`emailHash`, `sessionVersion`, cookies, raw IP/UA, admin
  internal notes, **or another customer's data**.
- For Q&A/interest: show the **answer/status the customer is entitled to**, never admin-only triage
  fields. The customer's **own** stored reply email may be shown back to them (it is their own data),
  but never anyone else's.
- Email-sending copy stays **honest no-send** everywhere it appears.

---

## C. Account overview dashboard (the `/account` landing)

Default `/account` view = **Огляд**. Built entirely from existing data + classes.

**Layout (top → bottom):**
1. **Greeting** — "Вітаємо, {name|email}" + the **engagement label** (non-financial, informational).
2. **Status cards** (compact, reuse `au-co-summary-count` / list classes) — small tiles:
   - Замовлень: {orders.total}
   - В обраному: {wishlist.total}
   - Очікую: {waiting total} (login interests + email availability interests, deduped count)
   - Запитань: {help+product questions total} · with a "відповіли: {answered}" sub-count
   - Збережені пошуки: {savedSearches.length}
   - Відгуків: {reviews.total}
3. **Recent orders** — 3–4 most recent (existing markup), "Усі замовлення" link to the Orders section.
4. **Questions & answers digest** — most recent 2–3 of the customer's questions with status; an
   "answered" item is highlighted ("є відповідь") and links into the Вопросы / Ответы section.
5. **Waiting digest** — count + "вже в продажу" highlight when any tracked item became available.
6. **Quick actions** — buttons/links: «До каталогу», «Вопросы / Ответы» (public `/help`),
   «Обране», «Профіль». Reuse `au-btn` classes.

**Empty overview:** if the account is brand-new, the cards show 0 and the page shows a short honest
"Почніть з каталогу" prompt + quick actions — never a blank screen.

**Data source:** extend `getAccountDashboard` (or add a thin `getAccountOverview`) to also return the
question/answer counts and the unified waiting count. All additive, all scoped, no schema change.

---

## D. Questions / Answers inside the account

A customer-facing panel (the **Вопросы / Ответы** account section) where the logged-in user sees
**their own** questions and any admin answers. **No schema change** — both models carry `customerId`.

**Two grouped lists:**

**D.1 General Help questions** (`HelpQuestion where customerId = me`)
- *Shown per item:* subject, category, message excerpt, **status**, date, and the **admin answer**
  when present (`answer`, `answeredAt`).
- *Status mapping (customer-facing, honest):* the model's `new`/`triaged` → "На розгляді";
  `answered` → "Відповіли" (show answer); `published` → "Відповіли · опубліковано" (show answer);
  `archived` → "Закрито"; `spam`/`rejected` → **not shown to the customer** (or a neutral
  "Закрито"), never exposing moderation reasoning.
- *Empty:* "Ви ще не ставили запитань. Поставте запитання у розділі «Вопросы / Ответы»." + link to
  `/help`.

**D.2 Product questions** (`ProductQuestion where customerId = me`)
- *Shown per item:* product name + link to the PDP, question body, **status**
  (pending/approved/published/rejected), the **admin answer** when present, date.
- *Status mapping:* `pending` → "На модерації"; `approved` → "Схвалено"; `published` →
  "Опубліковано" (visible on the product page); `rejected` → "Відхилено" (neutral, no internal note).
- *Links:* each row links to `/product/{slug}` (resolve slug via the related product, published only).
- *Empty:* "Ви ще не ставили запитань про товар. Запитайте на сторінці прикраси." 

**Privacy (strict):**
- Only `where: { customerId: me }` rows; never another user's question.
- Show only customer-appropriate fields: subject/body, status (mapped to friendly copy), the answer
  text, dates. **Never** show `answeredBy` (admin actor label), `emailHash`, internal triage refs of
  *other* people, or raw moderation reasons.
- The customer's own stored `recipientEmail` may be echoed back to them (their data); never anyone
  else's.

**Known honest gap:** questions submitted as a **guest** (customerId null, e.g. before login) cannot
be linked to the account. State this plainly in empty/footer copy ("показуємо запитання, надіслані з
цього акаунта"). Guest→account question linking is **deferred** (same family as guest-order linking).

**New reads needed (no schema):** `listMyHelpQuestions(customerId)` and
`listMyProductQuestions(customerId)` (scoped, customer-safe selects). Both additive.

---

## E. Availability interests inside the account

A **Очікування товарів** section unifying the two existing "waiting" concepts for a logged-in user.

**E.1 Login-only interest** (`CustomerProductInterest`) — already shown today via
`listActiveInterests`: product name/link, "вже в продажу"/"очікується", date, **cancel** ("Не
стежити"). Keep as-is.

**E.2 Email-based availability interest** (`ProductAvailabilityInterest where customerId = me`) —
currently **not** shown. Add a scoped read so a logged-in user who left their email on a PDP
"Повідомити про наявність" form sees it here too.
- *Shown:* product name + link (published only), variant note if any, **status** (requested /
  pending_availability / queued_notification / notification_prepared / cancelled / expired) mapped
  to friendly UA copy, date.
- *Their own email:* may be shown back to them (their data) — but masked is fine; never expose
  `emailHash`.
- *Cancel:* allow the customer to cancel **their own** interest safely → status `cancelled` (a scoped
  `updateMany where { id, customerId, status in active-ish }`, idempotent, audited). This is safe
  because it only withdraws a no-send record and never touches inventory.
- *Honest no-send note:* "Листи поки не надсилаються — поштовий сервіс не підключено. Це лише ваш
  список очікування."
- *Empty:* honest existing-style copy.

**Out of scope (must stay deferred):** no 24h hold, no `reservedQuantity`, no "reserve this item"
action — only *interest/waiting* is shown. The PDP reservation CTA from 78A §E is **not** built.

**New read/action needed (no schema):** `listMyAvailabilityInterests(customerId)` +
`cancelMyAvailabilityInterest(customerId, id)` (owner decision: whether customer self-cancel is
enabled — see Section 6 of the report). Both additive.

---

## F. «Вопросы / Ответы» page redesign plan

Goal: less clutter, clearer hierarchy, search as the primary entry, the ask-form as a contained CTA.
Reuse existing classes; **no new design system** (at most minor reuse of existing `au-help-*` /
`au-info-*` / `au-co-*` blocks).

**Proposed structure (top → bottom):**

1. **Hero / header (slim).** Breadcrumbs + `h1` «Вопросы / Ответы» + **one** short intro line.
   **Merge** the current CMS intro and the `au-help-hero` sentence into a single line (they
   duplicate today). **Remove** the hero's InfoHint (the visible sentence already explains it).

2. **Search (primary entry).** Give the search its own prominent row directly under the header,
   visually the main call to action ("знайдіть відповідь"). Keep GET `?q=` (static-cacheable). Keep
   **at most one** short hint *only if* the placeholder isn't self-explanatory — prefer removing it
   and relying on a clear placeholder.

3. **Category chips (secondary navigation).** Keep the chips, but as clearly secondary (lighter
   weight, beneath search). **Remove** the standalone "categories" InfoHint — selecting a chip is
   self-evident.

4. **Answers area (primary content).** The filtered FAQ/article list. Consider rendering articles as
   **clean cards or an accordion** (reusing existing `au-info-faq` item classes) so long bodies
   collapse and the list scans easily. Keep the honest empty state + "Скинути фільтри".

5. **Ask-a-question CTA (contained).** Replace the always-open long form at the bottom with a clear,
   **separate panel / CTA**: a short "Не знайшли відповідь?" card with a single button
   «Поставити запитання» that reveals (or anchors to) the form. This stops the page ending in a wall
   of inputs and gives the action a distinct, lower-noise home.

6. **Form area (revealed / separate block).** The existing `HelpQuestionForm` unchanged in behaviour
   (validation, honeypot, throttle, consent-gated email, generic success, no-send copy). Keep **one**
   concise hint *or none* — the no-send note already states how it works. Email/consent stay
   conditional (as today).

7. **Product Q&A cross-link (useful).** A short line: "Питання про конкретну прикрасу? Запитайте на
   сторінці товару — блок «Запитання про товар»." Optionally link to a representative
   category/catalog entry. No new data.

**Net effect:** top of page goes from *intro + hero(+hint) + search(+hint) + chips(+hint)* (3 hints,
4 stacked blocks) down to *slim header + prominent search + secondary chips* (0–1 hint), and the
bottom goes from *always-open long form(+hint)* to *contained CTA → revealed form*.

---

## G. Info-hint usage review

Current `InfoHint` placements (7 files): Header, ProductBuyPanel, AvailabilityNotifyForm,
ProductQuestionForm, HelpQuestionForm, **HelpCenter (×3: hero, search, categories)**, CheckoutPageClient.

**Recommendations:**
- **Remove on `/help`:** the **hero** hint (duplicates the visible sentence), the **categories** hint
  (chips are self-evident), and the **search** hint (replace with a clearer placeholder). → `/help`
  drops from 3 page-level hints + 1 form hint to **0–1** total.
- **Keep (useful):** one concise hint on the **ask-question form** *or* none — the no-send note covers
  it; if kept, shorten to a single clause.
- **Keep elsewhere (unchanged in 85A scope):** Header (account/cart/favorites/«Вопросы / Ответы»),
  ProductBuyPanel, AvailabilityNotifyForm, ProductQuestionForm, Checkout (payment/delivery/promo) —
  these sit next to genuinely non-obvious controls and aren't clustered.
- **Shorten copy:** wherever a hint restates adjacent visible text, cut it to one short clause.
- **Avoid overlap:** keep `place` conservative (`bottom`/side) in dense rows so a tip never covers a
  neighbouring control (the component already supports this; just choose placements deliberately).

**Principle:** a hint earns its place only when the control is non-obvious *and* the explanation
isn't already visible. On `/help` most weren't; in the header/checkout they are.

---

## H. Implementation staging

Three safe stages. **No 24h reservation work in any of them.** Each is one commit.

### Stage 86A — Customer Account Dashboard Upgrade
- **Scope:** turn `/account` into a dashboard shell with an **Огляд** landing (greeting + status
  cards + recent activity + quick actions) and clear sections; add **My Questions/Answers** (Help +
  product, scoped), **unify waiting** (login interests + email-based availability interests), **full
  order history**, and a **reviews list** (not just counts). All reads scoped by `customerId`. No
  schema change.
- **Files likely touched:** `app/account/page.tsx` (+ possibly `app/account/_components/*` and/or new
  section sub-routes under `app/account/`), `src/lib/customer/account-dashboard.ts` (extend or add
  `getAccountOverview`), **new** scoped reads: `src/lib/help/question-account.ts`
  (`listMyHelpQuestions`), `src/lib/product-qa/account.ts` (`listMyProductQuestions`),
  `src/lib/availability/account.ts` (`listMyAvailabilityInterests` + optional self-cancel action),
  small additions to `src/lib/customer/repo.ts` (reviews list). Reuse existing CSS only.
- **Migration:** **No.**
- **Checks:** `typecheck`, `prisma validate` (no schema change but cheap), `smoke:routes` (`/account`
  + sub-routes render; logged-out prompt intact), `smoke:admin` (unaffected), `build`; new
  `db:verify:account-dashboard` (scoping: a customer never sees another's question/interest/review;
  guest rows excluded; counts correct; nothing committed — rolled-back tx). Manual route checks:
  logged-out prompt, overview cards, answered-question highlight, waiting cancel.
- **Risk:** **Low–Medium** — all additive reads; main risk is failure-isolation (a failing Q&A read
  must never break the account) and strict scoping. No inventory/payment/email-send touched.
- **Rollback:** revert the single commit; no migration to undo.
- **Commit:** `feat: customer account dashboard upgrade (overview, my Q&A, unified waiting)`

### Stage 87A — «Вопросы / Ответы» Page UX Cleanup
- **Scope:** restructure `/help` per Section F — slim header (merge intro+hero), search as primary
  entry, chips as secondary, cleaner answers area (cards/accordion via existing classes), contained
  ask-question CTA → revealed form, product-Q&A cross-link, and the hint cleanup from Section G.
  **No change to form behaviour, validation, throttle, honeypot, or no-send copy semantics.**
- **Files likely touched:** `src/components/help/HelpCenter.tsx`,
  `src/components/help/HelpQuestionForm.tsx` (CTA reveal only), possibly tiny reuse of existing
  `au-help-*` rules in `src/styles/content.css` (no new design system; prefer existing classes).
  `app/help/page.tsx` unchanged (route/title pinned at 84A).
- **Migration:** **No.**
- **Checks:** `typecheck`, `smoke:routes` (`/help`, `/help?category=`, `/help?q=` all 200; form
  submits), `build`. Manual: hint count reduced, search prominent, form contained, mobile spacing.
- **Risk:** **Low** — presentation-only; static fallback + form action untouched.
- **Rollback:** revert the single commit.
- **Commit:** `feat: declutter Вопросы/Ответы page (search-first, contained ask CTA)`

### Stage 88A (optional) — Account Integration Polish
- **Scope:** tie 86A + 87A together: deep-links from account Q&A rows into `/help` / PDP; "answered"
  notification dot/count in the header or `/account` overview (no email); consistency pass on empty
  states and copy; optional small `db:verify` hardening and docs/readiness/sale-docs updates.
- **Files likely touched:** `src/components/layout/Header.tsx` (optional count badge),
  `app/account/*`, docs (`FEATURES_AND_LIMITS.md`, readiness), `scripts/demo/sale-docs-check.mjs`
  guards.
- **Migration:** **No.**
- **Checks:** full safe suite green (typecheck, prisma validate, all `db:verify:*`, `smoke:routes`,
  `smoke:admin`, `build`, sale-docs-check, preflight).
- **Risk:** **Low.**
- **Rollback:** revert the single commit.
- **Commit:** `feat: account/help integration polish + docs`

**Must be deferred (not in 86A–88A):** 24h reservation/hold lifecycle (`reservedQuantity`, FIFO
queue, `hold_*`), real email sending/provider, payment/delivery/deploy, guest→account question/order
linking, per-device session management.

**Recommended first stage:** **86A** — it delivers the owner's main ask (a real customer dashboard)
and unlocks the most value; it's additive and reversible. 87A is independent and can follow (or run
in parallel since the files don't overlap).

---

## I. Checks / test plan (for the implementation stages)

Per stage, run the established repo commands:
- `npm run typecheck` — every stage.
- `npx prisma validate` — cheap sanity even when schema is untouched (proves no accidental edit).
- `npm run smoke:routes` — `/account`, `/account/orders/[orderCode]`, `/help`, `/help?category=`,
  `/help?q=` render; logged-out `/account` prompt intact; PDP unaffected.
- `npm run smoke:admin` — admin surfaces unaffected (no new admin work in this cycle).
- `npm run build` — full prod build (needs DB 6700 up for `generateStaticParams`).
- **New `db:verify:account-dashboard`** (tsx, rolled-back tx, count-before == count-after): proves
  strict `customerId` scoping for Help questions / product questions / availability interests /
  reviews; guest rows (customerId null) excluded from account reads; overview counts correct;
  self-cancel only affects the owner's own row; nothing committed.
- **Manual runtime checks:** logged-out `/account` prompt; overview cards + answered-question
  highlight; waiting list cancel; `/help` reduced hints + search-first + contained form CTA;
  mobile/narrow spacing.

---

## J. Owner decisions needed (carried into 86A/87A)

1. **Section naming** — accept the proposed UA labels (Огляд / Замовлення / Обране / Вопросы /
   Ответы / Очікування товарів / Збережені пошуки / Відгуки / Профіль і безпека)? Any renames?
2. **Availability self-cancel** — may a logged-in customer cancel their **email-based**
   `ProductAvailabilityInterest` from the account (Section E recommends **yes**, it only withdraws a
   no-send record)?
3. **Order history** — show **full** history now (recommended) or keep a recent subset + "see all"?
4. **Profile/password in scope** — keep current edit-name/phone + change-password as-is (recommended)
   or expand (e.g. add a sessions view — currently **deferred**)?
5. **Reviews list** — show the customer's own **review texts** + status (recommended) or keep counts?
6. **Account section mechanism** — `?tab=`/sub-paths (server-rendered, linkable; recommended) vs a
   single richer page. (Implementation detail; owner may not care.)
7. **Copy/language** — confirm UA storefront copy and that all email-related copy stays honest
   no-send; confirm the public section stays exactly «Вопросы / Ответы» (84A).
8. **One commit or two** — implement 86A (account) and 87A (/help) as **two separate commits**
   (recommended — independent, easier review/rollback) or bundle?

---

## Appendix — links

- Reservation/Q&A foundation SPEC: `docs/support/HELP_CENTER_PRODUCT_QA_RESERVATION_SPEC_78A.md`
  (this 85A SPEC builds the **account integration** §G the 78A SPEC deferred, and the §F page
  cleanup; it does **not** touch the 78A §E reservation lifecycle).
- Honest feature inventory: `docs/sale/FEATURES_AND_LIMITS.md` §1/79A/84A.
</content>
</invoke>
