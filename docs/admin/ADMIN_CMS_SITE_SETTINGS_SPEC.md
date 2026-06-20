# Admin CMS / Site Settings SPEC — AURELIA

> **Stage 46B — implementation SPEC only.** This document adds **no** runtime code,
> UI, CSS, Prisma schema change, migration, env, or deploy. It specifies the
> **safe CMS / site-settings foundation** that 46C+ will implement.
>
> Parent plan: [`../RED_ORANGE_FUNCTIONAL_CLOSURE_ROADMAP.md`](../RED_ORANGE_FUNCTIONAL_CLOSURE_ROADMAP.md)
> (46A named this the best immediate implementable target). Related:
> [`../backend/ADMIN_SUPERPANEL_ROADMAP.md`](../backend/ADMIN_SUPERPANEL_ROADMAP.md),
> [`../backend/SECURITY_NOTES.md`](../backend/SECURITY_NOTES.md),
> [`../backend/ADMIN_AUDIT_LOG.md`](../backend/ADMIN_AUDIT_LOG.md),
> [`../sale/FEATURES_AND_LIMITS.md`](../sale/FEATURES_AND_LIMITS.md).
>
> **Design is approved and locked.** This is a *content/settings* editor, **not** a
> page builder. Nothing here changes layout, CSS, or composition.

---

## 1. Purpose

Give the owner/admin a **safe, bounded** way to edit **business-facing text and
settings** (brand name, contacts, social links, info-page copy, manual
payment/delivery wording) without a developer and without touching design.

It is explicitly **a constrained content/settings store**, not a freeform
"constructor": no drag-and-drop, no layout editing, no raw HTML, no theme editor.
The locked, approved visual design renders the edited *values* through the **existing**
components, unchanged.

---

## 2. Current state (verified against the repo, 2026-06-20)

- **Admin already handles** products/orders/gallery/variants/stock with a consistent
  server-action pattern: every mutation calls `ensureLocalAdmin()` +
  `requireAdminSession()`, validates with a pure parser, writes via Prisma, records an
  audit row (`recordAuditEvent` / `AUDIT_ACTIONS`), `revalidatePath`s storefront
  surfaces, and `redirect`s with `?ok=`/`?err=` (see `src/lib/admin/catalog-actions.ts`).
- **Storefront copy is mostly static/source-coded.** Brand name `AURELIA`, tagline
  `Bijouterie without limits`, footer brand paragraph, subscribe block copy, and the
  `© 2026 AURELIA` line are hardcoded in `src/components/layout/Footer.tsx`.
- **Info pages are source data.** `src/data/info-pages.ts` exports a typed
  `Record<string, InfoPage>` for `delivery / returns / stores / help / about /
  contacts`, rendered by `InfoPageLayout`. All copy is honest pre-launch placeholder
  ("…буде уточнено перед запуском").
- **Checkout payment/delivery labels are source-coded.** `src/lib/orders/methods.ts`
  owns the allowlist **keys** (`self_pickup`/`nova_poshta`/`ukrposhta`/`local_courier`,
  `cash_on_delivery`/`manual_online`) and their Ukrainian **labels**. Keys are a
  validation contract; labels/notices are presentation copy.
- **No site-settings table or config UI yet.** `app/admin/settings/page.tsx` is an
  `AdminPlaceholder`; `/admin/settings` already exists in `AdminNav`. Prisma has
  `Category / Product / ProductVariant / ProductImage / Order / OrderItem /
  AnalyticsEvent / AdminAuditLog` — **no** `SiteSetting` / `SitePage` / `AdminUser`.
- **Admin is local/internal by design.** `ensureLocalAdmin()` → `notFound()` under
  `NODE_ENV=production` or a non-local host; identity via `requireAdminSession()`.
- **Design is locked**; admin UI is Russian/internal, storefront is Ukrainian.

---

## 3. Goals

- Let the owner/admin **edit business-facing content/settings safely** (text, contacts,
  links) through the admin, persisted in the DB.
- **Reduce developer dependency** for common changes (brand name, phone/email, social
  links, info-page wording, manual payment/delivery copy).
- **Preserve the current visual design exactly** — values flow through the existing
  components; no markup/CSS/layout change.
- **Prepare for buyer adaptation** — a new owner can rebrand text/contacts without code.
- Reuse the **existing admin conventions** (guard + session + parser + audit +
  revalidate + redirect) so the CMS is consistent and auditable.

