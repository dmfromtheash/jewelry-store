# AURELIA — Analytics Event Capture Foundation (Этап 23A)

Implements the first privacy-safe slice of the taxonomy
([ANALYTICS_EVENT_TAXONOMY.md](./ANALYTICS_EVENT_TAXONOMY.md)). This is a
**foundation**: the storage model, the single validated write path, the
anonymous-session strategy, and capture of the events that have a clean
server-side hook today. **No dashboards / admin analytics UI** are built here.

## What was implemented

- **Model `AnalyticsEvent`** (`prisma/schema.prisma`, migration
  `20260616184923_add_analytics_event` — additive: one table + five indexes, no
  FKs, no changes to existing tables). Catalog/order references are loose ids so
  analytics is decoupled and append-only; identifiable data is never copied here.
- **Pure taxonomy module** `src/lib/analytics/events.ts` (no `server-only`):
  event-name constants + allowlist, `normalizeEventName()`, `sanitizePayload()`,
  and the forbidden-key pattern. Dependency-free so it is unit-checked by the
  verify script.
- **Server-only recorder** `src/lib/analytics/record.ts`: `recordEvent()` (the
  only write path) plus `getOrCreateAnonymousSessionId()` and the typed wrappers
  `recordDraftOrderCreated()` / `recordCheckoutError()`.
- **Wiring** in `src/lib/orders/actions.ts` (`createOrderDraft`): emits
  `draft_order_created` on success and `checkout_error` on every failure branch.
- **Verification** `npm run db:verify:analytics`.

## Events captured now

**Server-side (23A)** — the server already knows the action; no client, no PII:

| Event | Where | Data captured (no PII) |
|---|---|---|
| `draft_order_created` | `createOrderDraft` success | `orderCode`, `pagePath=/checkout`, payload `{ itemCount, totalMinor }`, anon session, coarse device/referrer |
| `checkout_error` | `createOrderDraft` failure branches | payload `{ errorType, itemCount? }` where `errorType` ∈ `validation` / `invalid_quantity` / `empty_cart` / `product_unavailable` / `server`; anon session |

**Client-side via the capture gateway (23B)** — sent through `POST /api/analytics`:

| Event | Where | Data captured (no PII) |
|---|---|---|
| `product_view` | `<TrackView>` on `/product/[slug]` | payload `{ productSlug }` |
| `category_view` | `<TrackView>` on category pages | payload `{ categorySlug }` |
| `add_to_cart` | `CartProvider.addItem` | payload `{ productSlug, quantity }` |
| `cart_view` | `CartProvider.openCart` | no payload |
| `begin_checkout` | `CheckoutPageClient` (cart non-empty) | payload `{ itemCount, cartTotalMinor }` |

All client payloads carry only slugs / counts / coarse totals — never customer
data. The anonymous session, device bucket and referrer domain are derived
**server-side** in the route, not sent by the client.

## Events intentionally deferred (and why)

| Event | Reason deferred |
|---|---|
| `search_performed` / `search_no_results` | Search is URL-driven, in-memory and client-only. Storing query **values** safely requires **value-level** PII redaction (drop email/phone-like queries), which the current sanitizer does not do (it strips by key, not value). Deferred until a `normalizeSearchQuery()` value guard is added — out of scope for 23B to avoid expanding it. |
| `remove_from_cart`, `checkout_step_view`, `product_image_view`, `collection_view` | Lower-priority funnel/discovery events; add once the core funnel is validated. |
| Marketing/source + site-health groups | Need landing/first-touch capture and error-boundary wiring respectively — separate stages. |

## Client capture gateway (23B)

- **Route:** `app/api/analytics/route.ts` (`POST`, Node.js runtime). The only
  client→server analytics path. Guards: **same-origin** (Origin must match host
  when present), **JSON only**, **≤ 2 KB** body. Delegates to the server-only
  `recordClientEvent()`. Returns `204` (accepted) / `400` (unknown event or bad
  request) / `413` (too big). Never logs payloads, never leaks internals.
- **Server enforcement (`recordClientEvent` in `record.ts`):** normalizes +
  allowlists the event name (rejects unknown), derives the anonymous session +
  coarse device/referrer server-side, strips a query string from `pagePath`, and
  writes through `recordEvent()` (payload sanitization). The client can only
  influence `event` / `pagePath` / `payload`.
- **Client helper:** `src/lib/analytics/client.ts` — `sendAnalyticsEvent()` uses
  `navigator.sendBeacon` (fire-and-forget) with a `keepalive` `fetch` fallback.
  Dependency-free, never throws, no-ops on the server, never blocks the UI.
- **View tracker:** `src/components/analytics/TrackView.tsx` — a render-nothing
  `'use client'` component for the static product/category pages; fires once per
  mount (and on slug change). No layout/hydration impact beyond a tiny effect.

## Privacy / forbidden-data enforcement

Enforced **server-side, by construction** — never relying on callers to be careful:

- **Event-name allowlist.** `recordEvent()` rejects (does not store) any name not
  in the taxonomy; names are trimmed + lowercased first.
- **Payload sanitization.** `sanitizePayload()` drops any key matching the
  forbidden pattern (`password`, `secret`, `token`, `cookie`, `session`, `phone`,
  `email`, name variants, `address`, `payment`, `card`, `cvv`, `ssn`, IP-address
  keys, …), keeps only JSON primitives, drops nested objects/arrays (no deep PII
  smuggling), and caps key count/string length.
- **No raw PII columns.** The model has no name/phone/email/address fields. Order
  events store the order **code**; product/category events would store **ids**.
- **No full IP, no raw user-agent, no full referrer.** Only a coarse
  `deviceType` bucket and an **external** registrable referrer domain are derived.
- **Never logged.** Failures log the event name + error string only — never the
  payload.
- **Side-effect-safe.** `recordEvent()` and the wrappers swallow errors, so an
  analytics failure can never break the checkout/order flow.

## Anonymous session strategy

- Opaque **128-bit random** id (`crypto.randomBytes(16)` → 32 hex chars). Encodes
  no user data.
- Stored in the **`au_anon`** cookie: `httpOnly`, `SameSite=Lax`, `path=/`,
  `secure` in production, and a **session cookie** (no `maxAge`/expiry) so it
  rotates per browser session and never becomes a long-lived cross-site
  super-cookie.
- `httpOnly` is intentional: the cookie is still sent automatically on every
  same-origin request (including a future `fetch`/`sendBeacon`), and the **server**
  derives the id — client JS never needs to read it.
- Generated/persisted only in mutable-cookie contexts (server actions / route
  handlers). No third-party tracking, no fingerprinting.

## Retention / consent stance (this foundation)

- **Retention:** not yet enforced. Raw events accumulate until a retention window
  + a cleanup/aggregation job is defined (taxonomy §11) — to be set before
  capture is broadened beyond these low-volume order events.
- **Consent/opt-out:** none wired yet. The `privacyFlags` column + the envelope
  reserve space for a consent/DNT decision; that decision is required before
  client-side capture (the deferred events) ships.

## Verify

```bash
npm run db:verify:analytics
```

Checks the pure helpers (accept valid / reject unknown / strip forbidden keys /
drop nested) **and** the table write path inside a transaction that is always
rolled back (no test data committed).

## Out of scope (23A)

No dashboards, no admin analytics UI, no client capture endpoint/beacons, no
aggregates (`Daily*Metric`), no AI insights, no third-party analytics, no session
replay, no customer accounts, no payment.
