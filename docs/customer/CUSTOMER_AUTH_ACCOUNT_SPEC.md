# AURELIA — Customer Auth + Account Foundation (Этап 47A)

Status: **implemented**. Additive, guest-first. No payment/delivery APIs, no
design/CSS changes, no change to existing order lifecycle semantics (only an
additive, nullable owner link on `Order`).

## 1. What was implemented

- **`Customer` model** (`prisma/schema.prisma`): `id`, unique normalised `email`,
  `passwordHash` (salted scrypt — never plaintext), optional `name`/`phone`,
  timestamps, `orders` relation.
- **`Order.customerId` (nullable)** + `customer` relation with
  `onDelete: SetNull` and a `@@index([customerId])`. Guest checkout keeps
  `customerId = null`; every pre-47A demo order stays `null` (untouched).
- **Password hashing** (`src/lib/customer/password.ts`): Node built-in
  `crypto.scrypt` (memory-hard), no new dependency. Stored as
  `scrypt$N$r$p$saltHex$hashHex`; constant-time verify; malformed hashes return
  `false` instead of throwing.
- **Customer session** (`src/lib/customer/token.ts` + `session.ts`): a separate
  httpOnly, HMAC-signed `<payload>.<hmac>` cookie **`au_customer_session`**
  (distinct from the admin `au_admin_session`). `sameSite=lax`, `secure` in
  production, 30-day TTL. Signing key = `CUSTOMER_SESSION_SECRET` if set, else a
  labelled-HMAC derivation of `ADMIN_SESSION_SECRET` (so it is always distinct
  from the admin key). `getCurrentCustomer` also confirms the account still exists
  in the DB before returning the **safe public projection** (no password hash).
- **Validation** (`src/lib/customer/validate.ts`): email normalised to lowercase,
  password min length 8 (max 200 KDF guard), name/phone length caps,
  HTML/`javascript:`/`data:` rejected in free-text fields.
- **Server actions** (`src/lib/customer/actions.ts`): `registerCustomerAction`,
  `loginCustomerAction`, `logoutCustomerAction` + best-effort in-memory auth
  throttle (per-process; fails open on restart, like the admin throttle).
- **Data layer** (`src/lib/customer/repo.ts`): `createCustomer` (P2002 →
  `DuplicateEmailError`), `findCustomerCredentials` (id + hash only),
  `getCustomerById` (safe projection), `getCustomerOrders` (hard-scoped by
  `customerId`).
- **UI** (existing classes only — no new design/CSS):
  - `LoginModal` / `RegisterModal` are now **real forms** wired to the actions;
    success closes the modal and `router.refresh()`es server components.
  - `ProfileButton`: logged-out opens the login modal (unchanged); logged-in
    becomes a link to `/account` (same icon/classes).
  - `Header` resolves the customer server-side and passes only a safe display
    label.
  - **`/account`** page: requires login (in-page login prompt when logged out, no
    redirect loop), shows profile (name/email/phone), **own** order history
    (code, status, total, date, delivery/payment summary), empty state, logout.
- **Checkout integration** (`app/checkout/page.tsx`,
  `src/components/checkout/CheckoutPageClient.tsx`, `src/lib/orders/actions.ts`):
  logged-in contact fields are prefilled (UX only), and the created order's
  `customerId` is attached **server-side from the verified session** — never from
  the client. Guests are unaffected and still create `customerId = null`.

## 2. Guest checkout preserved

Login is never forced. The checkout flow, fields, validation and confirmation are
unchanged for guests; `customerId` simply stays `null`. A stale/failed session
lookup during checkout falls back to a guest order rather than blocking it.

## 3. Security rules

- Passwords are only ever stored as a salted scrypt hash; never logged/returned.
- Login/registration errors are generic (no account-existence leak); a fixed
  dummy hash verify keeps timing similar for unknown accounts.
- Customer and admin sessions are fully separate (different cookie name + signing
  key). A customer session grants **no** admin access — `/admin/*` is still gated
  by `ensureLocalAdmin()` + `requireAdminSession()` and is unaffected.
- Order history is hard-scoped by `customerId` in the data layer; there is **no**
  public order-lookup-by-code surface.
- The session cookie is httpOnly (not readable by client JS); only safe display
  fields (id/email/name/phone/createdAt) cross the server boundary.
- No raw SQL.

## 4. Verification

