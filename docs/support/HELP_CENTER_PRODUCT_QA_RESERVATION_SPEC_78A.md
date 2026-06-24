# AURELIA — Help Center, Product Q&A, Back-in-Stock & 24h Reservation — Implementation SPEC (Этап 78A)

**Status:** SPEC / PLAN only. **No code, no schema, no migration, no design change in 78A.**
**Author stage:** 78A · **Baseline HEAD:** `059b890` · **Branch:** `main`

> **Implementation status (updated Этап 79A).** The Help Center, customer Help questions,
> product Q&A, and back-in-stock availability interest from this SPEC are now **IMPLEMENTED**
> (stage 79A, additive migration `add_support_help_qa_availability`): static curated Help content
> + search/filter + ask-a-question (`HelpQuestion`), moderated `ProductQuestion` on the PDP, and
> guest-capable `ProductAvailabilityInterest` with no-send `EmailOutbox` integration + masked-email
> admin queues. **DEFERRED (NOT built):** the entire **§E 24-hour reservation / hold** lifecycle —
> no `reservedQuantity`, no `ProductReservationHold`/`ProductReservationEvent`, no FIFO hold queue,
> no `hold_*` states, no inventory hold/release, no reservation-to-order conversion. Real email
> sending also remains owner/provider-gated. Account-page integration (§G) is deferred. See
> `docs/sale/FEATURES_AND_LIMITS.md` §1/79A.
>
> This document is a *plan*. The reservation parts below are not implemented yet. It proposes how to upgrade the
> current decorative **«Допомога»** page into a real **Help Center**, and to add **product
> questions (pre-sale Q&A)**, **back-in-stock availability notifications**, and a **short-term
> 24-hour reservation/hold** flow — all built **additively** on the systems that already exist,
> honouring every existing constraint (Ukrainian-first storefront, locked design, no real email
> sending, no payment/carrier APIs, server-authoritative inventory, no-PII analytics).

---

## 0. Context — what already exists (verified against the codebase)

This SPEC deliberately **reuses** existing foundations instead of inventing parallel systems.

| Concern | Existing building block | File(s) |
|---|---|---|
| Info/Help page rendering | `SitePage` model + static fallback `info-pages.ts` (slug allowlist incl. `help`) | `prisma/schema.prisma` (`SitePage`), `src/data/info-pages.ts`, `app/help/page.tsx`, `src/lib/site-pages/server.ts`, `src/components/content/InfoPageLayout.tsx` |
| Moderated user-submitted content | `ProductReview` (`pending`→`approved`/`rejected`), HTML-stripping validation, durable throttle, admin moderation | `src/lib/reviews/{actions,server,validate,types}.ts`, `app/admin/reviews`, `src/lib/admin/{reviews,review-actions}.ts` |
| Product interest / back-in-stock foundation | `CustomerProductInterest` (`active`/`fulfilled`/`cancelled`, login-gated, unique per customer+product+type) — **records only, sends nothing** | `prisma/schema.prisma` (`CustomerProductInterest`), `src/lib/customer/product-interest-{actions,repo}.ts`, `src/components/product/ProductInterestButton.tsx` |
| No-send email | `EmailOutbox` + provider facade → `skipped_no_provider`; body never stored | `src/lib/email/{outbox,process,provider,templates}.ts`, `app/admin/email-outbox` |
| Inventory + stock movements | `Product.stockQuantity` / `ProductVariant.stockQuantity`, race-safe `updateMany … stockQuantity >= qty`, append-only `InventoryStockMovement` ledger (shared `buildMovementInput`) | `src/lib/inventory/{stock-health,movements,inventory-actions,inventory-data}.ts`, `src/lib/orders/actions.ts`, `app/admin/inventory` |
| Durable rate limiting | `CustomerAuthThrottle` + `isThrottled/registerAttempt` (hashed key, no raw IP/email stored) | `src/lib/customer/rate-limit.ts` |
| Audit trail | `AdminAuditLog` (actor/action/summary, no secrets/PII) + customer audit events | `src/lib/admin/audit.ts`, `src/lib/customer/audit.ts` |
| Customer accounts & sessions | `Customer` (scrypt hash, `sessionVersion`), HMAC cookie session | `src/lib/customer/{session,repo,actions}.ts` |
| Admin shell | RU-labelled static sidebar; pages server-guarded (`ensureLocalAdmin`, 404 in prod) | `app/admin/_components/AdminNav.tsx`, `src/lib/admin/guard.ts` |
| Verify-script convention | `tsx prisma/verify-*.ts`, rolled-back transactions, count-before == count-after | `prisma/verify-reviews.ts` (template) |
| Smokes | `smoke:routes` (public+gated render), `smoke:admin` (authed surfaces) | `scripts/smoke/*.mjs` |

**Hard invariants this SPEC must preserve** (all confirmed present today):
1. Storefront copy is **Ukrainian-first**; admin copy is **Russian**.
2. **Design is locked** — no new CSS classes beyond reusing existing ones; no change to product
   cards, gallery, placeholders, spacing, typography, colour, or global layout.
3. **No real email is ever sent** — all notification flows terminate in the no-send outbox.
4. **Inventory is server-authoritative** and can never oversell (the `>= qty` guard pattern).
5. **No raw PII/token/secret** is ever stored in logs, analytics, admin views, or these new tables
   beyond what is strictly required, and **never displayed publicly**.
6. Admin remains **local-only** (`notFound()` in production).

---

## A. Help Center / «Допомога» upgrade

