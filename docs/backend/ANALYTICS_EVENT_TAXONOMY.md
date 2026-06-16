# AURELIA — Analytics Event Taxonomy & Privacy Spec (Этап 22A)

> **Status: specification only.** No analytics code, Prisma model, migration, or
> dashboard is introduced by this stage. This document defines the event names,
> the shared event envelope, privacy/forbidden-data rules, and the readiness
> gates that must be met **before** Stage 23A (Analytics Event Capture
> Foundation) writes any code. It is the contract that later analytics work must
> follow.
>
> Related: [ADMIN_SUPERPANEL_ROADMAP.md](./ADMIN_SUPERPANEL_ROADMAP.md) (§6 event
> taxonomy, §7 data model), [ADMIN_AUDIT_LOG.md](./ADMIN_AUDIT_LOG.md) (admin
> actions — a separate stream), [SECURITY_NOTES.md](./SECURITY_NOTES.md) (PII /
> secrets rules), [ORDER_DRAFT_FLOW.md](./ORDER_DRAFT_FLOW.md) (checkout).
>
> **Implementation status:** Stage 23A built the capture foundation (model,
> validated `recordEvent()`, anonymous session, and the server-side
> `draft_order_created` / `checkout_error` events). Client-originated events
> (`product_view`, `category_view`, `begin_checkout`, `add_to_cart`) are deferred
> — see [ANALYTICS_EVENT_CAPTURE.md](./ANALYTICS_EVENT_CAPTURE.md).

## 1. Purpose

AURELIA will collect storefront analytics to answer real business questions
(what sells, where customers drop off, which sources bring buyers, which pages
break). Defining the taxonomy **before** implementation is deliberate:

- **Avoid random events.** A fixed, named set prevents ad-hoc events that no
  dashboard can use and that drift in meaning over time.
- **Protect privacy.** Deciding payload shape up front stops PII from leaking
  into a generic event stream "by accident."
- **Make dashboards reliable.** Stable names + stable fields = queries and daily
  aggregates that keep working as the store evolves.
- **Support future daily aggregates.** Raw events must carry exactly the keys
  the aggregate tables (`Daily*Metric`) will roll up — decided here, not later.
- **Prevent PII leaks.** A single forbidden-data list (§10) applies to every
  event, so there is one rule to review against, not many.

If an event cannot be tied to a decision (feature / fix / hide / restock /
rewrite), it does not belong in the taxonomy yet.

## 2. Principles

- **Decision-first analytics.** Every event exists to support a stated business
  question. No vanity events.
- **Privacy-first payloads.** Payloads carry behavior and outcomes, not
  identities. Minimize, anonymize, expire (§10, §11).
- **No raw PII in generic analytics.** Identifiable data (name/phone/email/full
  address) lives only in the relevant domain model (e.g. `Order`) under access
  control — never in the event stream.
- **Stable, versioned names.** Event names are stable identifiers. If a payload
  shape must change incompatibly, add a new field or bump a `schemaVersion` in
  the payload — do not silently repurpose an existing name.
- **Server-side validation later.** When capture is built (23A), every event is
  validated against this spec server-side (allowed name + allowed fields +
  forbidden-field rejection) before it is stored. The client is never trusted.
- **Raw events are not permanent business truth.** They are a short-to-medium
  retention signal source (§11). Financial/operational truth stays in `Order`
  and `AdminAuditLog`.
- **Daily aggregates power dashboards.** Dashboards should read pre-computed
  daily aggregates, not run heavy live queries over the full raw stream forever.

## 3. Event naming rules

- **lowercase `snake_case`** — e.g. `add_to_cart`, `search_no_results`.
- **Action-oriented** — name the thing that happened (`product_view`,
  `checkout_submit_attempt`), not a screen or a metric.
- **Stable** — once shipped, a name is not renamed or re-meaned. Deprecate and
  add, never repurpose.
- **No dynamic values in names.** Never `product_view_SKU123` or
  `category_view_rings`. The identifier goes in a payload/envelope field.
