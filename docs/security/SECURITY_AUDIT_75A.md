# AURELIA — Security Audit & Hardening Recommendations (Этап 75A)

**Status:** AUDIT / RECOMMENDATION ONLY — no application code, schema, design, or
configuration was changed. This document is the sole deliverable.

**Date:** 2026-06-23
**Repo:** `C:\Projects\Jewelry Store` · branch `main`
**HEAD at audit:** `2978961` (docs: refresh 74A buyer handoff audit) — unchanged by this stage
**Reviewer:** Claude (Opus 4.8), manual structured review.

> `/security-review` slash command: a `security-review` skill IS available in this
> environment. It is scoped to "the pending changes on the current branch" (a diff
> reviewer). This stage has **no pending diff** (working tree clean, docs-only output),
> so the diff-oriented command was not the right fit; instead a full manual,
> whole-codebase security review was performed and is recorded here.

---

## 1. Repo state

| Item | Value |
| --- | --- |
| Path | `C:\Projects\Jewelry Store` |
| Branch | `main` |
| Starting HEAD | `2978961` |
| Ending HEAD | `2978961` (+ this docs-only commit, if approved) |
| Local vs remote | `main` in sync with `origin/main` at audit start |
| Working tree | clean at audit start |

---

## 2. Audit scope completed

All requested areas were reviewed against the live source (read-only):

- [x] **A. Admin security** — login/session/guard/throttle/audit/exposure
- [x] **B. Customer auth** — register/login/logout/profile/password/reset/verify, tokens, sessions
- [x] **C. Checkout / order** — server-authoritative pricing, stock & promo race-safety, validation
- [x] **D. Prisma / database** — query patterns, injection surface, transactions, PII, script guards
- [x] **E. API routes & request validation** — the single `/api/analytics` route + Server Actions
- [x] **F. Frontend / data exposure** — public bundles, JSON-LD, sitemap/robots, NEXT_PUBLIC
- [x] **G. Headers & browser security** — CSP, frame, content-type, referrer, permissions, HSTS, cookies
- [x] **H. Dependency / security hygiene** — `npm audit`, scripts, build/typecheck status
- [x] **I. Public-demo / production gap analysis**
- [x] **J. Recommended hardening roadmap**

---

## 3. Findings summary

Severity reflects **real-world** risk *in the tier named*. Many items are **Info/Low for
the local buyer demo** but rise for public-demo / real-launch exposure.