`npm run db:verify:customer-auth` (read-mostly; all writes inside
always-rolled-back transactions, counts asserted unchanged):
hash-not-plaintext + verify, session token sign/verify/tamper, validation,
duplicate-email rejection, customerId attach, guest null, and cross-customer
order scoping.

## 5. Known limitations / follow-ups

- **No password reset / email verification** ("Забули пароль?" is still a no-op
  link). Add a tokenised reset flow + transactional email later.
- **Throttle is in-memory** (per-process, fails open on restart). A durable,
  per-account rate limit belongs with a shared store (Redis/DB) before public
  launch.
- **No "remember me" toggle / session revocation list**; logout clears the cookie
  but does not invalidate other devices (stateless token).
- **Account editing** (change name/phone/email/password) is not implemented yet —
  read-only profile in 47A.
- No merge of prior guest orders into a newly created account (by email).

## 6. Recommended next stage

47B — customer account UX hardening: profile editing + password change, password
reset flow, and optional guest-order linking by email. Payment/delivery APIs stay
deferred behind the owner/legal/provider checklist.

---

# Этап 47B — Account UX + Security Hardening Pack

Status: **implemented**. Additive, guest-first. **No schema change** (47A's models
were sufficient). No payment/delivery APIs, no design/CSS changes.

## 47B.1 What was added

- **Profile editing** — `updateCustomerProfileAction`
  (`src/lib/customer/actions.ts`) + `updateCustomerProfile`
  (`src/lib/customer/repo.ts`). Editable fields: **name + phone only**. The owner is
  re-resolved from the **verified session** (never a client id), so a customer can
  only update their own row. Validation reuses the registration rules (length caps,
  HTML/`javascript:`/`data:` rejection) via shared `validateProfileInput`. **Email
  stays immutable** in v1 (login identity; a verified change flow is deferred).
- **Password change** — `changeCustomerPasswordAction` + `getCustomerCredentialsById`
  / `updateCustomerPassword`. Requires the **current password** (verified against the
  stored scrypt hash before any write), a new password (min 8, same caps), and a
  confirmation. The new password is hashed with the existing `hashPassword` helper —
  never stored/logged in plaintext. Errors are generic (no password content echoed).
  On success the session is **re-issued** (`startCustomerSession`) so the current
  device keeps a fresh valid token.
- **Account order detail** — new route `app/account/orders/[orderCode]/page.tsx` +
  `getCustomerOrderByCode(customerId, orderCode)`. The reader is **hard-scoped by
  `(orderCode AND customerId)`**, so another customer's code (or a guest order's code)
  resolves to `null`. The page **requires login** (logged out → redirect to
  `/account`), returns **`notFound()`** when not owned, and is **read-only** (no
  status change / cancel). It shows items, totals, status, delivery/payment summary
  and the created date — **no admin-only data**.
- **Account page UX** (`app/account/page.tsx`, existing classes only) — profile panel
  with the editable name/phone form, read-only email, a password-change panel, an
  order list whose codes now **link to the owned order detail**, an empty state and
  logout. New client components: `_components/ProfileForm.tsx`,
  `_components/PasswordForm.tsx` (reuse `au-field` / `au-field-error` / `au-btn` /
  `au-co-note`).

## 47B.2 Guest checkout preserved

Unchanged. Login is never forced; the checkout flow, fields, validation and
confirmation are identical for guests (`customerId` stays `null`). A stale/invalid
customer session during checkout still falls back to a guest order. Logged-in contact
prefill is unchanged (UX only; ownership is server-resolved).

## 47B.3 Admin / customer separation

Unchanged and intact. All new actions/pages use the **customer** session
(`au_customer_session`) only; none touch the admin session, `ensureLocalAdmin`, or any
admin data. A customer session still grants **no** `/admin` access.

## 47B.4 Verification

`npm run db:verify:customer-auth` extended (all writes inside always-rolled-back
transactions; counts asserted unchanged): profile validation (unsafe name / bad phone
rejected, normalised, clearable), password-change validation (current required,
short/mismatched new rejected), password-change re-hash (old fails, new verifies after
the stored hash is replaced), and order-detail scoping (owner loads own order; a
foreign customer's and a guest's orders are NOT loadable by code).

## 47B.5 Remaining gaps (carried forward)

- **No global session revocation.** The session token is stateless, so password change
  re-issues only the current device's token; tokens already on **other** devices stay
  valid until expiry. Closing this needs an additive `sessionVersion`/`passwordChangedAt`
  column checked in `getCurrentCustomer` — intentionally deferred (not added in 47B to
  avoid an unnecessary migration).
