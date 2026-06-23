# AURELIA — Public-Demo Hardening Pack (Этап 76A)

**Status:** Hardening implemented — scoped, low-risk, design-safe. Closes the public-demo
items from the 75A security audit (F1 headers, F6 JSON-LD escaping) and documents the
production-serving assumptions (F3) and Server-Actions origin posture (F7).

**Date:** 2026-06-23
**Repo:** `C:\Projects\Jewelry Store` · branch `main`
**Predecessor:** [`docs/security/SECURITY_AUDIT_75A.md`](./SECURITY_AUDIT_75A.md)

> **This is NOT a real launch, and NOT a deployment.** 76A only makes a *future* public demo
> safer to serve. It does not deploy, tunnel, or expose anything. A public demo still needs
> explicit owner approval per-demo, real production HTTPS hosting, and the owner/provider/
> lawyer-gated launch layer (payment, delivery, email, legal/fiscal) remains untouched.

---

## 1. What 76A hardened

### A. Browser security headers (closes F1)

`next.config.ts` now emits a conservative, design-safe security-header baseline on **every**
response via Next's `headers()` config. No markup, styling, layout, image, product card,
gallery, placeholder, or behaviour changed — these headers only instruct the browser to be
stricter.

| Header | Value | Purpose |
| --- | --- | --- |
| `Content-Security-Policy` | `default-src 'self'`; `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`; `form-action 'self'`; `img-src 'self' data: blob:`; `font-src 'self' https://fonts.gstatic.com`; `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`; `script-src 'self' 'unsafe-inline'`; `connect-src 'self'` | Same-origin lockdown + anti-clickjacking. The only third party allowed is Google Fonts (already used by `app/layout.tsx`). **No** analytics / pixel / payment / email / carrier domain is whitelisted. |
| `X-Frame-Options` | `DENY` | Clickjacking defence for older browsers (parity with CSP `frame-ancestors`). |
| `X-Content-Type-Options` | `nosniff` | Stops MIME sniffing. |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Minimises referrer leakage. |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Denies powerful APIs the storefront never uses. |

**CSP caveats (must be tightened before *real* launch):**

- `script-src` / `style-src` allow `'unsafe-inline'`. This is required today because Next.js
  injects inline bootstrap scripts and our **honest inline JSON-LD** structured data is inline.
  At real launch this should be replaced with a **nonce or hash** based policy (needs a small
  middleware to stamp a per-request nonce). Documented here so it is not forgotten.
- In `next dev` only, the config additionally allows `'unsafe-eval'` and the HMR websocket so
  React Fast Refresh keeps working. Production serving (`NODE_ENV=production`) gets the tighter
  policy automatically.

**HSTS is intentionally NOT emitted from the app config.** `Strict-Transport-Security` is only
safe once the site is served over real production HTTPS, and is sticky/harmful on local
`http://` dev. It belongs at the hosting/proxy/CDN layer at real launch (see §3).

### B. JSON-LD escaping (closes F6)

A new pure helper `serializeJsonLd()` in `src/lib/seo/site.ts` replaces bare `JSON.stringify`
at every inline `<script type="application/ld+json">` sink:

- `app/layout.tsx` (Organization + WebSite)
- `app/product/[slug]/page.tsx` (Product + Breadcrumb)
- `app/category/bijouterie/page.tsx` and `app/category/gifts/page.tsx` (Breadcrumb)

It escapes `<` → `<` (plus `>`, `&`, and the U+2028/U+2029 line separators) so a value
containing `</script>` can never break out of the script element. The structured data is
**byte-for-byte equivalent JSON-LD** — only the encoding of a few characters changes; no SEO
claim, rating, availability, or photo is altered. Inputs are already admin-controlled and
customer free-text rejects markup, so this is defence-in-depth, but it removes the break-out
risk entirely and is asserted by `db:verify:seo-marketing` + `security:public-demo`.

### C. Production-serving assumptions documented (F3) and Server-Actions origin posture (F7)

See §3 (runbook) and §4 (checklist). No code change was needed for F3/F7 beyond documentation:
admin is already local-only by construction (`ensureLocalAdmin()` → `notFound()` in production
or on any non-localhost host), and the `Secure` cookie flag already engages under
`NODE_ENV=production`. F7 (Server Actions `allowedOrigins`) is a real-launch / reverse-proxy
config item, recorded below.

---

## 2. New / updated checks

| Check | What it proves |
| --- | --- |
| `npm run security:public-demo` | Static assertion that the headers exist in `next.config.ts`, that the CSP whitelists no tracker/payment/email domain, that `serializeJsonLd` escapes `<`, that no inline ld+json sink uses a bare `JSON.stringify`, and that this doc carries the honest not-real-launch gating language. |
| `npm run db:verify:seo-marketing` | Now also asserts `serializeJsonLd` escapes `<`/`>`/`&`/U+2028/U+2029, round-trips to identical data, and preserves ordinary whitespace. |
| `npm run demo:preflight:full` | Now also asserts the 76A doc + `next.config.ts` headers are present (security-posture section). |

