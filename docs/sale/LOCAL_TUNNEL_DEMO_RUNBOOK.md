# Local Tunnel Demo Runbook — AURELIA

> Package index: [`README.md`](./README.md) · deploy-readiness audit:
> [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) · local demo:
> [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) · honest limits:
> [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md).
>
> **Docs-only runbook (Stage 44B).** This document describes *how* a short, supervised
> buyer demo over a **temporary tunnel** could be run later. **It does not create a
> tunnel, expose localhost, deploy, or change any code.** No tunnel command is executed
> here. A real tunnel demo is a **separate, owner-approved** action (§11). Operates inside
> the gates set by [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md).

---

## 1. Purpose

To let the owner give a buyer a **temporary clickable link** for a **short, supervised**
demo of the **storefront** — without deploying, without exposing admin/secrets/real data,
and without claiming a production deployment. A tunnel briefly forwards a public URL to the
**locally running** AURELIA storefront on the owner's machine; when the tunnel and the app
stop, the link dies. This is a **demo aid, not a deployment** and not a live shop.

---

## 2. When to use

Use a temporary tunnel demo **only** when **all** of these hold:

- The buyer genuinely needs a **temporary clickable link** (screen-share alone isn't enough).
- The demo is **supervised** — the owner is present for the whole session and stops it after.
- **No real customer data** is involved — only fictional demo data.
- **No real payments / delivery** are claimed — the model stays honestly manual.
- The owner **accepts the temporary tunnel's limitations** (no SLA/uptime, link may change,
  request limits, testing/dev-only nature — see §7).

If any of these is not true, **use the local screen-share demo** in
[`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) instead — it is the safer default.

---

## 3. What this demo can show

Over the tunnel (storefront only):

- **Ukrainian storefront & catalog** — home, categories (Біжутерія / Подарунки), product
  pages, info pages; prices in **₴ (UAH)**.
- **Product variants** — real selector (e.g. coating) with price/variant updates.
- **Cart** — guest, variant-aware lines.
- **Checkout** — guest; **manual** payment + delivery model; server-authoritative pricing.
- **Order confirmation** — inline, with an `AUR-…` code.
- **Sale docs / screenshots** — the buyer package in this folder (shown from the screen, not
  served over the tunnel).

**Admin is not shown over the tunnel.** Admin is **local-only / production 404 by design**
(`ensureLocalAdmin`) — show it via **local screen-share only**, never the public link,
**unless** the owner explicitly approves it after a security review (not part of this
runbook).

---

## 4. What this demo must not claim

- ❌ **Not production** — it is a temporary local demo behind a throwaway tunnel.
- ❌ **Not a live store** taking real orders/money.
- ❌ **No real acquiring** (no LiqPay/WayForPay/charge/webhook/"paid" state).
- ❌ **No real carrier API** (no Nova Poshta/Ukrposhta TTN/tracking).
- ❌ **No fiscalization** (РРО/ПРРО) / receipts / legal-compliance guarantees.
- ❌ **No real product photos** — imagery is placeholder by chosen strategy.
- ❌ **No public admin** — admin stays local; the tunnel serves storefront only.
- ❌ **No SLA / uptime** — the link is unstable and disposable (see §7).

Keep the same honesty baseline as
[`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md) and
[`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) §10.

---

## 5. Pre-demo checklist

Before starting anything (safe checks only):

- [ ] **Git clean & in sync** — `git status` clean; `main` matches `origin/main`. Do not
      commit/push during the demo.
- [ ] **DB backup if order creation is planned** — if the demo will create orders, take a
      snapshot first with the existing `npm run db:backup`. **No** reset/drop/seed.
- [ ] **Only demo data** — confirm the catalog/orders are the fictional seed/demo data; no
      real customer PII anywhere.
- [ ] **No secrets visible** — close `.env` / `.env.local`; never open or print them; keep
      admin credential fields empty on screen.
- [ ] **No `.env` printing** — don't echo, cat, or screen-share any env file or token.
- [ ] **Decide whether checkout/order creation is allowed** — either keep it read-only
      (browse only) or allow a single fictional test order (and note it for cleanup, §9).
- [ ] **Decide admin = local only** — confirm admin will be shown via local screen-share,
      not over the tunnel (default), unless a separate approved exception applies.
- [ ] **Decide demo duration** — agree a short, fixed time box (e.g. the call length).
- [ ] **Prepare the shutdown plan** — know how you will stop the tunnel, the app, and the
      DB afterwards (§9) before you start.

---

## 6. Safe local startup flow

Start the app **locally** exactly as for a normal local demo (the tunnel, if used, is added
on top in §7). **Confirm the exact scripts in `package.json` before running** — do not
invent commands.

1. **Start the AURELIA DB** (isolated Postgres on port **6700**): `npm run db:start`.
   - The dm-bot Postgres on `:5432` is unrelated and must **not** be touched.
2. **Check DB health** (optional, read-only): `npm run db:status` / `npm run db:health`
   (expect `HEALTH: OK`). If `db:start` looks like it timed out, check health first — **do
   not** reset (see [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) §7).
3. **Start the app server** — per `package.json`:
   - **Dev:** `npm run dev` → `http://127.0.0.1:5000` (shows the small Next.js dev "N"
     indicator).
   - *(Optional cleaner build:* `npm run build` then `npm start` — but note **admin returns
     404 under `NODE_ENV=production` by design**, so use dev if you also need admin locally.
     Confirm the port from `package.json` before relying on it.)*