---

## 4. Non-goals (explicit)

- ❌ No visual page builder / section composer.
- ❌ No drag-and-drop.
- ❌ No layout / CSS / design-token / spacing / typography / color editing.
- ❌ No arbitrary raw HTML (v1 is plain text / a tightly-constrained subset only).
- ❌ No theme editor / no logo-as-CSS / no font switching.
- ❌ No payment provider API implementation.
- ❌ No delivery carrier API implementation.
- ❌ No customer account / auth work (that is the separate 47-series).
- ❌ No change to payment/delivery **allowlist keys** in `methods.ts` (labels only).
- ❌ No public admin exposure (stays local/dev + session-gated, `noindex`, 404 in prod).
- ❌ No new secrets/env, and no secrets ever stored in CMS settings.

---

## 5. Editable content v1 scope

Proposed first safe editable areas. "Include in v1?" marks the **minimum** shippable
slice (46C/46D); the rest are sequenced into later stages (§12).

| Area | Current source | Proposed storage | Admin UI | Risk | Include in v1? |
|---|---|---|---|---|---|
| Brand display name | `Footer.tsx` (`AURELIA`) | `SiteSetting` key `brand.name` (text) | Settings form field | Low | **Yes (46C/46D)** |
| Brand tagline | `Footer.tsx` (`Bijouterie without limits`) | `brand.tagline` (text) | Settings field | Low | **Yes (46D)** |
| Brand footer blurb | `Footer.tsx` brand paragraph | `brand.footerBlurb` (text) | Settings textarea | Low | **Yes (46D)** |
| Public phone | none (no real contact yet) | `contact.phone` (text) | Settings field | Low | **Yes (46D)** |
| Public email | none | `contact.email` (email) | Settings field | Low | **Yes (46D)** |
| Public address / city | none | `contact.address` (text) | Settings field | Low | **Yes (46D)** |
| Working hours | none | `contact.hours` (text) | Settings field | Low | **Yes (46D)** |
| Social links (IG/TG/etc.) | none | `social.instagram` / `social.telegram` … (url) | Settings url fields | Low–Med (URL validation) | **Yes (46D)** |
| Footer copyright/notice text | `Footer.tsx` (`© 2026 …`) | `footer.copyright` (text) | Settings field | Low | **Yes (46D)** |
| Info pages content (delivery/returns/stores/help/about/contacts) | `src/data/info-pages.ts` | `SitePage` (structured, see §7) | Content editor | Med (structured + sanitize) | **No → 46E** |
| Manual payment/delivery public copy (notices) | `methods.ts` labels + info pages | `copy.payment.*` / `copy.delivery.*` (text) | Settings fields | Med (must stay honest) | **No → 46F** |
| Checkout helper notes | checkout components / methods labels | `copy.checkout.note` (text) | Settings field | Med | **No → 46F** |
| SEO title/description basics | per-page `metadata` | `seo.home.title` / `seo.home.description` (text) | Settings fields | Med (length limits) | **No → optional, 46G** |
| Homepage text blocks | `src/components/home/*` (SeoTextBlock, promo captions) | `home.*` (text) | Settings fields | Med (must not become layout) | **No → 46G, only if still needed** |

**Allowlist note:** payment/delivery **method keys** never become editable — only their
**display copy** does, and even then the honest "manual / demo, no real acquiring"
framing must be preserved (see §10 and `FEATURES_AND_LIMITS.md`).

---

## 6. Locked content/design (must NOT become editable)

- Layout grid / page structure / section order.
- Card design and product-card structure.
- Placeholder visuals (the gem placeholder) and gallery visuals.
- Spacing, typography, colors, hover states (design tokens in `src/styles/*`).
- Checkout structure and flow.
- Admin shell layout (`app/admin/layout.tsx`, `AdminNav`).
- Raw HTML / CSS / inline styles in any editable field.
- Arbitrary JavaScript / `<script>` / event handlers / embeds.
- Anything in `docs/design/*` (approved prototype) and the screenshots.

The rule: **CMS edits the words and a few settings; components and CSS own the look.**

---

## 7. Data model proposal

Two candidate shapes; v1 recommends the smaller one and defers the second.

**Approach A — key-value `SiteSetting` (RECOMMENDED for v1, 46C/46D).**