---

## 3. Public-demo serving runbook

A public demo, **once the owner approves it**, must be served like this:

1. **Production build only — never `next dev` publicly.**
   - `npm run build` then `npm run start` (`NODE_ENV=production`). This makes the session
     cookie `Secure`/`SameSite` flags engage and keeps the tighter CSP.
   - `next dev` must never be exposed publicly (cookies would lack `Secure`, HMR endpoints
     would be reachable, the CSP is relaxed for Fast Refresh).
2. **HTTPS is required** for any public sharing. Serve behind a host/proxy that terminates
   TLS. Add **HSTS** (`Strict-Transport-Security`) at that hosting/proxy layer — not in the
   app config.
3. **Admin must stay non-public.** It is local-only by construction (`ensureLocalAdmin()`
   returns `notFound()` in `production` and on any non-localhost host). Verify on the actual
   host that `/admin/*` 404s. Do not add a public admin route.
4. **Owner-provided secrets, never committed.** `NEXT_PUBLIC_SITE_URL`, the session signing
   secrets, and `DATABASE_URL` must be supplied by the owner via the host's secret store /
   env — `.env` / `.env.local` are git-ignored and must stay out of the repo.
5. **Domain + canonical** must be configured (`NEXT_PUBLIC_SITE_URL`) before a real public
   demo so canonical URLs, the sitemap, and robots stop pointing at the local/demo origin.
6. **Reverse proxy / Server Actions (F7).** If served behind a proxy or a different public
   origin, set `serverActions.allowedOrigins` (Next config) to the public origin so Server
   Actions' built-in same-origin protection keeps working. Not needed for a same-origin host.
7. **DB.** A public demo needs a dedicated demo database — never the local dev DB, and never
   dm-bot's PostgreSQL on `5432`. No seed/reset/drop against a populated DB.

---

## 4. Public-demo checklist

Before sharing a public demo link (all must be true):

- [ ] `npm run build` passes (production build).
- [ ] Served as a **production** build over **HTTPS** (`NODE_ENV=production`), not `next dev`.
- [ ] Security headers verified on the live host (CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- [ ] `npm run security:public-demo` passes (headers + JSON-LD escaping + doc honesty).
- [ ] JSON-LD escaping verified (`db:verify:seo-marketing`); structured data still valid.
- [ ] `npm run smoke:routes` passes against the running build.
- [ ] `npm run smoke:admin` passes; `/admin/*` is gated/absent on the public host.
- [ ] No external trackers/pixels/analytics in the CSP or the page.
- [ ] No public admin exposure (admin 404s on the public host).
- [ ] No real payment / email / delivery is claimed or wired (all still manual/foundation).
- [ ] No fake product photos or fabricated product/rating claims.
- [ ] Domain + canonical configured (`NEXT_PUBLIC_SITE_URL`) before the demo.
- [ ] HSTS added at the hosting/proxy layer (not the app config).

---

## 5. What 76A did NOT do (still owner / provider / lawyer-gated)

These remain **out of scope** and are not started here:

- No deploy, no tunnel, no cloud connection.
- No payment provider / webhook verification (F9).
- No real email sending / SPF / DKIM / DMARC (F9).
- No delivery / carrier API (F9).
- No external analytics / pixels / marketing automation / CRM.
- No production DB / secret manager / rotation / backups / monitoring (F9).
- No legal / privacy / fiscal compliance (cookie consent, UA data-protection) (F9).
- No nonce/hash CSP (tighten `'unsafe-inline'` at real launch).
- No `postcss` dependency bump (F2 — build-time only; do **not** `npm audit fix --force`).
- No cross-instance rate limiting / admin exposure hardening (F4/F5 — only if admin is ever
  exposed).

---

## 6. Readiness after 76A

- **Local buyer demo:** still safe — unchanged behaviour, now with security headers + escaped
  JSON-LD on top. (~92–95%.)
- **Public demo:** *safer*, but still **blocked** on owner approval + real HTTPS hosting +
  domain/secrets. The code-side public-demo hardening (F1, F6) is now done; serving it
  publicly is an owner/hosting decision. (Code hardening done; exposure still gated.)
- **Real launch:** **not ready — by design.** The F9 launch layer (payment, email, delivery,
  prod infra, legal) is owner/provider/lawyer-gated and untouched. (~25–30%.)

---

## 7. References

- 75A audit & findings: [`docs/security/SECURITY_AUDIT_75A.md`](./SECURITY_AUDIT_75A.md)
- Launch architecture (owner-gated): `docs/sale/COMMERCIAL_LAUNCH_ARCHITECTURE.md`
- Preflight gate: `scripts/demo/preflight.mjs` (`npm run demo:preflight:full`)
- Public-demo readiness: `docs/sale/PRE_PUBLIC_DEMO_READINESS.md`