### A.1 Goal
Turn the single decorative `/help` FAQ page into a real, browsable, searchable **Help Center**:
a landing page with categories, searchable FAQ **articles**, per-category filtering, and an
**"Поставити запитання"** form that routes into an admin moderation/answer workflow — **without
live chat, external support provider, or CRM**.

### A.2 Content architecture
Two content layers, deliberately separated:

- **Curated content** (owner-authored, evergreen): `HelpCategory` + `HelpArticle`. This is the
  FAQ/knowledge base. It is **CMS-like**, mirrors the `SitePage` discipline (plain text only,
  validated + audited on write, static fallback), and is **the only Help content rendered by
  default**.
- **Customer-submitted questions** (general, not tied to a product): `HelpQuestion`. These are
  **private support tickets** by default — an answer becomes public **only** if an admin both
  answers it *and* explicitly marks it `published` (and even then it surfaces as an FAQ-style
  entry, never exposing the asker's identity/email).

> Rationale: keep the public Help Center curated and trustworthy; let customer questions feed it
> over time through moderation, exactly like reviews feed social proof.

### A.3 Categories (seeded, owner-editable)
Ukrainian display names, latin slugs, fixed seed list (owner may add/reorder later):

| sortOrder | slug | Назва (UA) | Опис (UA, short) |
|---|---|---|---|
| 10 | `orders` | Замовлення | Як оформити та відстежити замовлення |
| 20 | `payment` | Оплата | Способи оплати (зараз демо-режим) |
| 30 | `delivery` | Доставка | Доставка та отримання |
| 40 | `returns` | Повернення та обмін | Умови повернення й обміну |
| 50 | `sizing-materials` | Розміри та матеріали | Як обрати розмір; з чого зроблені прикраси |
| 60 | `care` | Догляд за прикрасами | Як зберегти вигляд покриттів і вставок |
| 70 | `gifts-packaging` | Подарунки та пакування | Подарункове пакування й супровід |
| 80 | `account` | Акаунт | Реєстрація, вхід, особистий кабінет |
| 90 | `availability` | Наявність товару | Очікування товару та сповіщення |
| 100 | `promos` | Акції та промокоди | Як застосувати промокод |

Per-category fields: `slug` (unique, latin), `name` (UA), `description` (UA, optional),
`sortOrder` (int), `isPublished` (bool, default true).

**Sample/demo content policy:** seed a small number of **honest** evergreen articles per category
(e.g. *"Зараз магазин у демо-режимі — оплату буде підключено перед запуском"*). **No fake
promises**: no invented delivery times, prices, phone numbers, legal terms, or guarantees. Seeded
articles carry `isDemo = true` so they are never misrepresented as final policy (same honesty rule
as `ProductReview.isDemo`). Where content would duplicate an existing info page (delivery/returns),
the article should **link to** that page rather than restate binding terms.

### A.4 Search & filter
- **Filter by category:** `/help/[category]` (server component; lists that category's published
  articles).
- **Search across articles:** reuse the **existing local search discipline** (word-prefix,
  markup-safe normaliser — same approach as `src/lib/catalog/search.ts`). Search runs over
  `HelpArticle.title + body + keywords` for **published** articles only. **No external search
  engine, no AI/semantic search.** Implementation is a pure helper `src/lib/help/search.ts`
  filtering an in-memory list (article volume is tiny), keeping the page statically renderable.
- **Topic chips:** optional `HelpArticle.tags string[]`-style filter rendered with **existing**
  chip classes already used by `DiscoveryControls` — **no new CSS**.

### A.5 Public visibility rules
- Only `HelpCategory.isPublished` categories and `HelpArticle.isPublished` articles render.
- `HelpQuestion` rows are **never public** unless `status = published` **and** an answer exists;
  published Q&A renders **anonymised** (no name/email/order ref shown).
- DB-error / empty Help content falls back to the **static `info-pages.ts` help page** (exactly
  the current behaviour), so the Help route can never hard-fail.

### A.6 UI flow (reusing locked design)
- Landing `/help`: intro + category grid + search box + "Поставити запитання" CTA — built from
  **existing** `InfoPageLayout`/content primitives and existing utility classes. No bespoke design.
- The "Ask a question" form is a progressive-enhancement `<form action={serverAction}>` styled with
  the **same** form classes as `ReviewForm`/checkout.

---

## B. Customer question form (general Help question → support inbox)

### B.1 Fields & policy
| Field | Required? | Notes |
|---|---|---|
| `name` | **Optional** | Display/greeting only. If blank and logged in, fall back to account name. |
| `email` | **Conditional** | Required **only if the customer wants a reply**. A clear UA note: *"Вкажіть e-mail, якщо хочете отримати відповідь. Зараз відповіді надаємо вручну — миттєвої розсилки немає."* Stored only when supplied; never harvested. |
| `category` | Required | One of the `HelpCategory` slugs (allowlist). |
| `message` | Required | Plain text, validated + HTML-stripped, length-capped (same `validate.ts` discipline as reviews). |
| `productRef` / `orderRef` | Optional | Loose strings (slug / order code). **Never** an FK; used only to help the admin triage. An order code is **not** treated as proof of ownership. |
| `consent` | Required if email given | Explicit checkbox: consent to be contacted about this question. Stored as `consentAt` timestamp + `consentText` snapshot. |
| `website` (honeypot) | n/a | Hidden anti-spam field; a non-empty value silently drops the submission as spam. |

**Recommendation:** keep `name` optional, `email` optional-but-required-for-reply, `consent`
required only when an email is supplied. This minimises PII while staying useful.

### B.2 Validation, anti-spam, privacy
- Server-side validation mirrors `src/lib/reviews/validate.ts` (trim, length caps, markup strip,
  category allowlist, email format when present).
- **Honeypot** field + **durable throttle** via the 51A limiter, keyed by `customerId` when logged
  in else hashed client IP (same helper as reviews/interest). No raw IP stored.
- **Safe generic responses:** success always returns the same message
  (*"Дякуємо! Ваше запитання отримано."*) regardless of internal state — no enumeration of whether
  an email/account exists. Errors are generic.
- Stored fields are minimal; `email`/`name` are **never** rendered on any public surface.

### B.3 Status lifecycle (`HelpQuestionStatus`)
```
new → triaged → answered → published        (answered+made public as anonymised FAQ)
new → triaged → answered → archived          (answered privately, not published)
new → spam | rejected                        (terminal, hidden)
any → archived                               (terminal soft-hide)
```
- `new`: freshly submitted (default).
- `triaged`: admin has categorised/acknowledged.
- `answered`: an admin answer is stored (`answerBody`, `answeredAt`, `answeredBy` actor label).
- `published`: answer is approved for public Help Center display (anonymised).
- `archived`: closed, kept for audit, not public.
- `spam` / `rejected`: terminal, never public, may be pruned on retention schedule.

### B.4 Email integration (no real send)
When an admin answers a question that has a `recipientEmail`, the admin action **may** enqueue a
no-send outbox row (`EmailOutbox`, a new template slot `help_answer_notification`) which terminates
at `skipped_no_provider`. **No email is delivered.** The admin UI states this plainly. The answer
body is **never** stored in the outbox (only a subject), consistent with the existing outbox privacy
rule.

---

## C. Product questions (pre-sale Q&A under product pages)

### C.1 Distinct from reviews — by design
- **Review** = post-purchase **opinion + rating** (`ProductReview`, 1–5 stars).
- **Product question** = **pre-sale/support question** about a specific product (material, size,
  availability, delivery, gift packaging, care). **No rating. No "verified purchase" notion.**

These get a **separate model, separate labels, separate UI block**, but **reuse the review
moderation pattern** (pending → approved/published; HTML-stripped; throttled; admin-moderated). This
avoids the well-known anti-pattern of overloading reviews with questions.

### C.2 Data & flow
- Model `ProductQuestion` (see §G). One question targets one `Product` (resolved by **slug →
  published product** server-side, exactly like reviews — the slug is the only client-trusted
  product ref).
- Submission: logged-in **or** guest (guest must supply a display name, like reviews). Optional
  email for reply (same no-send/consent rules as §B). Defaults to `pending`.
- **Admin answers** the question (`answerBody`, `answeredAt`, `answeredBy`) and approves it.
- **Public PDP** shows only `status = published` questions **with** an answer, rendered in a new
  **"Запитання про товар"** block beneath the existing reviews block (reusing review-list markup
  classes — no new design). Unanswered/unapproved questions are never public.
- **No auto-generated answers.** **No fake questions** (seeded demo questions, if any, carry
  `isDemo = true` and are clearly evergreen/help-style, never fabricated customer voices).

### C.3 PDP integration
- `app/product/[slug]/page.tsx` already loads reviews via `Promise.all`. Add a parallel
  `getPublishedQuestionsBySlug(slug)` read (failure-isolated, must never break the PDP).
- Pass into `ProductPageLayout` → a new `ProductQuestions` component mirroring `ProductReviews`.
- A "Поставити запитання про товар" form mirrors `ReviewForm` (same classes).

---

## D. Back-in-stock / availability notifications

### D.1 Reuse-first decision
There are **two** existing concepts:
- `CustomerProductInterest` — **login-gated**, customer-scoped, records back-in-stock interest,
  **sends nothing**. Good for **logged-in** users; keep it as-is.
- This SPEC adds a **guest-capable** availability capture, because a key use case is an unknown
  visitor leaving an email on a coming-soon product. Rather than weaken the privacy model of
  `CustomerProductInterest` (which never stores an email), introduce a **separate, email-based**
  model `ProductAvailabilityInterest` (see §G) that stores a **hashed** email for dedupe and a
  capped raw email **only** when consent is given and a (future) notification is intended.

> Recommendation: **extend, don't merge.** Logged-in interest stays in `CustomerProductInterest`
> (no email needed — the account already has one). Guest/email capture goes in the new
> `ProductAvailabilityInterest`. An admin "interest queue" unions both for counts. This keeps the
> hard-won privacy guarantees of the 69A model intact.

### D.2 Behaviour
- Customer (guest or logged-in) on a coming-soon / out-of-stock product/variant submits an email to
  be notified when it's available.
- **Dedupe:** unique on `(productId, variantId, emailHash)` so the same email can't pile up rows for
  the same item. Re-submitting is idempotent.
- **No real email.** When stock returns, the admin (or a local checker — §E.6) can transition rows
  to `notification_prepared` and enqueue a **no-send** outbox row (`back_in_stock_notification`
  template). Nothing is delivered; copy is honest.
- **Variant aware:** `variantId` nullable — interest can be product-level or variant-level.

### D.3 Privacy
- Store `emailHash = sha256(normalizedEmail)` for dedupe/counting. Store the **raw** `email` only
  when the customer explicitly consents to be contacted (and even then, never display it publicly;
  admin sees it only in the gated queue, like `EmailOutbox.recipientEmail`).
- Store `consentAt` + coarse capture context (no full IP; reuse the analytics discipline — no raw
  IP, no full UA). **No token/hash is ever exposed publicly.**
- Admin sees **counts** and statuses; raw emails only in the local-only admin queue.

### D.4 Status lifecycle (`AvailabilityInterestStatus`)
```
requested → pending_availability → queued_notification → notification_prepared
requested → cancelled
pending_availability → expired        (optional retention cleanup)
```
- `requested`: just captured.
- `pending_availability`: confirmed waiting (product still unavailable).
- `queued_notification`: stock detected available; ready to notify.
- `notification_prepared`: a **no-send** outbox row was recorded (honest terminal — nothing sent).
- `cancelled`: customer withdrew (or an unsubscribe link in a future provider world).
- `expired`: aged out by retention policy.

---

## E. 24-hour reservation / hold

This is the most delicate area. It touches **inventory** and customer expectations, so the SPEC is
deliberately conservative and **owner-gated** for the real policy decisions.

### E.1 Honesty constraints (must appear in UI copy)
- **Not a paid reservation** (no payment capture exists).
- **Not a legally binding sale.**
- **Not guaranteed** until stock is confirmed; framed as *"тимчасове бронювання"*.
- **Expires automatically** after the hold window (default **24h**).
- Copy example (UA): *"Тимчасове бронювання на 24 години. Це не оплата і не гарантія — щоб
  завершити покупку, оформіть замовлення протягом цього часу."*

### E.2 Inventory model decision — **reserved quantity, not silent decrement**
**Recommendation:** introduce an explicit **reserved** concept rather than decrementing
`stockQuantity`. A naive decrement would make held units look "sold" everywhere (cards, PDP,
inventory health) and risk leaking holds as permanent stock loss if expiry cleanup fails.

Two options were considered:

| Option | How | Pros | Cons |
|---|---|---|---|
| **(Rec.) Additive `reservedQuantity`** | New nullable `reservedQuantity` on `Product`/`ProductVariant`; *available = stockQuantity − reservedQuantity*. Hold = `reservedQuantity += qty` (guarded so `reserved ≤ stock`). | Stock truth preserved; reversible; auditable; no oversell. | Every "purchasable" read must subtract reserved (touches `stock-health.ts` + checkout availability). Additive column = small migration. |
| Movement-ledger only | Track holds purely as `InventoryStockMovement` reasons (`hold_placed`/`hold_released`) and compute reserved by summing the ledger. | No schema change to product/variant. | Hot-path availability must aggregate the ledger on every read — slow and error-prone. Rejected for v1. |

**Chosen:** additive `reservedQuantity` (nullable; `null`/`0` = none reserved, so every existing row
and the whole no-reservation path stay byte-identical to today). Plus **two new
`StockMovementReason` enum values** `hold_placed` / `hold_released` for the append-only audit ledger
(reusing `buildMovementInput`). Reservation never mutates `stockQuantity`; it only moves
`reservedQuantity`, and the **checkout availability guard** becomes
`stockQuantity − reservedQuantity >= qty`.

> ⚠️ **Migration-risk note:** adding `reservedQuantity` and changing the availability guard is the
> single most invasive change in this whole SPEC. It must ship in its **own** stage (82A) with its
> own verify script proving no-oversell under the new guard, and proving that `reserved = null`
> behaves exactly like today.

### E.3 Reservation lifecycle (`ReservationStatus`)
```
interest_requested → waitlisted → hold_offered → hold_active → hold_claimed → converted_to_order
                                       │              │
                                       │              ├→ hold_expired      (24h elapsed)
                                       │              └→ hold_cancelled     (customer/admin)
                                       └→ hold_cancelled
```
- `interest_requested`: customer asked to be held when available (may begin as a §D interest).
- `waitlisted`: queued because stock isn't available yet (or ahead of them in line).
- `hold_offered`: stock became available; an offer/hold slot is allocated to this request.
- `hold_active`: `reservedQuantity` incremented; `holdExpiresAt = now + 24h`.
- `hold_claimed`: customer started checkout against the hold (soft marker).
- `converted_to_order`: an order was created consuming the hold (reserved → real decrement).
- `hold_expired`: window elapsed; reserved released back.
- `hold_cancelled`: customer or admin released early; reserved released back.

Every transition writes an audit event (see `ProductReservationEvent`, §G) and, for
reserve/release, an `InventoryStockMovement` row.

### E.4 Fairness policy (owner decisions needed — see §5)
- **Order of service:** **oldest `interest_requested` first** (FIFO by `createdAt`).
- **When stock < interested customers:** only `min(availableUnits, queueLength)` holds are offered;
  the rest stay `waitlisted`.
- **Per-identity cap:** at most **1 active hold per (email/customer, product, variant)**; configurable
  global cap (e.g. max N active holds per identity) to deter griefing.
- **Admin override:** admin can manually offer/extend/cancel a hold from the queue (audited).
- **Hold quantity:** v1 holds **quantity 1** per reservation (simplest, lowest oversell risk).

### E.5 Interaction with checkout
- When a customer with an `hold_active` reservation places an order for that item:
  - The order tx (existing `createOrderDraft`) must, **in the same transaction**, both decrement
    `stockQuantity` *and* decrement `reservedQuantity` for the held units, then mark the reservation
    `converted_to_order`. This prevents double-counting (the held unit must not be both reserved and
    re-counted as available).
  - If the customer orders **without** going through their hold, the hold simply expires/releases
    on schedule; their order follows the normal `stockQuantity − reservedQuantity >= qty` guard.
- **No oversell, ever:** the guard `stockQuantity − reservedQuantity >= qty` plus the race-safe
  `updateMany` pattern guarantees it, exactly like the current `>= qty` decrement.

### E.6 Expiry strategy (no external cron)
- Store `holdExpiresAt`. Compute expiry **lazily**: any read of "active holds" treats
  `holdExpiresAt < now` as expired, and a small **sweep** runs opportunistically:
  - on relevant admin page loads (reservation queue, inventory),
  - at the start of the reservation server actions,
  - via an **optional** local CLI `npm run reservations:sweep` (dependency-free, like the email
    no-send processor) that releases expired holds (`reservedQuantity -= qty`, status →
    `hold_expired`, ledger `hold_released`) inside guarded transactions.
- **No external scheduler** is required for local/demo. A real deployment can later wire the same
  sweep to a real cron (owner-gated).

### E.7 Admin controls
- **View queue** per product/variant (FIFO, with status + `holdExpiresAt` countdown).
- **Offer / activate** a hold (allocate reserved units to the next waitlisted request).
- **Cancel / release** a hold early.
- **Extend** a hold (optional, owner decision — default **off** to keep "24h" honest).
- All actions audited; **no payment capture**, **no real email**.

---

## F. Admin surfaces

Proposed admin IA (RU labels, fitting the existing `AdminNav`). To avoid sidebar bloat, group the
new work under a single **«Поддержка»** hub with sub-pages, plus reuse existing pages where natural.

| Route | RU label | Purpose | Key data (safe) | Actions |
|---|---|---|---|---|
| `/admin/help` | Помощь | Manage Help categories + articles (CMS) | category/article list, publish state, isDemo flags | create/edit/publish/reorder (audited) |
| `/admin/help/questions` | Вопросы (помощь) | General Help question inbox | message, category, status, optional email/refs (gated) | triage/answer/publish/archive/spam |
| `/admin/product-questions` | Вопросы о товаре | Product Q&A moderation | product, question, status, answer | answer/approve/publish/reject |
| `/admin/availability-interests` | Ожидание наличия | Back-in-stock queue | **counts** + per-row status; raw email only in gated detail | mark prepared (no-send) / cancel / export-free |
| `/admin/reservations` | Брони | Reservation/hold queue | FIFO queue, status, `holdExpiresAt`, reserved units | offer/activate/cancel/(extend)/sweep |

**Dashboard counters** (`/admin/dashboard`, via existing `operations-dashboard*.ts`): new
"attention" tiles — *open Help questions*, *unanswered product questions*, *availability waitlist
size*, *active holds / expiring soon*. Wire through the **optional** `AttentionInput` extension
pattern already used by 65A/70A/71A so existing dashboard verifies stay green.

**Audit events** (into existing `AdminAuditLog`): `help.article.publish`, `help.question.answer`,
`help.question.publish`, `product_question.answer`, `product_question.publish`,
`availability.notification.prepared`, `reservation.hold.offered`, `reservation.hold.cancelled`,
`reservation.hold.expired`, `reservation.converted`.

**Safe customer-detail visibility:** the `/admin/customers/[id]` support view (68A) may add
read-only counters (open questions / active holds) — **never** password hashes, token hashes, email
bodies, cookies, or secrets. Raw emails appear only in the gated availability/question detail, the
same way `EmailOutbox.recipientEmail` already does.

---

## G. Data model proposal (additive only — NOT applied in 78A)

> All models follow repo conventions: `id` = cuid; `createdAt`/`updatedAt`; money never relevant
> here; UA/RU split as noted; loose ids (no FK) where history must survive deletion; cascade only
> where a child is meaningless without its parent.

### G.1 Help Center

```prisma
enum HelpQuestionStatus { new triaged answered published archived spam rejected }

model HelpCategory {
  id          String        @id @default(cuid())
  slug        String        @unique           // latin, allowlist-seeded
  name        String                          // UA display name
  description String?                         // UA, optional
  sortOrder   Int           @default(0)
  isPublished Boolean       @default(true)
  articles    HelpArticle[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  @@index([isPublished])
}

model HelpArticle {
  id          String        @id @default(cuid())
  categoryId  String
  category    HelpCategory  @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  slug        String        @unique           // latin
  title       String                          // UA
  body        String                          // UA, plain text (validated, HTML-stripped)
  keywords    String?                         // space-separated, for local search
  sortOrder   Int           @default(0)
  isPublished Boolean       @default(true)
  isDemo      Boolean       @default(false)   // honest seed labelling
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
  @@index([categoryId, isPublished])
  @@index([isPublished])
}

model HelpQuestion {
  id             String            @id @default(cuid())
  categorySlug   String                              // allowlist value (loose, survives category rename)
  // Optional author link from the VERIFIED session; null = guest. SetNull on delete.
  customerId     String?
  customer       Customer?         @relation(fields: [customerId], references: [id], onDelete: SetNull)
  authorName     String?                             // optional display name
  recipientEmail String?                             // stored only with consent; never public
  emailHash      String?                             // sha256(normalizedEmail) for dedupe/abuse
  message        String                              // plain text, validated
  productRef     String?                             // loose slug (triage hint only)
  orderRef       String?                             // loose code (NOT ownership proof)
  consentAt      DateTime?
  status         HelpQuestionStatus @default(new)
  answerBody     String?                             // admin answer, plain text
  answeredAt     DateTime?
  answeredBy     String?                             // admin actor label (never a secret)
  isDemo         Boolean           @default(false)
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt
  @@index([status])
  @@index([categorySlug])
  @@index([emailHash])
}
```
Privacy: `recipientEmail`/`authorName` never rendered publicly; published Q&A is anonymised.
Retention: `spam`/`rejected` prunable after N days; emails clearable on cancel.

### G.2 Product Q&A

```prisma
enum ProductQuestionStatus { pending approved published rejected }

model ProductQuestion {
  id             String                @id @default(cuid())
  productId      String
  product        Product               @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerId     String?
  customer       Customer?             @relation(fields: [customerId], references: [id], onDelete: SetNull)
  authorName     String                                  // required (guest must supply)
  recipientEmail String?                                 // consent-only; never public
  emailHash      String?
  body           String                                  // the question, plain text
  answerBody     String?                                 // admin answer
  answeredAt     DateTime?
  answeredBy     String?
  status         ProductQuestionStatus @default(pending)
  isDemo         Boolean               @default(false)
  consentAt      DateTime?
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  @@index([productId, status])
  @@index([status])
}
```
Mirrors `ProductReview` privacy posture exactly (no email/phone/IP/token stored beyond consented
email; HTML stripped; default not-public; cascade on product delete; SetNull on customer delete).

### G.3 Availability interest (guest-capable, email-based)

```prisma
enum AvailabilityInterestStatus { requested pending_availability queued_notification notification_prepared cancelled expired }

model ProductAvailabilityInterest {
  id          String                     @id @default(cuid())
  productId   String
  product     Product                    @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId   String?                                          // null = product-level
  // Optional verified-session link; guests have null and rely on emailHash.
  customerId  String?
  customer    Customer?                  @relation(fields: [customerId], references: [id], onDelete: SetNull)
  email       String?                                          // raw, consent-only; never public
  emailHash   String                                           // sha256(normalizedEmail), for dedupe
  status      AvailabilityInterestStatus @default(requested)
  consentAt   DateTime?
  notifiedAt  DateTime?                                        // when a no-send row was prepared
  createdAt   DateTime                   @default(now())
  updatedAt   DateTime                   @updatedAt
  @@unique([productId, variantId, emailHash])                  // dedupe per item+email
  @@index([productId, status])
  @@index([emailHash])
}
```
> Decision: this is **separate** from `CustomerProductInterest` (which stores **no** email and is
> login-only). The two are unioned for admin counts.

### G.4 Reservation hold + audit

```prisma
enum ReservationStatus {
  interest_requested waitlisted hold_offered hold_active hold_claimed
  converted_to_order hold_expired hold_cancelled
}

model ProductReservationHold {
  id            String            @id @default(cuid())
  productId     String
  product       Product           @relation(fields: [productId], references: [id], onDelete: Cascade)
  variantId     String?
  customerId    String?
  customer      Customer?         @relation(fields: [customerId], references: [id], onDelete: SetNull)
  email         String?                                  // consent-only; never public
  emailHash     String?
  quantity      Int               @default(1)            // v1: always 1
  status        ReservationStatus @default(interest_requested)
  holdExpiresAt DateTime?                                // set when hold_active; null otherwise
  orderCode     String?                                  // loose ref when converted
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt
  @@index([productId, status])
  @@index([status])
  @@index([holdExpiresAt])
}

model ProductReservationEvent {                          // append-only audit trail
  id            String   @id @default(cuid())
  reservationId String?                                  // loose (survives hold delete)
  productId     String?
  variantId     String?
  fromStatus    String?
  toStatus      String
  actorLabel    String?                                  // admin/customer/system, never a secret
  note          String?                                  // short validated text
  createdAt     DateTime @default(now())
  @@index([reservationId])
  @@index([createdAt])
}
```

### G.5 Additive fields on existing models (the invasive part)

```prisma
// Product / ProductVariant — additive, nullable, default semantics = today
reservedQuantity Int?   // null/0 = none; available = stockQuantity - reservedQuantity

// StockMovementReason — two new audit reasons
enum StockMovementReason { ...existing, hold_placed, hold_released }

// EmailTemplate — new no-send template slots
enum EmailTemplate { ...existing, help_answer_notification, back_in_stock_notification, reservation_offer }

// Customer — back-relations
helpQuestions        HelpQuestion[]
productQuestions     ProductQuestion[]
availabilityInterests ProductAvailabilityInterest[]
reservationHolds     ProductReservationHold[]
```

**Migration risk summary**
| Change | Risk | Mitigation |
|---|---|---|
| New tables (Help*, ProductQuestion, AvailabilityInterest, Reservation*) | **Low** (purely additive) | standard additive migration + DB backup |
| New enum values (StockMovementReason, EmailTemplate) | **Low** | additive enum members only |
| `reservedQuantity` column | **Low to add**, **Medium to wire** | nullable default-null = no behaviour change until reservation code reads it; gate behind 82A |
| Availability guard change (`stock − reserved >= qty`) | **Medium** | dedicated verify proving no-oversell + null-reserved == today; ship in 82A only |

---

## H. Routes & UI plan

### Public
| Route | Purpose | Data | Actions | Access | Empty/Errors |
|---|---|---|---|---|---|
| `/help` | Help Center landing | published categories + search box + CTA | search, navigate, open ask form | public | DB-empty → static `info-pages.ts` help fallback |
| `/help/[category]` | Category articles | published articles in category | filter/search within | public | unknown/empty category → fallback or notFound |
| `/help` ask form (server action) | Submit general question | — | submit (honeypot+throttle) | public | generic success/error |
| PDP `Запитання про товар` block | Product Q&A | published+answered questions | submit question | public | "Поки немає запитань" empty state (reuse `ReviewsEmpty` style) |
| PDP availability form | Back-in-stock capture | — | submit email+consent | public (coming-soon/out-of-stock only) | honest no-send copy |
| PDP reservation CTA | Request 24h hold | hold state if any | request/cancel | public, honest disclaimer | shown only when policy enabled by owner |
| `/account` sections | "Мої запитання" / "Мої бронювання" | the customer's own questions/holds (scoped) | cancel hold/withdraw | logged-in | empty states reuse account styles |

### Admin
See §F table. All under `ensureLocalAdmin` (404 in prod), all mutations audited, all validated.

---

## I. Security & privacy review

| Risk | Vector | Mitigation |
|---|---|---|
| **Spam questions** | Bot floods Help/product Q&A | Honeypot + durable throttle (51A limiter, hashed key) + moderation default-not-public |
| **Email harvesting** | Enumerate emails via responses | Generic success messages; no "email exists" signals; emails never rendered publicly |
| **Reservation abuse / griefing** | One actor holds all stock to block sales | Per-identity hold cap (1 per item, global cap); FIFO; 24h auto-expiry; admin override; quantity=1 |
| **Stock griefing / oversell** | Race to over-reserve or over-order | `stock − reserved >= qty` guard via race-safe `updateMany`; reserve & release in one tx; ledger audit |
| **Enumeration** | Order/product refs reveal data | `orderRef` is a triage hint only, never treated as ownership proof and never echoed publicly |
| **PII leakage** | Emails/names exposed | Raw email stored only with consent; shown only in gated admin detail; `emailHash` for dedupe; no full IP/UA |
| **Admin data leakage** | Support views over-expose | Reuse existing safe-select discipline: no password/token hashes, no email bodies, no cookies/secrets |
| **CSRF / replay** | Forged form posts | Next server actions (same-origin, action tokens) as used by reviews/checkout; idempotent dedupe constraints |
| **Stored XSS** | Markup in question/answer | Server-side HTML-strip + length caps (reuse `validate.ts`); plain-text rendering; existing `serializeJsonLd` escaping unaffected |
| **Hold leak on crash** | Expiry sweep never runs → reserved stuck | Lazy expiry on read + opportunistic sweep + `npm run reservations:sweep`; reserved is recomputable/releasable |

A **security/privacy checklist** mirroring `scripts/security/public-demo-check.mjs` should assert:
no raw email in any public query/select; honeypot present; throttle keyed+hashed; reservations can't
oversell; audit events emitted; no token/secret in new tables.

---

## J. Implementation staging

Grouped to keep each stage **independently shippable, low-risk, and one-commit**.

### Stage 79A — Help Center foundation
- **Scope:** `HelpCategory`/`HelpArticle` models + seed; `/help` + `/help/[category]`; local search
  helper; admin `/admin/help`; static fallback preserved. (No Q&A submission yet — read + CMS first.)
- **Files:** `prisma/schema.prisma` (+migration), `app/help/*`, `src/lib/help/*`,
  `app/admin/help/*`, `src/lib/admin/help*.ts`, seed script, `prisma/verify-help-center.ts`.
- **Migration:** **Yes** (additive: two tables).
- **Checks:** typecheck, prisma validate, `db:verify:help-center`, route smoke (`/help`,
  `/help/[category]`), admin smoke (`/admin/help`).
- **Risks:** Low. Fallback guarantees `/help` never breaks.
- **Rollback:** revert commit; migration is additive (drop new tables) — back up DB first.
- **Must NOT touch:** product cards/gallery/checkout/inventory; existing info-pages fallback.
- **Commit:** `feat: help center foundation (categories, articles, search)`

### Stage 80A — General Help questions + Product Q&A
- **Scope:** `HelpQuestion` + `ProductQuestion` models; ask-a-question forms (Help + PDP); admin
  inboxes `/admin/help/questions`, `/admin/product-questions`; public published Q&A on PDP; no-send
  answer-notification template slot.
- **Files:** schema (+migration), `src/lib/help/question-*`, `src/lib/product-qa/*`,
  `src/components/product/ProductQuestions.tsx` + form, `app/admin/help/questions/*`,
  `app/admin/product-questions/*`, `src/lib/email/templates.ts` (+slot), verifies.
- **Migration:** **Yes** (additive: two tables, one enum value on EmailTemplate).
- **Checks:** typecheck, prisma validate, `db:verify:help-questions`, `db:verify:product-questions`,
  route + admin smokes.
- **Risks:** Low–Medium (PDP integration must be failure-isolated).
- **Rollback:** revert; drop new tables.
- **Must NOT touch:** reviews data/model (distinct); design.
- **Commit:** `feat: customer questions + product Q&A with moderation`

### Stage 81A — Back-in-stock availability + no-send notification
- **Scope:** `ProductAvailabilityInterest` (guest-capable, email-hash dedupe); PDP availability
  form; admin `/admin/availability-interests` (counts + gated detail); no-send
  `back_in_stock_notification` outbox integration; union counts with `CustomerProductInterest`.
- **Files:** schema (+migration), `src/lib/availability/*`, PDP form component, admin page,
  `src/lib/email/templates.ts`, verify.
- **Migration:** **Yes** (additive: one table, one enum value).
- **Checks:** typecheck, prisma validate, `db:verify:availability-interests`, smokes.
- **Risks:** Low. No inventory mutation here.
- **Rollback:** revert; drop table.
- **Must NOT touch:** `stockQuantity`; `CustomerProductInterest` privacy model.
- **Commit:** `feat: back-in-stock availability interest (no-send)`

### Stage 82A — 24h reservation / hold lifecycle (**most invasive**)
- **Scope:** `ProductReservationHold` + `ProductReservationEvent`; additive `reservedQuantity`;
  `hold_placed`/`hold_released` reasons; availability guard `stock − reserved >= qty`; lazy expiry
  + `reservations:sweep` CLI; checkout integration (convert hold in the order tx); admin
  `/admin/reservations`; account "Мої бронювання".
- **Files:** schema (+migration), `src/lib/reservations/*`, `src/lib/inventory/stock-health.ts`
  (subtract reserved), `src/lib/orders/{pricing,actions}.ts` (guard + convert), admin/account UI,
  `scripts/reservations/sweep.mjs`, `prisma/verify-reservations.ts`.
- **Migration:** **Yes** (additive tables + nullable column + enum values).
- **Checks:** typecheck, prisma validate, `db:verify:reservations` (**must prove**: no oversell
  under the new guard; `reserved = null` behaves exactly like today; expiry releases reserved;
  convert-in-order-tx never double-counts), full route/admin smokes, build.
- **Risks:** **Medium** (touches the checkout availability path). Heavy verify + rollback transactions.
- **Rollback:** revert commit; drop new tables/columns; the nullable `reservedQuantity` defaulting
  to null means rollback restores exact prior behaviour.
- **Must NOT touch:** payment, real email, design, oversell guarantees.
- **Commit:** `feat: 24h temporary reservation holds with reserved inventory`

### Stage 83A — Admin/support dashboard integration + audit/readiness/docs
- **Scope:** dashboard "attention" tiles (optional `AttentionInput` extension); audit events wired;
  readiness rules (71A) for Help/QA/reservation content; security/privacy checker; sale-docs +
  readiness doc updates; SCREENSHOT inventory note.
- **Files:** `src/lib/admin/operations-dashboard*.ts`, `src/lib/product-readiness/rules.ts`,
  `scripts/security/*`, `scripts/demo/sale-docs-check.mjs` guards, docs.
- **Migration:** **No.**
- **Checks:** full suite green (typecheck, prisma validate, all `db:verify:*`, smokes, build,
  sale-docs-check, preflight, security checks).
- **Risks:** Low.
- **Rollback:** revert; docs/config only.
- **Commit:** `feat: support ops dashboard + audit/readiness + docs`

**Recommended first stage to implement: 79A** (pure additive value, lowest risk, unblocks the rest).
**Defer 82A** until the owner answers the reservation policy questions (§5) — it is the only
stage that changes the inventory availability path.

---

## K. Check / test plan

Per stage, run (and add) the following — all already-established patterns in this repo:

- `npm run typecheck` — every stage.
- `npx prisma validate` — every schema-touching stage.
- **Migration check:** generate migration → `prisma migrate diff`/`validate`; **DB backup**
  (`aurelia-db-backup.ps1`) before applying; apply only on the isolated 6700 DB.
- **Route smokes** (`smoke:routes`): add `/help`, `/help/[category]`; confirm PDP still 200.
- **Admin smokes** (`smoke:admin`): add `/admin/help`, `/admin/help/questions`,
  `/admin/product-questions`, `/admin/availability-interests`, `/admin/reservations` (authed render
  + gated-unauthed).
- **New `db:verify:*` scripts** (tsx, rolled-back transactions, count-before == count-after):
  - `db:verify:help-center` — category/article publish visibility + local search + fallback.
  - `db:verify:help-questions` / `db:verify:product-questions` — default-not-public, moderation
    flips status, public read returns published+answered only, HTML stripped, honeypot/throttle.
  - `db:verify:availability-interests` — dedupe unique constraint, no raw email in public read,
    no-send terminal status, union counts.
  - `db:verify:reservations` — FIFO offer, per-identity cap, `stock − reserved >= qty` no-oversell,
    null-reserved == legacy, 24h expiry release, convert-in-order-tx single-count, nothing committed.
- **Security/privacy checks:** extend `scripts/security/public-demo-check.mjs` (or a new
  `security:support`) — assert no raw email in public selects, honeypot present, throttle hashed,
  reservations can't oversell, audit events present, no token/secret in new tables.
- **Docs:** update `docs/sale/FEATURES_AND_LIMITS.md` (honest "Help Center + Q&A + back-in-stock
  records + temporary holds; **no real email**, **no paid reservation**"), readiness reports, and
  `sale-docs-check.mjs` reality block + guards (forbid claims of: live chat, CRM, real
  notifications, guaranteed/paid reservations, automatic restock emails).

---

## Appendix — open decisions for the owner (summary, see also §5 of the report)
1. Guest email allowed for availability/reservation, or **account required**?
2. Does a reservation **require an account**, or is guest+email OK?
3. Is the hold window **exactly 24h**, fixed, or owner-configurable?
4. May admins **manually override / extend** holds (extend defaults **off** to keep "24h" honest)?
5. Per-identity hold cap value; behaviour when **stock < waitlist**.
6. Confirm real email stays **no-send** until a provider decision (assumed **yes**).
7. Confirm reservation is framed as **non-binding, unpaid, auto-expiring** in all copy (assumed **yes**).
```