```prisma
/// Owner-editable site setting (Этап 46C). Key-value, content/settings ONLY —
/// never secrets, never markup/layout. Read server-side with a static fallback.
model SiteSetting {
  id        String          @id @default(cuid())
  /// Stable dotted key from an allowlist, e.g. "brand.name", "contact.email".
  key       String          @unique
  /// Editor input type → validation rule (text | textarea | email | url | bool).
  type      SiteSettingType @default(text)
  /// The plain-text value (no HTML). Empty string allowed; null not used.
  value     String
  /// Lets the storefront fall back to the static default when unpublished.
  isPublished Boolean       @default(true)
  /// Optional actor (admin session subject) of the last edit. Never a secret.
  updatedBy String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

enum SiteSettingType {
  text
  textarea
  email
  url
  bool
}
```

- **Pros:** tiny, additive, one table, trivial seed/backfill, matches the catalog
  mutation/audit pattern; each key is independently validated by an allowlist.
- **Cons:** not ideal for richly-structured multi-section content (info pages).

**Approach B — structured `SitePage` (DEFERRED to 46E for info pages).**

```prisma
/// Owner-editable info page (Этап 46E). Structured body mirrors InfoPage shape
/// (intro/notice/sections[]) so InfoPageLayout renders it unchanged.
model SitePage {
  id              String   @id @default(cuid())
  slug            String   @unique   // delivery | returns | stores | help | about | contacts
  title           String
  metaTitle       String
  metaDescription String
  intro           String?
  notice          String?
  /// Sections as validated JSON matching InfoSection[] (heading/paragraphs/
  /// bullets/faq). Plain text only — no HTML; shape validated on write.
  body            Json
  isPublished     Boolean  @default(true)
  updatedBy       String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

- **Pros:** preserves the existing `InfoPage` structure → same renderer, same look.
- **Cons:** JSON body needs a strict shape validator (reuse/port the `InfoPage`/
  `InfoSection` types as a zod-style guard) to avoid malformed/abusive content.

**Rejected:** a single opaque JSON-blob "site config" — harder to validate per-field,
easy to smuggle unsafe content, poor audit granularity.

**Recommendation:** v1 = **Approach A (`SiteSetting`) only** for scalars/copy
(46C/46D/46F/46G). Add **Approach B (`SitePage`)** in 46E when info-page editing lands.
Both are **additive** (no change to existing models). No `AdminUser` model is needed —
`updatedBy` stays a string, exactly like `AdminAuditLog.actor`.

---

## 8. Admin UI proposal

- **`/admin/settings`** — replace the placeholder with the v1 settings form:
  grouped sections (Brand / Contacts / Social / Footer), one input per allowlisted
  `SiteSetting` key, типы → input kinds (text/textarea/email/url/checkbox). Server
  action `updateSiteSettingsAction(formData)` in a new
  `src/lib/admin/settings-actions.ts`, mirroring `catalog-actions.ts`:
  `ensureLocalAdmin()` → `requireAdminSession()` → pure parser/validator
  (`src/lib/admin/settings-form.ts`) → `prisma.siteSetting.upsert` per key →
  `recordAuditEvent` → `revalidatePath` affected storefront paths → `redirect`
  `/admin/settings?ok=saved` (or `?err=<code>`).
- **`/admin/content`** (or `/admin/pages`) — added in **46E** for `SitePage` editing:
  list the six info pages; an edit form per page (intro/notice + sections). Same action
  pattern; revalidates the matching `/delivery`, `/returns`, … route.
- **Edit forms:** server components rendering current values; submit via form `action`
  (no client JS required, matching the existing admin). Inline `?ok=`/`?err=` notice
  (same mechanism as catalog).
- **Save/cancel:** Save submits; Cancel is a link back to the section (no dirty-state
  JS in v1). Invalid input → `redirect(?err=<field>)`; the form re-renders with the
  submitted values and an error message.
- **Preview/read-only links:** provide a plain link to the public surface (e.g.
  "Открыть на витрине" → `/delivery`) — **no** special preview/draft mode in v1
  (kept as an open question, §14).
- **Audit log events:** new stable actions, e.g. `admin.settings.updated` and (46E)
  `admin.page.updated`, added to `AUDIT_ACTIONS` + `AUDIT_ACTION_LABELS`; summary names
  the changed keys/page (never the secret-free values verbatim if long — summarize).
- **Nav:** `/admin/settings` already exists in `AdminNav`; add a `/admin/content` item
  in 46E. No admin shell layout change.

---

## 9. Storefront integration approach

- **Server-side read.** A small server helper (`src/lib/site-settings/server.ts`)
  loads settings (e.g. `getSiteSettings()` returning a typed map) in server components
  (Footer, info pages, checkout copy). No client fetch; no settings in client bundles.
- **Fallback to existing static defaults.** Each key has a **code-level default** equal
  to today's hardcoded value. If the row is missing, unpublished, empty, or the DB read
  fails, the component renders the **current static default** → the storefront looks
  identical to today even before any row exists. The static `src/data/info-pages.ts`
  and `Footer` literals become the **fallback constants** (kept, not deleted).
- **No client-side secrets** — settings are public business copy only.
- **Cache/revalidate.** Reads run in already-server-rendered surfaces; writes call
  `revalidatePath` for exactly the affected routes (Footer is global → revalidate `/`
  and the affected info routes; info-page edits revalidate that page). Matches the
  catalog revalidation approach.
- **Failure behavior.** Read failure is non-fatal: log + use static default (never throw
  into the page). A missing key is treated as "use default", not an error.

---

## 10. Security and validation

- **Admin auth required** for every mutation: `ensureLocalAdmin()` +
  `requireAdminSession()` first, exactly like catalog actions (404 in prod / non-local;
  unauthenticated POST redirects to login, never mutates).
- **CSRF:** match the **existing** admin mutation posture (same-origin form POSTs under
  the local/session gate). If/when the catalog actions adopt an explicit CSRF token,
  settings actions adopt the identical mechanism — do not invent a divergent one.
- **Key allowlist:** only keys in a server-side allowlist are writable; unknown keys are
  rejected (`?err=key`). No client-supplied key can create arbitrary settings.
- **Per-type validation** (in `settings-form.ts`, pure + testable):
  - length limits per field (e.g. name ≤ 80, tagline ≤ 120, textarea ≤ 2000, SEO
    title ≤ 70 / description ≤ 200);
  - `email` → format check; `url` (social) → must be `https://` and a valid URL host;
  - `bool` → strict on/off;
  - **strip/reject HTML:** no `<` tags, no `<script>`, no inline event handlers, no
    `javascript:`/`data:` URLs — plain text only in v1.