- **Dynamic data goes into fields**, never the name — `product_view` +
  `productId`, not a per-product event name.
- **Namespacing:** storefront/search/marketing/site-health events are flat
  snake_case. Admin actions are **not** analytics events — they use the
  dot-namespaced `admin.*` identifiers in `AdminAuditLog` (§8), kept separate on
  purpose.

## 4. Common event envelope (conceptual — implemented in 23A)

These are the fields every analytics event would carry. This is a **conceptual**
shape for the future `AnalyticsEvent` model; it is **not** a Prisma schema and
introduces no table in this stage. Exact types/indexes are decided in 23A.

| Field | Nullable | Meaning / rule |
|---|---|---|
| `id` | no | Surrogate id (cuid), like other models. |
| `eventName` | no | One of the names in §5–§7, §9. Validated server-side. |
| `createdAt` | no | Server-assigned timestamp. Never trust a client clock. |
| `anonymousSessionId` | no | Opaque, rotating, **non-PII** session id (see §12). Not tied to identity; not an account id. |
| `userId` | yes | Reserved for future customer accounts. Null today (no accounts exist). |
| `productId` | yes | Catalog product id when the event is about a product. |
| `categoryId` | yes | Category id when about a category/collection. |
| `orderId` / `orderCode` | yes | **Only** when operationally needed (e.g. `draft_order_created`). Prefer `orderCode`. Never attach customer contact data alongside it. |
| `pagePath` | yes | Path only (e.g. `/product/serogi-kaplya`). **No query string with PII**; strip/allowlist query params (keep UTM, drop the rest). |
| `referrerDomain` | yes | Registrable domain only (e.g. `google.com`) — **not** the full referrer URL. |
| `utmSource` / `utmMedium` / `utmCampaign` / `utmContent` / `utmTerm` | yes | Captured from the landing URL (§7). Treat as low-cardinality marketing labels. |
| `deviceType` | yes | Coarse bucket only: `mobile` / `tablet` / `desktop`. **No raw user-agent**, no fingerprint. |
| `payload` | yes | Small JSON for event-specific fields (§5–§9). Must obey §10. |
| privacy flags | yes | Optional, if useful later — e.g. `doNotTrack` / consent state (§12). |

Envelope rules:
- Prefer **ids over text** (productId, not product name) so payloads stay PII-free
  and join cleanly to catalog/order tables.
- The envelope is the same for all groups; group-specific data goes in `payload`.
- Anything not listed and not justified by a business question does not get added.

## 5. Storefront event group

For each event: **fires when** / **required** (beyond the always-present
envelope basics: `eventName`, `createdAt`, `anonymousSessionId`, `pagePath`) /
**optional** / **forbidden** / **business question**.

### `page_view`
- **Fires:** any storefront page load/navigation.
- **Required:** `pagePath`.
- **Optional:** `referrerDomain`, UTM fields, `deviceType`.
- **Forbidden:** raw referrer URL, query strings containing PII.
- **Answers:** traffic volume, entry pages, overall reach.

### `category_view`
- **Fires:** a category page is viewed.
- **Required:** `categoryId`.
- **Optional:** `pagePath`, sort/filter context (small).
- **Forbidden:** product-level PII.
- **Answers:** which categories attract attention.

### `collection_view`
- **Fires:** a curated collection / landing grouping is viewed (when collections exist).
- **Required:** a collection identifier in `payload` (`collectionSlug` or id).
- **Optional:** `categoryId` if the collection maps to one.
- **Forbidden:** dynamic name in `eventName`.
- **Answers:** which collections/merchandising groupings perform.

### `product_view`
- **Fires:** a product detail page is viewed.
- **Required:** `productId`.
- **Optional:** `categoryId`, `payload.position` (if opened from a list).
- **Forbidden:** price typed by client as truth (price is server-authoritative; a snapshot value is fine but never trusted).
- **Answers:** product attention; with conversion → attention-without-conversion.

### `product_image_view`
- **Fires:** a user advances/zooms product gallery images.
- **Required:** `productId`.
- **Optional:** `payload.imageIndex`.
- **Forbidden:** image binary/URLs of anything user-supplied.
- **Answers:** does richer imagery correlate with add-to-cart.

