# AURELIA — Security Notes (Этап 14A)

> Specification only. These are the rules the backend MUST follow once code
> exists. Nothing here is implemented yet.

## 1. Never trust the client for money or stock
- **Server-side price calculation only.** Cart/order totals are recomputed from
  DB `Product.price` on every operation. Any `price`/`total` sent by the client
  is ignored.
- Availability (`status`, future inventory) is checked server-side at
  `cart.addItem`, `checkout.createDraft`, and again at `order.create`.
- `OrderItem` snapshots (`nameSnapshot`, `unitPrice`, `lineTotal`) are written by
  the server from DB values, not from the request.

## 2. Input validation
- Validate **every** action/route input with a schema (e.g. zod) before use:
  types, ranges (`qty >= 1`), string lengths, email/phone format, enum values
  (`status`, `sort`, `delivery`).
- Reject unknown/extra fields; do not pass raw request bodies to the ORM.
- Validate `slug`/ids exist before acting; return typed 4xx errors.

## 3. Order creation protection
- `order.create` is **idempotent per draft** (a draft converts to at most one
  order) to prevent double-submits / replays.
- Re-validate stock and price at creation time, not only at draft time.
- Authorization: an order is readable/editable only by its owner (or admin).

## 4. Rate limiting
- Apply rate limits to: `auth.login`, `auth.register`, `order.create`,
  `cart.*` bursts, and search if it becomes server-side.
- Per-IP and (where applicable) per-account counters; exponential backoff on
  repeated auth failures.

## 5. CSRF
- Server Actions: rely on Next.js' built-in same-origin protections; still treat
  cookies as `SameSite=Lax`/`Strict` and use POST semantics for mutations.
- Any custom Route Handler that mutates state must verify origin / use a CSRF
  token; never perform mutations on `GET`.

## 6. Sessions & secrets
- Sessions in **httpOnly, Secure, SameSite** cookies; no tokens in
  `localStorage`.
- All secrets (DB URL, auth secret, future payment keys) via **environment
  variables**, never committed. Provide `.env.example` with placeholder names
  only.
- Validate required env vars at boot; fail fast if missing.
- Hash passwords with a strong adaptive algorithm (bcrypt/argon2); never store
  plaintext.

## 7. Admin protection
- Admin auth is **separate** from customer auth; admin routes are role-gated
  (`owner` / `admin` / `manager`).
- Deny-by-default: admin endpoints require an authenticated admin session AND a
  permission check per action.
- **Audit log:** every admin create/update/delete writes an append-only
  `AuditLog` (actor, action, entity, timestamp; later before/after diff, IP).

## 8. PII / user data handling
- Store only what's needed (email, contact name/phone, address). Minimize.
- Do not log PII or full request bodies in plaintext logs.
- Plan for deletion/export requests (account deletion cascades or anonymizes
  orders while keeping financial records as needed).
- Encrypt sensitive fields at rest where the platform supports it.

## 9. Payment security (later, dedicated stage)
- **No card data touches our servers.** Use a hosted/redirect or
  tokenized provider; store only provider intent/charge ids.
- Verify payment status via server-to-server webhooks (signed), never trust a
  client "paid" callback.
- Keep payment keys in env / a secrets manager; rotate on exposure.
- Until then, `Payment` stays a placeholder and checkout cannot mark orders paid.

## 10. General hardening
- Principle of least privilege for the DB user.
- Parameterized queries only (ORM handles this; never string-concat SQL).
- Consistent error shape that does not leak internals/stack traces to clients.
- Security headers (CSP, HSTS, X-Content-Type-Options) at the edge/app layer.

## 11. Admin auth — current implementation (Этап 18A / 18B)
> Unlike the spec above, this section documents what is **already implemented**
> for the local admin area. The model is intentionally minimal: a single
> env-based admin credential, no `AdminUser` DB model yet.

- **Local-only gate.** `ensureLocalAdmin()` calls `notFound()` in production and
  on any non-localhost host, so `/admin/*` simply does not exist off local dev.
- **Identity.** Credentials come from env (`ADMIN_USERNAME` / `ADMIN_PASSWORD`);
  the session is a tamper-resistant `httpOnly`, `SameSite=Lax` cookie signed with
  HMAC-SHA256 (`ADMIN_SESSION_SECRET`, min 32 chars), `Secure` in production,
  scoped to `path=/admin`, 12h TTL. Comparisons are constant-time.
- **Defense in depth.** Every protected page and the order-status mutation action
  call `ensureLocalAdmin()` **and** `requireAdminSession()`; an unauthenticated
  POST is redirected to login and never mutates.
- **noindex by default.** `app/admin/layout.tsx` sets `robots: { index:false,
  follow:false }` for the whole `/admin` subtree (individual pages also set it),
  and admin routes are never linked from public navigation.
- **Generic errors.** Login failures return a generic message; no username/secret
  is disclosed, nothing sensitive is logged.
- **Login throttle (best-effort).** A dependency-free in-memory speed-bump
  (`auth.ts`: 10 failed attempts / 10-min rolling window per client key) slows
  repeated failures. It is **per-process and fails open** on restart/HMR, so it
  cannot permanently lock out the single admin — durable, per-account rate
  limiting is deferred to the future `AdminUser`/DB model (see §4 and the admin
  superpanel roadmap).

### Follow-up (not in this stage)
- Move to an `AdminUser` model with hashed passwords + roles/permissions.
- Append-only `AuditLog` for admin state changes (§7).
- Durable rate limiting (per-IP/per-account, exponential backoff) and security
  headers (§10) once admin is exposed beyond local dev.
