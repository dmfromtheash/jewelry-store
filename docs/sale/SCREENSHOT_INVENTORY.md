# Screenshot Inventory — AURELIA (Stage 55A)

> Visual-evidence inventory for the buyer/demo package: what each screenshot proves, how
> current it is, and what is intentionally captured **manually**. This stage **does not
> redesign or recapture** the curated historical set — it audits it, adds the one safe new
> unauthenticated proof (`account-login-prompt.png`), and documents how to capture the
> authenticated screens.
>
> Index: [`README.md`](./README.md) · readiness: [`DEMO_SALE_READINESS_REPORT.md`](./DEMO_SALE_READINESS_REPORT.md)
> · screenshot capture detail: [`DEMO_SCREENSHOT_CHECKLIST.md`](./DEMO_SCREENSHOT_CHECKLIST.md).
>
> **All screenshots are local/demo assets — not proof of a live deployment.** Dev-mode shots
> show the small Next.js "N" indicator (a dev artifact, absent in production builds).

---

## 1. How screenshots are captured

- **Unauthenticated pages** — `npm run demo:capture` (`scripts/demo/capture-screenshots.mjs`):
  dependency-free, uses the **already-installed Microsoft Edge** headless (no Playwright/
  Puppeteer). Needs a running local dev server; GET-only; never reads/prints `.env`/secrets;
  writes only its named target PNGs. Used here to add `account-login-prompt.png`.
- **Authenticated pages** (logged-in account, order history/detail, admin audit-log) — captured
  **manually** per §4. Edge's `--screenshot` flag is a single GET and cannot carry a session
  cookie, and automating it would require a CDP driver plus committed demo customer/order data;
  this stage deliberately does **not** force that. The flows themselves are verified by
  `npm run db:verify:customer-auth` (51/51) and `npm run smoke:admin` (16/16).

---

## 2. Current screenshot inventory

Legend — **Buyer-safe?** = safe to show a buyer as-is. **Pre-accounts?** = predates the
customer cabinet (47A) / customer-auth audit (49A).

### Storefront — dev set (`docs/sale/screenshots/`)

| File | Proves | Current? | Buyer-safe? | Pre-accounts? | Caveat |
|---|---|---|---|---|---|
| `01-home-desktop.png` … `10-checkout-empty-mobile.png` | home, categories, product+variants, gallery, empty checkout, admin login (desktop+mobile) | ⚠️ pre-39D | Yes | Yes | superseded by Ukrainian recaptures (39D) + `production/`; kept as reference |
| `account-login-prompt.png` **(NEW, 55A)** | the **customer cabinet entry** (`/account` logged-out: "Особистий кабінет", Увійти / На головну) | ✅ current | Yes | **No** | dev "N" indicator; unauthenticated |

### Interactive — dev set

| File | Proves | Current? | Buyer-safe? | Pre-accounts? | Caveat |
|---|---|---|---|---|---|
| `cart-with-variant.png` / `-mobile` | variant-aware cart line | ✅ | Yes | Yes | dev "N" |
| `filled-checkout.png` / `-mobile` | filled manual checkout (delivery + payment) | ✅ | Yes | Yes | dev "N"; fictional data |
| `order-confirmation.png` | inline confirmation with `AUR-…` code | ✅ | Yes | Yes | dev "N" |

### Admin — dev set (admin is local-only by design; no production admin shot)

| File | Proves | Current? | Buyer-safe? | Pre-accounts? | Caveat |
|---|---|---|---|---|---|
| `admin-dashboard.png` | admin shell + dashboard | ✅ | Yes | Yes | shows admin chrome (Russian, by design) |
| `admin-catalog.png` | catalog list / CRUD entry | ✅ | Yes | Yes | — |
| `admin-product-edit-gallery-variants-stock.png` | product editor: gallery + variants + stock | ✅ | Yes | Yes | — |
| `admin-order-detail.png` | order snapshot (items, variant, methods, totals) | ✅ | Yes | Yes | — |