### `add_to_cart`
- **Fires:** an item is added to the cart.
- **Required:** `productId`, `payload.quantity` (int ≥ 1).
- **Optional:** `payload.variant` (coating value), `categoryId`.
- **Forbidden:** customer identity.
- **Answers:** add-to-cart rate per product/category.

### `remove_from_cart`
- **Fires:** an item is removed from the cart.
- **Required:** `productId`.
- **Optional:** `payload.quantity`.
- **Forbidden:** customer identity.
- **Answers:** hesitation / cart churn signals.

### `cart_view`
- **Fires:** the cart screen is opened.
- **Required:** none beyond envelope.
- **Optional:** `payload.itemCount`, `payload.subtotalMinor` (aggregate only, no line PII).
- **Forbidden:** per-line customer data.
- **Answers:** cart engagement before checkout.

### `begin_checkout`
- **Fires:** the customer enters the checkout flow.
- **Required:** none beyond envelope.
- **Optional:** `payload.itemCount`, `payload.subtotalMinor`.
- **Forbidden:** contact fields, address.
- **Answers:** top of the checkout funnel.

### `checkout_step_view`
- **Fires:** a distinct checkout step/section becomes visible (if checkout is stepped).
- **Required:** `payload.step` (stable string/number).
- **Optional:** `payload.itemCount`.
- **Forbidden:** values typed into any field.
- **Answers:** step-by-step drop-off within checkout.

### `checkout_submit_attempt`
- **Fires:** the customer submits the checkout form (before server result).
- **Required:** none beyond envelope.
- **Optional:** `payload.itemCount`, `payload.hasEmail` (boolean — presence only, never the address).
- **Forbidden:** name/phone/email/address values; **unmasked form field values**.
- **Answers:** how many attempts vs. successful drafts (friction/errors).

### `draft_order_created`
- **Fires:** the server has persisted a draft order (see ORDER_DRAFT_FLOW).
- **Required:** `orderCode` (operationally needed to join to the order).
- **Optional:** `payload.itemCount`, `payload.totalMinor`, `categoryId` mix summary.
- **Forbidden:** customer name/phone/email/address (those live only on `Order`).
- **Answers:** conversions; revenue signal (joined to `Order` for truth).

### `checkout_error`
- **Fires:** checkout fails (validation or server error) without creating an order.
- **Required:** `payload.errorType` (stable category, e.g. `validation` / `out_of_stock` / `server`).
- **Optional:** `payload.field` (which field category failed — **name of field, not its value**).
- **Forbidden:** stack traces, secrets, typed field values, raw exception messages with internals.
- **Answers:** why checkout fails; what to fix first.

## 6. Search / discovery event group

### `search_performed`
- **Fires:** a search query is executed.
- **Required:** `payload.queryNormalized` (see normalization below).
- **Optional:** `payload.resultCount`, `payload.queryLength`.
- **Forbidden:** queries that look like PII (see below); raw unnormalized query if it contains PII.
- **Answers:** demand; top searches.

### `search_result_clicked`
- **Fires:** a search result is clicked.
- **Required:** `productId` (or result id), `payload.position`.
- **Optional:** `payload.queryNormalized`.
- **Answers:** search → click relevance.

### `search_no_results`
- **Fires:** a search returns zero results.
- **Required:** `payload.queryNormalized`.
- **Optional:** `payload.queryLength`.
- **Answers:** unmet demand; catalog/search gaps.

### `filter_applied`
- **Fires:** a catalog filter is applied.
- **Required:** `payload.filterKey`, `payload.filterValue` (low-cardinality, allowlisted).
- **Forbidden:** free-text values that could carry PII.
- **Answers:** which filters customers actually use.

### `sort_changed`
- **Fires:** list sort order changes.
- **Required:** `payload.sort` (enum value).
- **Answers:** preferred ordering; merchandising defaults.