- **No raw HTML** unless a later, explicitly-approved stage adds a **sanitized**
  constrained subset (not in v1; tracked in §14).
- **Audit log** an entry per save (`admin.settings.updated`, 46E `admin.page.updated`),
  listing changed keys/page — no secrets, no full PII, per `SECURITY_NOTES.md`.
- **No secrets in CMS:** the settings store is for **public** business copy only — never
  API keys, passwords, tokens, env values, or payment/carrier credentials. The allowlist
  enforces this by construction (no secret-shaped keys exist).
- **Honesty constraint:** payment/delivery copy edits must not assert real online
  acquiring / carrier integration that does not exist (keep the manual/demo framing).

---

## 11. Migration / backfill strategy

- **Additive migration only** (46C): create `SiteSetting` (+ `SiteSettingType` enum);
  46E adds `SitePage`. **No** change to existing tables, **no** column drops, **no**
  destructive operations.
- **Seed defaults from current static copy** via the existing idempotent `prisma/seed.ts`
  (upsert by unique `key` / `slug`) so re-running never duplicates or overwrites edited
  rows unexpectedly — seed only fills missing keys.
- **No deletion** of existing data; static literals are retained as code fallbacks.
- **Backup before any DB write stage:** run `npm run db:backup` before applying the
  migration on the local AURELIA DB (port 6700).
- **No reset/drop/seed-wipe.** Never `prisma migrate reset`; never drop the DB; the
  dm-bot PostgreSQL on `:5432` is untouched. (All of this is **46C+**, not this stage.)

---

## 12. Implementation stages

Each stage = one focused commit + checks. SPEC (this doc) precedes all of them.

- **46C — Data model + admin settings foundation.** Add `SiteSetting`(+enum) to schema,
  additive migration, seed defaults, `settings-form.ts` validator,
  `settings-actions.ts` (`updateSiteSettingsAction`), replace the `/admin/settings`
  placeholder with the Brand-group form, audit action `admin.settings.updated`, a
  `db:verify:site-settings` script. **No storefront wiring yet** beyond reading brand
  name (or keep storefront on fallback until 46D).