| ID | Severity | Area | Finding | Evidence | Recommendation | Needed for |
| --- | --- | --- | --- | --- | --- | --- |
| F1 | **Medium** (Low local · Med public · High launch) | Headers | No HTTP security headers (CSP, X-Frame-Options/`frame-ancestors`, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS). | `next.config.ts` is bare (no `headers()`); no CSP anywhere. | Add a `headers()` block (or middleware) before any public exposure; HSTS only on real HTTPS prod. Mind inline JSON-LD when authoring CSP (use hash/nonce). | public demo / real launch |
| F2 | **Low** | Dependency | 2 moderate vulns: `postcss <8.5.10` (XSS via unescaped `</style>`), transitive via Next. | `npm audit` (both modes). | Build-time only, not a runtime exposure. Fix by bumping Next to a point release that pulls patched postcss. **Do NOT** `npm audit fix --force` (it downgrades Next to 9.x — breaking). | real launch (dep refresh) |
| F3 | **Medium** (public) / Info (local) | Cookies | `Secure` cookie flag is gated on `NODE_ENV==='production'`. A public demo served over HTTPS but in dev mode would emit session cookies without `Secure`. | `secure: process.env.NODE_ENV === 'production'` in admin `auth.ts`, customer `session.ts`, analytics `record.ts`. | Any public/HTTPS exposure must run a **production build** (`NODE_ENV=production`); never expose `next dev`. | public demo |
| F4 | **Low** (gated) | Admin | Admin login throttle is in-memory + keyed on spoofable `x-forwarded-for`, fails open on restart; admin sessions are not revocable (12h expiry only). | `src/lib/admin/auth.ts` (`loginAttempts` Map, `getLoginClientKey`, no `sessionVersion`). | Acceptable while admin is **local-only / 404 in prod**. If admin is ever exposed: AdminUser/DB model + durable per-account limiter + session revocation + 2FA. | real launch *only if admin exposed* |
| F5 | **Low** now / Med launch | Rate limit | Durable customer limiter is single-instance fixed-window (no cross-instance atomic lock — documented swap-in point); admin limiter is per-process. | `src/lib/customer/rate-limit.ts` header notes; `auth.ts` Map. | Fine single-instance. Multi-instance/serverless hosting needs a shared atomic store (e.g. Redis). | real launch (hosting-dependent) |
| F6 | **Low / Info** | Frontend | JSON-LD injected via `dangerouslySetInnerHTML` + `JSON.stringify` without escaping `<` / `</script>`. Data is **admin-controlled** (product name/description); customer free-text rejects markup. | `app/layout.tsx:54`, `app/product/[slug]/page.tsx:119,124`, `app/category/*/page.tsx:58`. | Escape the `<` character (encode it as a unicode escape) in the serialized string before injection. Confirm the admin catalog form also rejects markup in name/description. Small, design-safe hardening. | nice-to-have (do before public demo) |
| F7 | **Info** (mitigated) | CSRF | No app-level CSRF tokens — relies on Next 15 Server Actions' built-in same-origin enforcement + the analytics route's explicit Origin check. | `app/api/analytics/route.ts:27-33`; Server Actions are the only other mutation surface. | Adequate. Behind a proxy/CDN at launch, set `serverActions.allowedOrigins`. | real launch (if proxied) |
| F8 | **Low / Info** | Customer session | 30-day TTL, no idle timeout, no "log out all devices" UI (revocation does exist via password change → `sessionVersion++`). | `src/lib/customer/token.ts` (`CUSTOMER_SESSION_TTL_SECONDS`), `session.ts`. | Acceptable for e-commerce. Optional: idle timeout + explicit "sign out everywhere". | nice-to-have |
| F9 | **Critical/High** (launch) · N/A (demo) | Production gap | No real payment (no webhook signature verify/idempotency), no real email send (no SPF/DKIM/DMARC), no carrier API creds, no separate prod DB/secret-manager/rotation, no backups/logging/monitoring/alerting, no legal/fiscal/privacy (cookie consent, UA data-protection). | By design; documented in `docs/sale/COMMERCIAL_LAUNCH_ARCHITECTURE.md`. | All owner/provider/lawyer-gated. Must be closed before taking real orders/payments. | real launch |
| F10 | **Info** (good) | Error handling | Server actions log `err.message` server-side only and return generic, localized messages; no stack traces to client; Prisma logs warn/error. | `customer/actions.ts`, `recovery.ts`, `orders/actions.ts` catch blocks; `db/prisma.ts`. | None — keep. | — |
| F11 | **Info** (good) | DB scripts | `db:seed` exists but is never in the check path; `db:start/stop` guard the isolated 6700 data dir; verify scripts roll back; no raw SQL anywhere. | `package.json` scripts; `git ls-files` (no `.env` committed); `grep` found **no** `$queryRaw*/$executeRaw*`. | Keep operator discipline (no `db:seed` on a populated DB). | — |

---

## 4. Highest-priority risks