- **No password reset / email verification** ("Забули пароль?" is still a no-op).
- **No email change** (immutable in v1).
- **Throttle is still in-memory** (per-process, fails open on restart).
- **No guest-order linking by email** into a newly created account.
- Account/order-detail **route guards** (redirect/`notFound`) depend on request
  cookies and are not exercised by the verify script — covered at the data layer.

---

# Этап 47C — Customer Account Security Completion Pack

Status: **implemented**. Closes the **47B.5 "no global session revocation" gap**.
Additive schema only. **No email/password-reset flow, no external provider**, no
payment/delivery APIs, no design/CSS changes.

## 47C.1 Session invalidation model

- **Additive schema** (`prisma/schema.prisma`, migration
  `20260620202427_add_customer_session_version`): `Customer.sessionVersion Int
  @default(1)` + `Customer.passwordChangedAt DateTime?`. Two new columns only — no
  drop/rename, no data loss; existing rows default to version `1`.
- **`sessionVersion` is the authoritative revocation counter**; `passwordChangedAt`
  is an audit marker only.

## 47C.2 Token / session changes

- The signed customer token payload now carries **`ver`** (the session version)
  alongside `sub`/`iat`/`exp` (`src/lib/customer/token.ts`).
  `createCustomerToken(customerId, sessionVersion, secret)` binds a token to the
  version; `verifyCustomerToken` **requires** `ver` to be a number — a legacy pre-47C
  token without it **fails closed** (holder is logged out, must sign in again; there
  are no live customer sessions to break).