### Production-build set (`docs/sale/screenshots/production/`)

| File | Proves | Current? | Buyer-safe? | Pre-accounts? | Caveat |
|---|---|---|---|---|---|
| `home-production.png`, `category-bijouterie-production.png`, `category-gifts-production.png`, `product-variants-production.png`, `cart-with-variant-production.png`, `filled-checkout-production.png`, `order-confirmation-production.png` | storefront + checkout flow on a **production build** (no "N" indicator) | ✅ current (39D Ukrainian) | Yes | Yes | the cleanest buyer-facing set; storefront only (admin 404s in prod) |

---

## 3. What the existing set proves vs. the gap

- **Well covered:** storefront (home/category/product/variants/gallery), guest cart, filled
  manual checkout, order confirmation, and admin (dashboard, catalog, product editor with
  gallery/variants/stock, order detail). These flows are **unchanged** since capture, so the
  shots remain **accurate and acceptable** for the buyer package.
- **Newly covered (55A):** the customer **cabinet entry** (`account-login-prompt.png`).
- **Still missing as screenshots (authenticated — see §4):** logged-in `/account` (profile +
  order history), a customer's **own order detail**, profile/password forms, and the admin
  **audit log showing `customer.*` events**. Nothing in the package is *wrong* — these newer
  (47A–49A) surfaces are simply **not pictured** yet. They are functionally verified by the
  automated checks, so this is a **visual-evidence gap, not a correctness gap**.

---

## 4. Manual capture checklist for the authenticated screens (safe, local)

Do this locally only; **no tunnel, no public URL, admin stays local**. Demo data created here
is **fictional**; clean it up afterward (last step).

**Setup**
1. `npm run db:start` then `npm run dev` → `http://127.0.0.1:5000`.
2. Use an incognito window so cookies are clean.

**Customer account proofs**
3. Register a demo customer (fictional): e.g. `demo.buyer@aurelia.test` / a throwaway password
   / name "Демо Покупець" / phone "+380501112233". **Do not type real personal data.**
4. Place one order as that logged-in customer (manual delivery + payment), reach the `AUR-…`
   confirmation.
5. Open `/account` → capture **`account-logged-in.png`** (profile block + "Мої замовлення" with
   the order). Optionally capture the profile/password forms → `account-profile-form.png`.
6. Open the order from the history → capture **`account-order-detail.png`** (owner-scoped order).

**Admin audit proof**
7. Log into `/admin/login` (creds from `.env.local` — **keep the fields off-screen / blank in the
   shot; never display `.env`**). Open `/admin/audit-log` → capture **`admin-audit-log-customer-events.png`**
   showing the `customer.*` rows (register/login/profile/password) from steps 3–6.

**Secret safety for every shot**
- No `.env`/`.env.local` open anywhere on screen; no tokens/passwords/cookies visible.
- Admin login fields blank in the capture; the audit log stores no PII/secrets by design.

**Cleanup (so no fake buyer data persists)**
8. In admin, **cancel** the demo order (cancel restocks). The demo customer + its `customer.*`
   audit rows are local fictional data; remove them with a one-off Prisma delete if desired
   (`prisma.customer.delete` / targeted `adminAuditLog.deleteMany` by the demo actor) — this is
   targeted cleanup, **not** `reset`/`drop`/`seed`. Then `npm run db:stop`.

Place captured files in `docs/sale/screenshots/` using the names above, then add a row to §2.

---

## 5. Verdict

- The **current package is acceptable for buyer demos**: every shown screen is accurate, and the
  newest customer-cabinet entry is now pictured (`account-login-prompt.png`).
- The **authenticated account/audit screenshots are an optional polish item**, capturable in a
  few safe local minutes via §4. They are **not** required for an honest demo (the flows are
  verified by automated checks), so this gap is explicitly **deferred, not hidden**.
