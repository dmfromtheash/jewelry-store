# Live Demo / Deploy Readiness — AURELIA

> Package index: [`README.md`](./README.md) · top-level handoff:
> [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) · operational demo:
> [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) · honest limits:
> [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
>
> **Docs-only readiness audit (Stage 44A).** This document plans *how* AURELIA could be
> shown remotely or deployed later. **Nothing is deployed, tunneled, hosted, or exposed
> by this file.** No code, schema, CSS, images, env, or secrets are changed. It is
> **not** a deployment record and is **not** proof of a live production site.

---

## 1. Purpose

To answer, honestly and practically:

1. What is the **safest** way to show AURELIA remotely?
2. What is suitable for a **temporary buyer demo**?
3. What is suitable for a **persistent demo URL**?
4. What is suitable for **real production** later?
5. What is **blocked** by missing owner decisions, secrets, hosting, domain, provider
   accounts, or legal requirements?
6. What should **not** be done yet?

This is **deploy-readiness planning, not a deployment**. There is **no live hosted demo
today**, and this audit does not create one. The current safe baseline is the **local
demo** in [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md). Platform facts below are taken from
**official sources only** (see §12), accessed **2026-06-20**; re-verify at decision time —
provider terms, limits, and pricing change.

---

## 2. Current deploy-relevant state

Verified against the repo at the latest audited baseline (`e9c7664`, includes customer accounts 47A–47C):

- **Stack:** Next.js 15 / React 19 / TypeScript / **Prisma** / **PostgreSQL**. This is a
  **DB-backed, server-rendered** app — it needs a reachable Postgres at runtime, not just
  static files. `package.json` already exposes the standard `build` and `start` scripts
  Next.js self-hosting expects.
- **Ukrainian storefront/catalog ready** — home, categories (`bijouterie`/`gifts`),
  product pages, guest cart + checkout, inline order confirmation; currency **₴ (UAH)**.
- **Admin is local-only by design.** `src/lib/admin/guard.ts` (`ensureLocalAdmin`) calls
  `notFound()` whenever `NODE_ENV === 'production'` **or** the host is non-local — so on
  *any* normal hosted deployment the `/admin/*` panel returns **404**. Admin can only be
  shown **locally** or via screen-share. Admin routes are also `noindex`.
- **Payment/delivery are manual only.** No acquiring, webhooks, "paid" state, carrier API,
  TTN, or tracking — by deliberate design (see
  [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md),
  [`PAYMENT_DELIVERY_PROVIDER_RESEARCH.md`](./PAYMENT_DELIVERY_PROVIDER_RESEARCH.md)).
- **Product imagery is intentionally placeholder.** Image slots exist; real photos are a
  deliberate, documented gap ([`PRODUCT_IMAGERY_GAP_PLAN.md`](./PRODUCT_IMAGERY_GAP_PLAN.md)).
  Admin uploads land in `public/uploads/products/` (a local filesystem path).
- **No production deploy exists.** No domain, no hosting account, no tunnel, no public URL.
  Local dev runs on `http://127.0.0.1:5000`; the local DB is an isolated Postgres on port
  **6700** (the unrelated dm-bot Postgres on `:5432` is never touched).
- **No secrets in the repo.** `.env` / `.env.local` are gitignored; `.env.example` carries
  only placeholder values.

---

## 3. Demo options comparison

| Option | Use case | Pros | Risks / limits | Recommendation |
|---|---|---|---|---|
| **Local demo only** (current baseline) | Supervised in-person or screen-share demo | Zero exposure; full control; admin visible locally; no cost; already documented in [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) | Not clickable for the buyer; needs the owner's machine + local DB running | **Safest. Keep as the default** until a public demo is genuinely needed and approved. |
| **Cloudflare Quick Tunnel (TryCloudflare) / temporary tunnel** | Short, supervised, "give them a link for an hour" buyer demo | No domain needed; random `trycloudflare.com` URL; fast to start/stop | **Official: "intended for testing and development only"; no SLA/uptime guarantee**; hard limit **200 in-flight requests** (HTTP 429 beyond it); **no Server-Sent Events**; exposes whatever is running locally, including local data; tunnel = a public door into the owner's machine | **Only** for a short, supervised demo **after owner approval**, exposing a **clean demo build/data** — never the working machine with real data. Not for persistent use. (See §11 → 44B option A.) |
| **Managed preview/hosting (e.g. Vercel) + external Postgres** | Persistent, shareable demo URL | Git push → automatic Preview/Production deploys; env vars **encrypted at rest**, scoped per environment; Postgres via Marketplace (Neon/Supabase/etc.) with credentials auto-injected | Needs a **separate hosted Postgres** (serverless-friendly) + migrations; **admin will 404 in production by design** (§8); serverless filesystem is ephemeral, so `public/uploads/` admin uploads don't persist; account + cost + access-control decisions required | Reasonable path for a **persistent, controlled demo** with a **separate demo DB** — **after** the §5 decisions. SPEC it first (44B option B). |
| **Self-hosted VPS / Docker / Node server** | Full-control persistent demo or pre-production | Next.js self-hosting supports **all features** as a Node.js server or Docker container; admin *could* be reachable if the host is configured as "local" (security review required); persistent filesystem for uploads | You own OS patching, TLS, backups, Postgres, monitoring, secrets; more ops burden; admin exposure needs an explicit, reviewed access decision | Viable for **later** production-grade hosting; **overkill** for a buyer demo. Defer until launch decisions are made. |
| **Real production launch** | Live store taking real orders/money | Highest value | **Blocked**: needs payment/delivery integration, fiscalization (РРО/ПРРО), legal texts, real merchant/legal entity, real product data + licensed images, domain, backups, monitoring — see §9 and [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md) | **Do not attempt now.** Gated on owner/legal/provider decisions; out of scope for a demo. |

---

## 4. Recommended path (staged)

1. **Local demo remains the safe baseline.** It needs no exposure decisions and is already
   runbook-ready. Use it for the next buyer conversations.
2. **A temporary tunnel may be used only for a short, supervised buyer demo — and only if
   the owner explicitly approves** — pointing at a **clean demo build with disposable demo
   data**, never the working machine. Stop the tunnel immediately after.
3. **A persistent demo URL should use a controlled demo environment with a *separate* demo
   Postgres** (not the owner's working DB), access control, and an explicit admin-exposure
   decision. This is a SPEC + setup stage, not a one-click action.
4. **Real production launch waits** for owner / legal / provider decisions
   ([`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)), real merchant setup,
   real catalog + licensed imagery, and a security review.

> Each step up the ladder adds exposure and obligations. Do not skip steps, and do not let
> a temporary demo be described as "production."

---

## 5. Required decisions before any public demo

A public demo (tunnel **or** hosted) must not start until the owner has consciously
decided:

- [ ] **Who can access the demo** (one buyer, supervised? a shared link? password-gated?).
- [ ] **Whether admin is exposed at all** (default: **no** — admin stays local; see §8).
- [ ] **Demo DB strategy** — a **separate** disposable demo Postgres, never the working DB.
- [ ] **Whether demo orders can be public** — only **fictional/test** data; no real PII.
- [ ] **Domain / subdomain decision** (random tunnel URL vs a controlled subdomain).
- [ ] **Hosting platform decision** (tunnel vs managed vs VPS).
- [ ] **Env / secrets owner** — who holds and rotates `.env` values (never in git/chat).
- [ ] **Cost limit** — plan/tier and a ceiling the owner accepts.
- [ ] **Access / password protection** — how the link is gated and for how long.
- [ ] **Privacy / legal copy readiness** — honest "demo, manual payment/delivery, not a
      live shop" framing visible; no fake "live production" claim.

---

## 6. Environment and secrets checklist

Needed env **categories** (values are **never** listed here, in git, in chat, in
screenshots, or in logs). Mirrors `.env.example`:

- **`DATABASE_URL`** — Postgres connection string (separate value per local / demo / prod).
- **Admin auth/session** — `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`
  (32+ char random). *(Note: admin is 404 in production anyway — see §8.)*
- **App / base URL** — the public origin for the chosen environment, if needed.
- **Future payment/delivery keys** — **none yet**; only when integrations are built
  (gated — [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)).

Rules:

- **Never commit secrets.** `.env` / `.env.local` stay gitignored.
- **Never paste secrets into chat, docs, screenshots, or logs.**
- **Use the provider's env storage** (e.g. managed-host env settings, encrypted at rest)
  rather than files on a shared box.
- **Separate values per environment** — local, demo, and prod must use different secrets
  and different databases.

---

## 7. Database strategy

- **The current local DB is not a production DB.** It is the isolated dev Postgres on port
  **6700**, holding seed catalog + fictional demo orders. It must not be exposed directly.
- **A persistent demo needs a *separate* demo Postgres** (e.g. a managed Marketplace
  Postgres such as Neon/Supabase, or a dedicated demo instance) — provisioned, migrated
  (`prisma migrate`), and seeded with **disposable test data only**.
- **Production needs an owner-controlled Postgres with backups** and a restore plan, owned
  and paid for by the owner.
- **Demo orders must be disposable / test-only** — fictional contacts, no real customer PII.
- **No reset / drop / seed without a backup and explicit approval.** The existing local
  demo orders (`AUR-…`) must not be modified by this work. `npm run db:backup` exists for
  safe snapshots; destructive commands are owner-only and deliberate.
- **dm-bot Postgres on `:5432` is never touched** — it is an unrelated system.

---

## 8. Admin exposure policy

- **Current admin is local-only by design.** `ensureLocalAdmin` returns **404** under
  `NODE_ENV=production` and for any non-local host. So on a normal managed/hosted deploy,
  **the admin panel does not exist** — a hosted demo URL shows the **storefront only**.
- **Do not expose admin publicly without a security review.** Bypassing the local guard to
  make admin reachable on a public host is a deliberate, reviewed change — not part of a
  demo. It would require authentication hardening, rate limiting, and an exposure decision.
- **For a buyer demo, show admin locally / via screen-share**, or inside a controlled,
  private environment only. The admin screenshots in this package
  ([`screenshots/`](./screenshots/)) are dev/local by design and are the reference for
  what admin looks like.

---

## 9. What not to deploy yet

- ❌ **Real payment provider** (LiqPay / WayForPay / acquiring / webhooks / "paid" state).
- ❌ **Delivery / carrier API** (Nova Poshta / Ukrposhta TTN / tracking).
- ❌ **Fiscalization** (РРО / ПРРО) / receipts / legal-compliance wiring.
- ❌ **Production customer data** (real PII) — demos use fictional data only.
- ❌ **Public admin** (keep the local-only 404 behavior; no public admin without review).
- ❌ **Owner secrets** in git, chat, screenshots, or logs.
- ❌ **Unlicensed images** (imagery stays placeholder until owned/licensed photos exist).
- ❌ **Anything pretending to be live production** — a temporary/demo URL is **not**
  production and must not be described as such.

---

## 10. Readiness gates

A public demo may proceed **only** when all are green (a hosted/production deploy adds the
launch gates in [`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)):

- [ ] **Preflight gate green** (gate 0) — `npm run demo:preflight` passes (security posture +
      tooling/docs present; DB target is the isolated 6700, not dm-bot 5432). Read-only, no
      deploy. See [`PRE_PUBLIC_DEMO_READINESS.md`](./PRE_PUBLIC_DEMO_READINESS.md) §preflight
      and [`../../scripts/demo/README.md`](../../scripts/demo/README.md).
- [ ] **Build green** — `npm run build` + `npm run typecheck` pass.
- [ ] **Env checklist filled** (§6) — values held outside git, per environment.
- [ ] **Demo DB ready** — separate, migrated, test-only data; backup taken.
- [ ] **Secrets stored outside git** — provider env storage / gitignored local files only.
- [ ] **Admin exposure decision made** (default: not exposed — §8).
- [ ] **Access control decided** — who can reach the link, and how it's gated.
- [ ] **Backup / rollback plan** — for the demo DB and the deployment.
- [ ] **Owner approves public access** — explicitly, for the specific demo.
- [ ] **Legal / privacy text acceptable for a demo** — honest framing, no fake claims.

---

## 11. Recommended next stage

Choose based on the goal:

- **44B — Local Tunnel Demo Runbook** — *if* the goal is a **temporary, supervised buyer
  demo** with a clickable link. A short, safety-gated runbook for a Cloudflare Quick Tunnel
  (or equivalent) pointing at a **clean demo build + disposable data**, with explicit
  start/stop, access, and "stop after the call" steps. Honors the official "testing/dev
  only, no SLA" nature of Quick Tunnels.
- **44B — Persistent Demo Environment SPEC** — *if* the goal is a **stable demo URL**. A
  SPEC for a controlled demo environment (managed host or VPS) with a **separate demo
  Postgres**, env/secrets handling, access control, the admin-404 reality, and backups —
  **no deploy performed in the SPEC**.
- **Otherwise, stop and keep the screenshot/demo package only.** The local demo +
  screenshots + this package are a complete, honest buyer story; no public demo is required
  to sell the foundation.

> **Recommendation:** keep the **local demo** as the default now. Pursue 44B (tunnel
> runbook) only when a specific buyer needs a clickable link, and only with owner approval.
> Treat a persistent demo URL as a separate, SPEC-first stage. Do **not** deploy or expose
> anything from this audit.

---

## 12. Official sources checked (accessed 2026-06-20)

Platform facts above come **only** from current official documentation:

- **Next.js — Deploying** (`nextjs.org/docs/app/getting-started/deploying`): supported
  options are **Node.js server (all features)**, **Docker (all features)**, **static export
  (limited)**, and **adapters**; self-hosting expects `build` + `start` scripts; Vercel and
  Bun are listed as **verified adapters**; Cloudflare/Netlify provide their own integrations.
- **Vercel — Deploying** (`vercel.com/docs/deployments`): Git push triggers automatic
  deployments; environments are **Local / Preview / Production** (production on the
  production branch, usually `main`); other methods include Drop, CLI (`vercel --prod`),
  Deploy Hooks, REST API.
- **Vercel — Environment variables** (`vercel.com/docs/environment-variables`): env vars are
  configured outside source code, **encrypted at rest**, scoped per environment
  (Production / Preview / Development / custom); changes apply only to new deployments;
  64 KB total per deployment.
- **Vercel — Storage overview** (`vercel.com/docs/storage`): Vercel has **no native
  first-party Postgres**; relational **Postgres is provided via the Vercel Marketplace**
  (Neon, Supabase, Upstash, etc.), with credentials **auto-injected as environment
  variables**.
- **Cloudflare — Quick Tunnels / TryCloudflare**
  (`developers.cloudflare.com/.../trycloudflare/`): random `trycloudflare.com` subdomain, no
  domain needed; **"intended for testing and development only"**; **no SLA / uptime
  guarantee**; **hard limit of 200 in-flight requests** (HTTP 429 beyond it); **no SSE**;
  for production use a remotely-managed tunnel instead.

**Unavailable / uncertain at audit time:** none of the above required login; all read
cleanly on 2026-06-20. Provider tariffs, limits, and onboarding terms change — **re-verify
the specific platform's official docs at decision time** before any public demo or deploy.
