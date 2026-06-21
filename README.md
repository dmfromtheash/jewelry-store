# AURELIA — Jewelry Store Demo MVP

## What this is

Ukraine-first, **sale-ready demo MVP** online store for a small jewelry /
accessories / gifts brand. Currency **₴ (UAH)**. Stack: Next.js 15 / React 19 /
TypeScript / Prisma / PostgreSQL.

It is an honest **demo / handoff** project: a working Ukrainian storefront +
admin + end-to-end order flow with a **manual** payment/delivery model. It is
**not** a live deployed shop and makes **no** real-payment / real-carrier claims.

## Current readiness

Honest ranges (from the buyer-handoff audit):

| Dimension | Readiness |
|---|---|
| Buyer / demo package | **~90%** |
| Technical MVP | **~80–85%** |
| Ukrainian localization | **~95%** |
| Real launch | **~25–30%** |
| Payment / delivery APIs | **~10–15%** |

Demoable now; **not** launch-ready. The gap to launch is owner / legal /
provider decisions + imagery — not core engineering.

## What is implemented

- Ukrainian storefront & catalog (home, categories, product pages, info pages)
- Product variants (real selector; price/stock aware)
- Client cart (guest, variant-aware lines)
- Checkout with **manual** payment & delivery, server-authoritative pricing
- Inline order confirmation (`AUR-…` code)
- Admin: catalog / orders / variants / stock, order lifecycle, audit log
- Customer accounts: registration / login / logout, profile editing, password change
  with stale-session invalidation, order history + own order detail (guest checkout preserved)
- Screenshots and sale/handoff docs

## What is not implemented yet

- Real online **payment acquiring** (no LiqPay / WayForPay / webhooks / "paid" state)
- **Carrier API / TTN / tracking** (delivery is a manual choice + note)
- **Production deploy** (no live hosted shop)
- **Fiscalization (РРО/ПРРО)** / legal launch package
- **Real product photos** (placeholders are intentional for now)
- **Notifications** (email / SMS) and customer-account **email features** — password
  reset, email verification (accounts themselves exist; these are deferred)
- **Account hardening** — durable rate limiting, auth audit logs, guest-order linking,
  per-device session management (deferred to public-launch hardening)

These are deliberate, separately-scoped next steps — not hidden defects.

## Start here

- [`docs/sale/FINAL_BUYER_HANDOFF.md`](docs/sale/FINAL_BUYER_HANDOFF.md) — top-level handoff (start here)
- [`docs/sale/README.md`](docs/sale/README.md) — sale package index & reading order
- [`docs/sale/DEMO_RUNBOOK.md`](docs/sale/DEMO_RUNBOOK.md) — how to run the local demo
- [`docs/sale/FEATURES_AND_LIMITS.md`](docs/sale/FEATURES_AND_LIMITS.md) — honest works-vs-deferred list
- [`docs/sale/OWNER_DECISION_CHECKLIST.md`](docs/sale/OWNER_DECISION_CHECKLIST.md) — what the owner must decide before launch
- [`docs/sale/LIVE_DEMO_DEPLOY_READINESS.md`](docs/sale/LIVE_DEMO_DEPLOY_READINESS.md) — deploy-readiness audit (planning only — nothing is deployed)
- [`docs/sale/LOCAL_TUNNEL_DEMO_RUNBOOK.md`](docs/sale/LOCAL_TUNNEL_DEMO_RUNBOOK.md) — safe temporary-tunnel demo runbook (docs-only — no tunnel is created)

## Local demo

- Run the demo via [`docs/sale/DEMO_RUNBOOK.md`](docs/sale/DEMO_RUNBOOK.md) (verify script names against `package.json`).
- **Before any public-demo / tunnel / deploy decision**, run the read-only gate: `npm run demo:preflight` (security posture + tooling check; no deploy, no DB, no secrets), or `npm run demo:rehearsal` for the full local demo/sale rehearsal — see [`scripts/demo/README.md`](scripts/demo/README.md) and [`docs/sale/DEMO_SALE_READINESS_REPORT.md`](docs/sale/DEMO_SALE_READINESS_REPORT.md).
- **Do not** make production claims — this is a local demo with a manual payment/delivery model.
- **Do not** expose a public tunnel without explicit owner approval — see the tunnel runbook.

## Important safety notes

- **No secrets** in the repo or in chat; never open or print `.env` / `.env.local`.
- **Do not** run DB reset / drop / seed casually.
- The **dm-bot PostgreSQL on `:5432`** is unrelated and must **not** be touched.
- AURELIA's local DB is the isolated instance on **port `6700`**.
- The **admin is local / internal by design** — it returns **404 under `NODE_ENV=production`** (`ensureLocalAdmin`), so a hosted demo serves the storefront only.

## Current snapshot

- **Latest audited baseline:** `e9c7664 feat: harden customer session security`
  (local `main` = `origin/main`; includes customer accounts 47A–47C).
- *This tracks the latest formally-audited milestone, not every commit — refresh it at handoff milestones.*