### Query normalization & privacy
- **Normalize before storing:** trim, collapse whitespace, lowercase.
- **PII guard:** drop/replace queries matching obvious **email-like** or
  **phone-like** patterns (and other clear identifiers) — store a flag like
  `payload.redacted = true` instead of the raw string.
- **Length cap:** truncate to a sane max (e.g. 100 chars) to avoid dumping pasted text.
- **Retention/moderation:** raw normalized queries get the same short-to-medium
  retention as other raw events (§11); a later moderation/aggregation step can
  promote only safe, frequent terms into `DailySearchMetric`.

## 7. Marketing / source event group

### `landing_page_view`
- **Fires:** the first page view of a session (the entry/landing page).
- **Required:** `pagePath`.
- **Optional:** `referrerDomain`, UTM fields, `deviceType`.
- **Answers:** where sessions begin.

### `utm_captured`
- **Fires:** a landing URL carries UTM parameters.
- **Required:** at least one of `utmSource/utmMedium/utmCampaign/utmContent/utmTerm`.
- **Forbidden:** UTM values used to smuggle PII (validate/allowlist length).
- **Answers:** campaign reach.

### `referrer_captured`
- **Fires:** an external referrer is present on a landing view.
- **Required:** `referrerDomain` (registrable domain only).
- **Forbidden:** full referrer URL/path/query.
- **Answers:** which sources/domains send traffic.

### `campaign_visit`
- **Fires:** a visit attributable to a named campaign.
- **Required:** `utmCampaign` (or campaign id in `payload`).
- **Answers:** per-campaign volume and, joined to orders, buyers per campaign.

### Attribution guidance
- **First-touch and last-touch only** for now: record the **first** session's
  source (first-touch) and the source on the **converting** session (last-touch).
  Store these as plain labels on the session/aggregate — simple and explainable.
- **Postpone multi-touch attribution** (weighted/positional/data-driven models)
  until there is real traffic scale and a clear decision that needs it. Do not
  build attribution modeling in the capture foundation.

## 8. Admin / security event relationship

- **`AdminAuditLog` is separate from analytics events** and remains the **source
  of truth** for admin actions (login success/failure, logout, order status
  changes — see ADMIN_AUDIT_LOG.md). It is append-only and privacy-hardened.
- **Do not duplicate sensitive admin audit data into the generic analytics
  stream.** No admin credentials, session data, or per-action admin detail in
  `AnalyticsEvent`.
- Admin/security activity **may be summarized later** (e.g. counts of failed
  logins per day for a security widget), but any such summary is **derived from
  `AdminAuditLog`**, not re-logged as analytics events. The audit log stays
  authoritative.
- Admin action identifiers keep their `admin.*` dot-namespace; analytics event
  names keep `snake_case`. The two namespaces never mix.

## 9. Site health event group

### `server_error`
- **Fires:** an unhandled server error is surfaced (5xx).
- **Required:** `payload.errorType` (stable category), `pagePath`.
- **Forbidden:** stack traces, secrets, env values, raw exception text with internals.

### `not_found`
- **Fires:** a 404 is served.
- **Required:** `pagePath`.
- **Optional:** `referrerDomain` (to find broken inbound links).
- **Answers:** broken links / bad URLs to fix or redirect.

### `api_error`
- **Fires:** an internal API/route handler returns an error.
- **Required:** `payload.errorType`, `payload.route` (route pattern, not raw input).
- **Forbidden:** request bodies, secrets, tokens.

### `db_error`
- **Fires:** a database operation fails at a level worth surfacing.
- **Required:** `payload.errorType` (category, e.g. `connection` / `constraint`).
- **Forbidden:** SQL with values, connection strings, credentials.

### `slow_request`
- **Fires:** a request exceeds a latency threshold.
- **Required:** `pagePath` or `payload.route`, `payload.durationMs`.
- **Answers:** where the storefront is slow.

### `structured_data_error`
- **Fires:** structured-data / SEO metadata validation fails for a page.
- **Required:** `pagePath`, `payload.errorType`.
- **Answers:** SEO/markup problems suppressing visibility.