### Must fix BEFORE a public demo (small, design-safe, no owner decision required for the config itself)
1. **Add HTTP security headers** [F1] — at minimum: `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY` / CSP `frame-ancestors 'none'`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Permissions-Policy` (deny camera/mic/geo), and a
   conservative CSP (account for inline JSON-LD via hash/nonce).
2. **Serve a production build over HTTPS** [F3] — `NODE_ENV=production` so cookie
   `Secure`/`SameSite` engage; never expose `next dev`. (This also keeps admin 404 via
   `ensureLocalAdmin`, which already hard-blocks `production`.)
3. **Re-confirm admin is unreachable publicly** [F4] — it is by design (`notFound()` when
   `NODE_ENV==='production'` OR host ∉ localhost); verify on the actual host/proxy.
4. *(Quick win)* **Escape JSON-LD output** [F6].

### Must fix BEFORE real payment / delivery / email / production (owner-gated)
- Payment provider + **webhook signature verification** + idempotency keys [F9].
- Email provider + **SPF/DKIM/DMARC** + actually wiring token delivery [F9].
- Carrier API credential management [F9].
- Separate production DB + **secret manager** + rotation + strong unique secrets [F9].
- **Backups, centralized logging, monitoring/alerting**, incident response [F9].
- **Legal/privacy**: privacy policy, cookie consent for analytics, UA data-protection &
  fiscal obligations [F9].
- Durable **cross-instance** rate limiting + admin hardening (AdminUser model, 2FA,
  session revocation) **if** admin is ever exposed [F4][F5].
- Dependency refresh incl. postcss [F2].

### Can defer (nice-to-have)
- Idle session timeout + "log out all devices" UI [F8].
- Expired account-token cleanup job (tokens are inert once expired).
- Admin 2FA (only relevant if admin is exposed).

---

## 5. What is already good (verified)

This codebase is **unusually disciplined** for a local/demo MVP. Verified strengths:

- **Admin is local-only by construction** — `ensureLocalAdmin()` calls `notFound()` in
  `production` **and** on any non-localhost host. Admin pages do not exist in prod. Each
  admin page *and* mutation re-checks the guard + session (defense in depth).
- **Hand-rolled crypto is correct**: admin & customer sessions are HMAC-SHA256-signed,
  `httpOnly`, `SameSite=lax`, `Secure`-in-prod, with `timingSafeEqual` and a min-32-char
  secret enforced; tokens **fail closed** when unconfigured.
- **Customer identity is fully separated from admin** — different cookie name and a
  **distinct signing key** (own secret, else a labelled-HMAC derivation of the admin
  secret). A customer token can never validate as an admin token.
- **Session revocation** (47C): a password change/reset bumps `sessionVersion`, invalidating
  every previously issued token on every device on next request.
- **Passwords**: `scrypt` (memory-hard, N=2¹⁵), per-password random salt, constant-time
  compare, cost params embedded for future rehash; never stored/returned/logged. Login runs
  a **dummy hash** when the account is missing to equalize timing, and returns a single
  generic error (no account enumeration).
- **Recovery tokens**: single-use, short-lived, stored **only as sha256 hash**; raw token
  never logged/returned; generic reset acknowledgement (no enumeration).
- **Checkout is server-authoritative**: the client sends only slug + qty (+ a promo *code
  string*). All prices/names/availability and the discount are recomputed from the DB;
  `customerId` comes from the verified session. Stock decrement and promo redemption are
  **race-safe** (conditional `updateMany`) inside **one transaction** with rollback.
- **No SQL injection surface** — zero raw SQL; everything is parameterized Prisma.
- **No XSS sinks** except JSON-LD over admin-controlled data; React auto-escapes the rest.
  Customer free-text fields reject `<>`, `javascript:`, `data:` and are length-capped (KDF
  input capped as a DoS guard).
- **Analytics is genuinely privacy-preserving**: no PII column (verified), **no `userId`
  even for logged-in customers** on engagement events, anonymous session-scoped opaque
  cookie (not a super-cookie), coarse signals only (device bucket, external referrer
  domain), allowlist + payload sanitizer. The single `/api/analytics` route enforces
  same-origin + JSON-only + 2 KB body cap and never logs payloads.
- **Admin data views never leak secrets** — `customers.ts` etc. select only safe metadata
  with explicit "NEVER passwordHash" intent; **token COUNTS only**, never token values,
  hashes, cookies, or email bodies.
- **Audit logging** of admin and customer auth/security events, with no PII/secret payload.
- **Secret hygiene**: no `.env`/`.env.local` committed (only `.env.example` template);
  `.gitignore` covers all `.env*`; `NEXT_PUBLIC_*` is used only for the public site URL.
- **SEO/exposure honesty**: `noindex/nofollow` default on all `/admin` routes; `robots.ts`
  disallows admin/account/checkout/cart/api; JSON-LD `aggregateRating` only when approved
  reviews exist; no external analytics/pixels/trackers; open-redirect protection on
  admin post-login (`sanitizeNextPath`).
- **No design/photo/product-card/gallery/placeholder/layout changes** were made.

---

## 6. Checks run

| Command | Result | Note |
| --- | --- | --- |
| `npm run typecheck` | **PASS** | `tsc --noEmit`, exit 0 |
| `npx prisma validate` | **PASS** | schema valid |
| `npm run demo:sale-docs-check` | **PASS** | 9 docs scanned, 0 contradictions |
| `npm run demo:preflight` | **PASS** | (covered by `:full`) |
| `npm run demo:preflight:full` | **PASS** | no blocking failures; 1 soft WARN (`DATABASE_URL not loaded in this process` — informational; Prisma/Next load it at runtime) |
| `npm audit` | **PASS (review)** | 2 moderate (postcss, transitive via Next) — see F2; **not fixed** |
| `npm audit --omit=dev` | **PASS (review)** | same 2 moderate |
| `npm run build` | **PASS** | full build OK; admin routes present as dynamic fns but 404 in prod via guard |
| `npm run smoke:routes` | **PASS** | 30 routes rendered/gated as expected |
| `npm run smoke:admin` | **PASS** | 15 admin surfaces render authed, gated unauthed |
| `npm run db:verify:customer-auth` | **PASS** | hashing/sessions/validation/scoping/throttle/audit; nothing committed |
| `npm run db:verify:analytics-events` | **PASS** | **no PII column**; sanitizer + write path rolled back |
| `npm run db:verify:audit-log` | **PASS** | write path rolled back; nothing committed |
| `npm run db:verify:email-ops` | **PASS** | no-send provider honest; hashed single-use tokens; revocation |
| `npm audit fix` | **NOT RUN** (intentionally — would break Next) |

---

## 7. DB / server handling

- AURELIA PostgreSQL **6700**: was **stopped** at start → **started** for build/smoke/verify
  → **stopped again** at end (confirmed `6700` free).
- Dev server **5000**: **started** (background) for smokes → **stopped** (listener PID
  killed; `5000` free). The known "lingering next-server child" gotcha was handled.
- **dm-bot PostgreSQL 5432: untouched** — confirmed listening (PID 6284) before and after;
  never connected to.
- **No** `db:seed` / reset / drop / truncate was run. All `db:verify:*` scripts roll back
  their test data (verified by their own "nothing committed" assertions).

---

## 8. Files changed

- **Added:** `docs/security/SECURITY_AUDIT_75A.md` (this report).
- No other files changed. **Docs-only.** No app code, schema, migration, CSS, UI, images,
  or config touched.

---

## 9. Commit

- Proposed (docs-only): `docs: add 75A security audit recommendations`
- Hash: _to be filled once committed; **not pushed**._
- No serious *unmitigated* vulnerability was found that requires stopping for an emergency
  fix; the gaps are exposure-tier hardening items (headers, prod-serving, launch providers),
  appropriately deferred.

---

## 10. Claude recommendation

- **Safe for local buyer demo now?** **Yes.** The security posture for a localhost demo is
  effectively complete — strong auth/session crypto, server-authoritative checkout, no
  injection/XSS surface of note, no PII analytics, no secret exposure, admin local-only.
- **Safe for public demo now?** **Not yet — but close.** Close F1 (security headers), F3
  (serve a production build over HTTPS; never `next dev`), re-confirm F4 (admin stays 404),
  and ideally F6 (escape JSON-LD). This is a small, design-safe hardening pass.
- **Safe for real launch now?** **No — by design.** The launch tier (F9) needs the
  owner/provider/lawyer-gated layer: real payment + webhook verification, real email +
  DNS auth, carrier creds, production DB + secret management, backups/logging/monitoring,
  and legal/privacy compliance.
- **Next security-related stage:** a scoped **"Public-Demo Hardening"** stage —
  security headers + JSON-LD escaping + a production-serving runbook — **only when a public
  demo is actually approved**. Defer all launch-tier items until the owner makes the
  provider/hosting decisions in `COMMERCIAL_LAUNCH_ARCHITECTURE.md`.
- **Implement hardening now or defer?** **Defer.** The local buyer demo is safe as-is; this
  audit (75A) is the deliverable. Begin the public-demo hardening set the moment a public
  demo is greenlit, and the launch set when provider/legal decisions are made.

---

## 11. Final confirmations

- [x] No deploy performed.
- [x] No tunnel / cloud connection created.
- [x] No `.env` / `.env.local` printed or edited (only the public `.env.example` template was read).
- [x] No secrets printed.
- [x] No DB reset / drop / seed / truncate.
- [x] dm-bot PostgreSQL **5432 untouched** (verified before & after).
- [x] No design / image / product-card / gallery / placeholder changes.
- [x] No push performed.
- [x] AURELIA DB 6700 and dev server 5000 both stopped; final `git status` clean except this report.
</content>
</invoke>
