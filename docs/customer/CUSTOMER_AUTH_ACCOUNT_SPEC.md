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