- **`getCurrentCustomer`** (`session.ts`) now loads the customer via
  `getCustomerForSession` (public projection **+** `sessionVersion`) and returns
  `null` unless `token.ver === customer.sessionVersion`. The `sessionVersion` is
  **stripped** before the public customer is returned — it never crosses to the
  client. A stale cookie is ignored on read (read paths don't mutate cookies) and is
  overwritten on the next login.
- Cookie flags unchanged: **`au_customer_session`** (separate from admin), `httpOnly`,
  `sameSite=lax`, `secure` in production, 30-day `maxAge`.

## 47C.3 Password change behaviour

- `changeCustomerPasswordAction` still verifies the **current password** first, then
  performs **one atomic UPDATE** (`updateCustomerPasswordAndBumpVersion`) that stores
  the new scrypt hash **and** `sessionVersion: { increment: 1 }` **and**
  `passwordChangedAt`. The version bump **invalidates every token signed with the old
  version — on this device and all others** (they resolve to "logged out" on their
  next request). The current device is immediately **re-issued** a fresh token bound
  to the new version, so it stays logged in. Passwords are never logged; errors stay
  generic. **No email reset involved.**

## 47C.4 Verification

`npm run db:verify:customer-auth` (now 37 checks; all writes in always-rolled-back
transactions, counts asserted unchanged) adds: token carries/verifies `ver`; a legacy
token without `ver` is rejected; a new customer starts at version 1; a password change
bumps the version; the pre-change token is **stale/rejected** (`token.ver !==
db.sessionVersion`) while a re-issued token for the new version is **accepted**. The
47A/47B checks (hashing, scoping, guest-null, order-detail scoping) still pass.

## 47C.5 Remaining gaps (carried forward)

- **No password reset / email verification** ("Забули пароль?" is still a no-op) —
  deliberately deferred (no email provider added in 47C).
- **No email change** (immutable in v1).
- **Throttle is still in-memory** (per-process, fails open on restart).
- **No guest-order linking by email** into a newly created account.
- Revocation is **all-or-nothing per account** (a single counter): there is no
  per-device session list, so "log out my other devices" is implicit in a password
  change rather than a standalone action. A full session table is intentionally **not**
  added (out of scope; the counter closes the security gap without it).
- Route guards still depend on request cookies (not exercised by the verify script;
  covered at the data layer).

---

# Этап 49A — Customer Auth Abuse Protection + Audit Logging

Status: **implemented**. Closes the **48A "no customer auth audit logs / no broader
abuse protection"** gaps for the local/MVP target. No schema change, no design change.

## 49A.1 Abuse protection (rate limiting)

- The throttle is extracted into **`src/lib/customer/throttle.ts`** — a dependency-free,
  per-process, in-memory limiter with **per-scope rules**:
  - `login` / `register`: **10 attempts / 10 min**, keyed by client **IP** (anonymous flows).
  - `password`: **8 attempts / 10 min**, keyed by **customer id** — a tight failure-lockout
    against current-password guessing. Wrong current-password counts toward the budget;
    a successful change clears it.
  - `profile`: **20 saves / 10 min**, keyed by **customer id** — an anti-spam rate-limit.
- Authenticated scopes are keyed **per customer** (`scope:cust:<id>`), so one account's
  abuse can never lock out everyone behind a shared IP.
- User-facing copy stays **generic** ("Забагато спроб. Зачекайте трохи…") — no signal about
  which field/account tripped it.
- **Limitations (unchanged, by design):** in-memory means per-process and **fails OPEN on
  restart / HMR**, and it does **not** coordinate across instances. A public, multi-instance
  launch still needs a shared store (Redis/DB); `throttle.ts` is the single swap-in point.

## 49A.2 Customer auth audit logging

- Customer auth/security events are recorded into the **existing append-only
  `AdminAuditLog` table** under a **`customer.*` action namespace** (helpers in
  `src/lib/customer/audit.ts`; stable ids + labels in `audit-actions.ts`). Reusing that
  table avoids a schema change and a second admin viewer.
- Events recorded: register success, register failure (**`duplicate_email` only** — ordinary
  validation typos are intentionally **not** logged, to keep the log low-noise), login
  success, login failure, logout, profile update, password change, and **throttled** auth
  attempts (with the scope as the reason).
- **Safety (enforced by construction):** the `actor` is the **Customer.id** (an opaque cuid,
  not PII) for known-customer events, or **`anonymous`** otherwise. The store **never** holds
  passwords, attempted passwords, the **email**, session cookies/tokens, the password hash,
  or any raw request body/headers. Failure events carry only a **machine reason**. The
  attacker-supplied email is **not** stored, so the log cannot be used to enumerate accounts.
- Writing is **side-effect-safe** (`recordAuditEvent` swallows + logs its own errors) — a
  logging failure can never break the auth action.
- **Not logged (deliberate):** the stale-session rejection in `getCurrentCustomer` is a hot,
  read-only path; auditing it there would be noisy and a read-path side effect, so it is
  skipped.

## 49A.3 Admin visibility

- The existing **`/admin/audit-log`** viewer now renders `customer.*` events too: it merges
  the admin + customer label maps, so customer rows show a readable Russian label. The viewer
  remains **read-only, session-gated, local-only, noindex**, and still never dumps raw
  metadata JSON. Subtitle/empty-state copy updated to mention customer events (admin UI only —
  no storefront/design change).

## 49A.4 Verification

- `npm run db:verify:customer-auth` extended (now **45 checks**, all pass): throttle budget
  trips at the limit, **clears on success**, **auto-resets** an expired window, and is
  **isolated per customer**; every customer audit action has a label and uses the
  `customer.*` namespace; the audit **write path** works inside an **always-rolled-back**
  transaction. Counts (customers / orders / **audit events**) are asserted **unchanged** —
  nothing is ever committed.

## 49A.5 Remaining gaps (carried forward)

- **No password reset / email verification** — still deferred (no email provider).
- **No email change** (immutable in v1).
- **No guest-order linking by email.**
- **No per-device session list** (revocation stays all-or-nothing per account — 47C).
- **Throttle is in-memory** (per-process, fails open on restart, single instance only) — a
  durable shared store is required before a real public launch. *(Addressed for
  single-instance in 51A below.)*

---

# Этап 51A — Durable customer-auth rate limiting

Status: **implemented**. Closes the **49A "throttle is in-memory only"** gap for a
**single-instance public demo**. No design change; one additive migration.

## 51A.1 What changed

- New additive table **`CustomerAuthThrottle`** (migration
  `20260621024108_add_customer_auth_throttle` — `CREATE TABLE` + indexes only, no
  change to existing tables). A DB backup was taken before migrating.
- New module **`src/lib/customer/rate-limit.ts`** — a DB-backed **fixed-window counter**
  behind the same `isThrottled` / `registerAttempt` / `clearAttempts` facade the actions
  already used (now `async`). The 49A in-memory store (`throttle.ts`) is kept as a
  **fallback** (see 51A.4).
- `src/lib/customer/actions.ts` now imports the limiter from `./rate-limit` and `await`s
  it. **Scopes, identifiers, limits, windows, messages, and the throttled audit event are
  unchanged** — login/register keyed by IP, password/profile keyed by customer id; generic
  user-facing copy; `customer.auth.throttled` still recorded.

## 51A.2 Data model & privacy

`CustomerAuthThrottle { id, keyHash, scope, count, windowStart, resetAt, createdAt,
updatedAt }`. **Privacy by construction:** the limiter key (`<scope>:<ip>` or
`<scope>:cust:<id>`) is **sha256-hashed into `keyHash`** before any write, so the raw IP /
customer id is **never** stored; `scope` is a safe machine label. The table never holds a
password, cookie, token, secret, raw header, or email.

## 51A.3 Algorithm & cleanup

- **Fixed window:** the first attempt opens a window (`count=1`, `resetAt=now+windowMs`);
  later attempts increment; once a row's `resetAt` is in the past it reads as **not
  throttled** and the next attempt lazily reopens a fresh window at `count=1`. A successful
  action clears the row.
- **Deterministic** (no randomness in the decision), **no account enumeration** (decision
  depends only on counts; user-facing copy stays generic), **no external services**.
- **Cleanup:** lazy per-key reset + a **probabilistic** (~5%) opportunistic
  `deleteMany` of rows expired > 1h (`cleanupExpiredThrottles`), so the table stays bounded
  without a cron.

## 51A.4 Backend selection / fallback

The DB-backed counter is **authoritative whenever the DB is reachable** — i.e. the normal
case — so budgets now **survive a server restart / HMR**. If a limiter DB query throws, the
facade logs and **fails over to the in-memory store** (49A behaviour) so the limiter can
never be the thing that breaks auth. This is the intended dev/DB-down resilience.

## 51A.5 Verification

`npm run db:verify:customer-auth` extended (now **51 checks**): the durable limiter's real
SQL is exercised against the DB **inside an always-rolled-back transaction** — trips at the
budget, expired-window reset, clear reopens, isolated **per identifier** and **per scope** —
and the `CustomerAuthThrottle` row count is asserted **unchanged** afterwards (no pollution).

## 51A.6 Remaining limitations

- **Single-instance only.** The counter is correct for one app process against one DB, which
  is the public-demo target. It uses no row locks / atomic compare-increment, so under heavy
  concurrency a few attempts can race past the exact boundary (best-effort, fails toward
  *allowing* — never a hard lockout). **Multi-instance / high-abuse production** still wants a
  shared store with atomic ops (Redis or Postgres advisory locks); `rate-limit.ts` is the
  single swap-in point.
- Email reset / verification, per-device sessions, and guest-order linking remain **deferred**
  (unchanged).

---

# Этап 59A — Email foundation note (password reset / verification)

> Context: Stage 59A added an **email FOUNDATION** (`EmailOutbox` table + template slots,
> including `password_reset` and `email_verification`) for future wiring. This does NOT
> change the auth/account behaviour above — it is recorded here only so the gap is precise.

## 59A.1 What the email foundation does (and does NOT) do for auth

- It reserves the **template identifiers** `password_reset` and `email_verification` and a
  renderer for each, but those renderers are honest **placeholders**: they state that sending
  is not active and embed **no token**. See `src/lib/email/templates.ts`.
- **No password-reset flow exists.** "Забули пароль?" is still a no-op — there is **no reset
  token, no hashed-token model, no reset link, and no email is sent.** A working flow requires:
  (1) an email provider + verified domain (SPF/DKIM/DMARC), and (2) a `PasswordResetToken`
  model storing **only a hashed token** with an expiry, plus a no-account-enumeration response.
  Both remain **owner/provider-gated** and explicitly out of scope for 59A.
- **No email verification flow exists** for the same reason.
- Email remains **immutable** in v1 (no email-change flow), unchanged by 59A.

## 59A.2 Remaining gaps (carried forward, unchanged)

- **No password reset / email verification working flow** — foundation/templates only; needs a
  provider + a hashed-token model (deferred).
- **No email change**, **no per-device session journal**, **no guest-order linking by email**.

---

# Этап 60A — Email Operations & Account Recovery Foundation

Status: **implemented** (foundation). Builds the **provider-ready** password-reset and
email-verification flows on **hashed, single-use tokens** and a **no-send** email
provider/processor. **No real email is sent**, no provider (SendGrid/Mailgun/SMTP) is
configured, no credentials are read, no `.env` is touched, and no DNS auth (SPF/DKIM/DMARC)
is set up — delivery stays **owner/provider-gated**. Closes the 59A "no reset/verification
token model" gap without claiming delivery. Additive migration only
(`20260621222555_add_email_account_recovery`); no design/CSS change.

## 60A.1 Schema (additive)

- `CustomerAccountToken` — single-use recovery/verification token. Stores **only**
  `tokenHash` (sha256 of the raw token, `@unique`), `purpose`
  (`password_reset | email_verification`), `expiresAt`, `usedAt`, `customerId` (FK,
  cascade). The **raw token is never persisted** (or logged, or shown in admin/docs).
- `Customer.emailVerifiedAt DateTime?` — null = not verified. Safe display field; **not**
  required for login or guest checkout.
- `EmailOutbox` gains `attempts Int @default(0)` + `lastError String?` (safe machine
  summary — never a token/secret/body). `EmailOutboxStatus` adds `skipped_no_provider`
  and `failed_validation`.

## 60A.2 Provider-ready architecture (no send)

- `src/lib/email/provider.ts` — `EmailProvider` facade + **`NoSendEmailProvider`**
  (default: validates, then returns `failed_validation` for no recipient, else
  `skipped_no_provider` — **never sends**) and a verify-only `StubEmailProvider`
  (`sent_stub`). `getEmailProvider()` returns NoSend (`PROVIDER_CONFIGURED = false`). The
  **single documented boundary** where a future real adapter plugs in — it must re-render
  the body at send time (bodies are never persisted).
- `src/lib/email/process.ts` — injectable processor: `queued → terminal` status,
  increments `attempts`, stamps `processedAt`, records a safe `lastError`. Idempotent
  (a terminal row is never re-processed). Run the backlog with `npm run email:process:stub`.
- `enqueueEmail` (server-only) now writes a `queued` row and processes it inline (no-send),
  so the live order-confirmation path lands in an honest terminal state.

## 60A.3 Password reset

- `src/lib/customer/account-token.ts` (pure crypto: generate/hash, **TTL 45 min**) +
  `account-token-repo.ts` (injectable DB primitives: create / single-use consume /
  supersede) + `recovery.ts` (`'use server'` actions).
- `requestPasswordResetAction` returns a **generic acknowledgement whether or not the
  account exists** (no enumeration), is **IP rate-limited** (`passwordReset` scope) and
  **audited** as `anonymous` (no email stored). For an existing account it creates a token
  and enqueues a reset **intent** (recorded `skipped_no_provider` — never delivered).
- `confirmPasswordResetAction` validates the new password, **atomically consumes** the
  single-use token, replaces the scrypt hash via `updateCustomerPasswordAndBumpVersion`
  (so **`sessionVersion` bumps → all prior sessions are revoked**), and audits completion.
  Used/expired/wrong-purpose tokens are rejected generically.
- UI: `/account/recover` (request) + `/account/reset?token=…` (confirm); the login modal
  "Забули пароль?" now links to `/account/recover`. Copy is honest that nothing is emailed
  until a provider is configured.

## 60A.4 Email verification

- `requestEmailVerificationAction` (logged-in; per-customer rate-limited) creates a token
  and enqueues a verification **intent** (no send). `confirmEmailVerificationAction`
  consumes a valid token and sets `emailVerifiedAt` (audited). The account page shows the
  status + a request button. Verification is **never required** for login or checkout.

## 60A.5 Admin visibility

- `/admin/email-outbox` shows `attempts` + a safe `lastError`, plus **counts only** of
  recovery/verification tokens (live / used / expired by purpose). **No token values, no
  bodies, no secrets.**

## 60A.6 Verification

- `npm run db:verify:email-ops` (33 checks; all DB writes in always-rolled-back
  transactions, counts asserted unchanged): provider facade honesty, outbox lifecycle
  (queued→terminal, attempts/processedAt, idempotent), token crypto, reset (hashed
  storage, password change, sessionVersion bump, single-use, expiry, supersede) and
  verification (hashed storage, sets timestamp, single-use, expiry, purpose isolation).
- `db:verify:customer-auth` / `db:verify:email-outbox` still pass unchanged.

## 60A.7 Remaining gaps (carried forward)

- **No real email delivery** — no provider (SendGrid/Mailgun/SMTP), no domain/DNS auth
  (SPF/DKIM/DMARC). Reset/verification links are **not delivered** to real inboxes today;
  the verify script drives the confirm step directly. All owner/provider-gated.
- **No email change**, **no per-device session journal**, **no guest-order linking by
  email**, **single-instance** rate-limit only.
