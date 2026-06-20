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