4. **Verify the local URL** in a browser on the machine first (storefront loads, catalog
   renders) **before** considering any tunnel.

> This runbook does **not** run these commands; it documents the order for the owner to
> execute consciously at demo time. Verify each script name against `package.json`.

---

## 7. Tunnel options and limits

A temporary tunnel (e.g. a Cloudflare Quick Tunnel / TryCloudflare, or an equivalent
temporary forwarder) forwards a public URL to the local storefront port. Per the
official-source findings in
[`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) §3/§12:

- **Testing/development only** — temporary tunnels are **not** for production and must not
  be presented as one.
- **No production claims** — the link is a demo aid, not a deployed shop.
- **Link may be unstable / change** — a quick tunnel issues a random URL that changes each
  run and can drop.
- **No uptime / SLA** — the provider gives no guarantee; treat it as disposable.
- **Request / feature limits apply** — e.g. concurrency caps and no SSE on quick tunnels;
  fine for one supervised viewer, not for load.
- **Supervised access only** — share the link only with the buyer, for the agreed window,
  and stop it immediately after (§9).

**No step-by-step public-exposure command is provided here.** Actually starting a tunnel is
**future execution that requires explicit owner approval** and a separate guarded prompt
(§11). Point any tunnel **only at the storefront port**, never at admin, and never at a
machine holding real data.

---

## 8. Recommended live demo flow

Mirror the local flow in [`DEMO_RUNBOOK.md`](./DEMO_RUNBOOK.md) §4 and
[`BUYER_DEMO_SCRIPT.md`](./BUYER_DEMO_SCRIPT.md), over the temporary link:

1. **Homepage** `/` — Ukrainian storefront from the DB.
2. **Category** `/category/bijouterie` (or `/category/gifts`) — product grid.
3. **Product with a variant** `/product/serogi-kaplya` — switch coating; price/variant update.
4. **Cart** — add to cart; variant-aware line in the drawer.
5. **Checkout** — **fictional** data only; pick Нова Пошта + a manual payment option.
6. **Confirmation** — inline `AUR-…` code; honest manual-payment note.
7. **Admin — local screen-share only** (not over the tunnel): dashboard, order detail,
   catalog/variants/stock. State that admin is intentionally local-only / 404 in production.
8. **Sale docs / handoff** — show [`FINAL_BUYER_HANDOFF.md`](./FINAL_BUYER_HANDOFF.md) and
   the rest of the package from the screen, stating limits honestly.

---

## 9. Shutdown checklist

Immediately after the demo:

- [ ] **Stop the tunnel** (if one was used) — terminate the tunnel process so the public
      link goes dead.
- [ ] **Stop the app server** — stop `npm run dev` / `npm start` (free port 5000 / the build
      port).
- [ ] **Stop the AURELIA DB** — `npm run db:stop` (port 6700), returning to the stopped
      baseline.
- [ ] **Confirm ports closed** — no app/tunnel still listening/forwarding.
- [ ] **Confirm git clean** — `git status` clean; nothing committed/pushed during the demo.
- [ ] **Note any demo orders created** — record any new `AUR-…` test orders for awareness;
      they are fictional demo data (the owner may cancel them in admin — cancel restocks).
- [ ] **Do not reset / drop / seed** — never "clean up" via destructive DB commands; leave
      data intact (use a backup/restore only if explicitly decided).

---

## 10. Risks and mitigations

| Risk | Mitigation |
|---|---|
| **Public exposure of the machine/app** | Tunnel **only** the storefront port; short, supervised window; stop the tunnel right after (§9); never expose the whole machine. |
| **Admin exposure** | Admin is local-only / 404 in production by design; **never** route the tunnel at admin; show admin via local screen-share only. |
| **Secrets leakage** | Never open/print `.env` / `.env.local`; keep credential fields empty on screen; don't screen-share terminals showing tokens. |
| **Fake production claims** | State plainly it's a temporary demo (manual payment/delivery, no live deploy); follow §4 and the handoff red lines. |
| **Demo orders accumulating** | Use fictional data; back up before order creation; note new `AUR-…` orders (§9); do not reset/drop/seed. |
| **Tunnel instability / changing link** | Expect a disposable, possibly-changing URL with no SLA; keep the session short; have screenshots ready as fallback. |
| **Buyer misunderstanding** | Frame it as a *demo of the foundation*, not a launched store; restate limits verbally and point to [`FEATURES_AND_LIMITS.md`](./FEATURES_AND_LIMITS.md). |
| **Local machine dependency** | The demo lives only while the owner's machine + DB + app + tunnel run; it is not hosted; plan the session around that, and stop everything after. |

---

## 11. Next step after runbook

- **Actually running a tunnel demo requires separate explicit owner approval** and a
  **guarded execution prompt** — this runbook documents the procedure but performs nothing.
- **A persistent demo URL** is a different track — use the **Persistent Demo Environment
  SPEC** with a **separate demo DB**, access control, and the admin-404 reality, per
  [`LIVE_DEMO_DEPLOY_READINESS.md`](./LIVE_DEMO_DEPLOY_READINESS.md) §11. Not this runbook.
- **Real production launch waits** for owner / legal / provider decisions
  ([`OWNER_DECISION_CHECKLIST.md`](./OWNER_DECISION_CHECKLIST.md)) — payments, delivery,
  fiscalization, real catalog + licensed imagery, domain, backups, security review.

> Default recommendation: keep the **local screen-share demo** as the baseline; use a
> temporary tunnel only for a specific, approved, supervised buyer session — and tear it
> down immediately afterward.