**Clarifications:**
- **No stack traces with secrets** in any analytics payload — only stable error
  *categories* and safe identifiers.
- **Detailed server logs remain separate** (server console / infra logging).
  Analytics site-health events are coarse signals for the admin dashboard, not a
  replacement for real logs or APM.

## 10. Forbidden data (applies to every event)

A generic analytics event **must never** contain:

- passwords (or any attempted password);
- session cookies (storefront or admin);
- `ADMIN_SESSION_SECRET` or **any** secret / API key / token / env value;
- full payment data (card numbers, CVV, full payment tokens);
- raw full IP address retained long-term (if ever used, truncate/hash and expire fast — see §11);
- raw phone, email, or name in generic analytics payloads;
- full postal address;
- unmasked form field values (what the user typed);
- admin session replay;
- raw session replay stored in our DB.

When identifiable data is genuinely required for an operation, it lives in the
relevant domain model (e.g. `Order`) under access control — **referenced by id**
from analytics, never copied into the event payload.

## 11. Retention and aggregation plan

- **Raw events:** short-to-medium retention. Exact window is **TBD** at
  implementation (candidate: a rolling N days), chosen so raw data is useful for
  debugging/recent funnels but is not a permanent identity store. Define and
  document the window in 23A before capture ships.
- **Daily aggregate tables (future, names per roadmap §7):**
  - `DailyStoreMetric` — store-wide KPIs (sessions, orders, AOV, conversion).
  - `DailyProductMetric` — per-product views/add-to-cart/conversion/revenue.
  - `DailyCategoryMetric` — per-category views/conversion/revenue.
  - `DailySearchMetric` — top searches, no-result searches, click/conversion.
  - `DailySourceMetric` — sessions/orders by source/UTM/referrer domain.
- **Dashboards prefer aggregates.** After a day is rolled up, dashboards read the
  aggregate tables. Live raw-event queries are for recent/debug views only, not
  the permanent backend of every chart.
- Aggregation jobs read raw events, write daily rows, and let raw data age out
  per the retention window. Aggregates are the durable analytical record; raw
  events are disposable signal.

## 12. Implementation readiness gates for Stage 23A

Capture must **not** be implemented until all of these are true and noted:

- **Spec reviewed** — this document is read and accepted.
- **No-PII rules clear** — §10 understood; the validation will reject forbidden
  fields server-side, not rely on callers being careful.
- **Anonymous session strategy clear** — how `anonymousSessionId` is generated,
  stored, rotated, and kept non-identifying (e.g. a rotating opaque id; cookie
  vs. storage decision; lifetime). It must not become a stable cross-site
  identity.
- **DB migration plan clear** — the `AnalyticsEvent` model/table shape, indexes
  (at least `eventName`, `createdAt`, `productId`), and that the migration is
  additive and follows the project workflow (`prisma migrate dev`, no reset).
- **Event write helper design clear** — a single server-only `recordEvent()`
  entry point that validates name + fields against this spec, strips/blocks
  forbidden data, and is the only way events are written (mirrors the
  `recordAuditEvent` pattern in `src/lib/admin/audit.ts`).
- **Failure behavior clear** — event writes are best-effort and side-effect-safe:
  a failed write is swallowed/logged (no secrets) and must never break the
  storefront request that triggered it.
- **Opt-out / cookie / privacy decision noted** — whether a consent banner /
  Do-Not-Track / opt-out is needed for this market, and how a privacy flag in
  the envelope (§4) would suppress or minimize capture. Decide and record before
  shipping capture.

## 13. Explicitly out of scope (for 22A)

This stage is documentation only. It does **not** include:

- no code (no capture, no helper, no client instrumentation);
- no Prisma model (no `AnalyticsEvent` or `Daily*Metric` tables);
- no migration;
- no dashboards or admin analytics pages;
- no AI insights / recommendations;
- no third-party analytics integration (no GA/Segment/etc.);
- no session replay of any kind.

Those arrive in later, separately-reviewed stages (capture in 23A; dashboards and
aggregates after), each gated by §12 and the roadmap's readiness gates.