- **46D — Public contact/footer/settings integration.** `getSiteSettings()` server
  helper + fallbacks; wire Footer brand/tagline/blurb/copyright and contact/social
  values; extend the settings form (Contacts/Social/Footer groups); revalidation.
- **46E — Info pages CMS.** Add `SitePage`, migration, seed from `info-pages.ts`,
  shape validator, `/admin/content` editor, wire `InfoPageLayout` to DB-with-fallback,
  audit `admin.page.updated`.
- **46F — Checkout manual copy settings.** Editable payment/delivery **notice copy**
  (keys unchanged), honest framing enforced; wire checkout/info surfaces.
- **46G — Homepage text-block settings (only if still needed).** A few low-risk copy
  fields (SEO text/promo captions) — **no** layout exposure; skip if not required.

Manual + COD remain unaffected; no provider/auth work is introduced by any 46-stage.

---

## 13. Acceptance criteria

- Admin can edit the v1 settings and the change persists (DB row upserted).
- Storefront renders the edited value through the **existing** components.
- **Fallback works:** with no row / unpublished / empty / DB-read failure, the
  storefront renders the original static default (visually identical to today).
- **No design changes:** layout, CSS, cards, gallery, spacing, typography, colors,
  hover states unchanged; verified against the locked prototype/screenshots.
- `npm run typecheck` passes; `npm run build` passes.
- `prisma validate` passes; the relevant `db:verify:*` script passes (e.g. a new
  `db:verify:site-settings` asserting upsert + read-with-fallback).
- Audit log records each settings/page change (`admin.settings.updated` /
  `admin.page.updated`).
- **No secrets / no `.env` changes / no public admin exposure**; admin still 404s in
  production and stays session-gated locally.

---

## 14. Open questions

- **Ukrainian-only vs future multilingual settings.** v1 stores single-locale values
  (storefront is uk-UA). Add a `locale` column later only if uk-UA/EN is committed.
- **Who edits legal texts** (offer/оферта/privacy/returns terms). The CMS provides
  editable *slots*; the **owner/lawyer supplies the wording** — we never author legal
  text. Decide whether these live in `SitePage` (46E) or a dedicated legal group.
- **Homepage blocks in v1?** Recommend **deferring** (46G, only if needed) to avoid any
  drift toward a layout builder.
- **Preview/draft mode?** v1 has none (publish-on-save + fallback). Decide later whether
  a draft/preview is worth the complexity.
- **Admin language.** Admin stays Russian/internal by design; whether to localize the
  admin to Ukrainian is a separate, later decision (out of scope here).
- **Constrained rich text** (bold/links) for info pages — only behind an explicit,
  sanitized, separately-approved stage; **not** v1.

---

## 15. Recommended next implementation

- **Next stage: 46C — Site Settings data model + admin settings foundation.**
- **Likely files to change (46C):**
  - `prisma/schema.prisma` — add `SiteSetting` + `SiteSettingType` (additive).
  - `prisma/migrations/<new>/` — additive migration (generated; applied on DB 6700).
  - `prisma/seed.ts` — idempotent upsert of default keys from current static copy.
  - `src/lib/admin/settings-form.ts` — pure validator/parser (new).
  - `src/lib/admin/settings-actions.ts` — `updateSiteSettingsAction` (new).
  - `src/lib/admin/audit.ts` — add `admin.settings.updated` action + label.
  - `app/admin/settings/page.tsx` — replace placeholder with the Brand-group form.
  - `prisma/verify-site-settings.ts` + a `db:verify:site-settings` script (new).
  - (Storefront wiring deferred to 46D; `Footer`/`info-pages` untouched in 46C unless
    reading only the brand name.)
- **Checks to run (46C):** `npm run prisma:validate`, `npm run typecheck`,
  `npm run build`, `npm run db:backup` (before migrate), `npm run db:migrate`,
  `npm run db:seed`, `npm run db:verify:site-settings`; manual admin check that a saved
  value persists and the storefront still matches the locked design (fallback intact).
- **Sequence reminder:** keep 46C minimal (model + admin form), push storefront
  integration to 46D, info pages to 46E. Preserve the design lock and the honest
  manual payment/delivery framing throughout.
