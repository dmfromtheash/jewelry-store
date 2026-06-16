# AURELIA Admin Superpanel & Analytics Roadmap

> Status: planning document only. No runtime code, schema, or migrations are introduced by this file. It defines the long-term direction for turning the AURELIA admin area into a real store control center, to be implemented in small, reviewable stages.

## 1. Purpose

AURELIA needs an admin panel that is a **store control center**, not just an order list. The owner must be able to open the admin area and quickly understand the health of the business and decide what to do next.

The superpanel exists to answer concrete questions:

- What is selling, and what is not selling?
- Where do customers drop off in the journey?
- Which products attract attention but do not convert?
- Which categories, collections, materials, price bands and occasions perform best?
- Which pages have UX, SEO, performance or data-quality problems?
- Which admin actions changed important business state, and who/what changed them?
- What should be fixed next to increase trust, conversion and operational speed?

Every part of the panel should shorten the distance between **observation** and **decision**. If a screen does not help someone decide what to feature, fix, hide, restock, or rewrite, it does not belong in the panel yet.

## 2. Current confirmed state

The roadmap builds on top of what already exists and is committed:

- **PostgreSQL foundation exists** — local Prisma-based database runtime is in place.
- **Catalog is in the database** — products, variants, categories and related data live in PostgreSQL.
- **Storefront reads products from PostgreSQL** — the public catalog is backed by the database.
- **Checkout creates draft orders** — the checkout flow produces draft orders server-side.
- **Admin order management exists** — orders list and order detail with status changes are available under `/admin`.
- **Stage 18A admin auth is committed** — protected admin routes/actions, httpOnly session, and login flow are in place (`a897c2d feat: add admin auth protection`).

**Implication:** all future admin growth must build on top of the protected admin routes/actions. No new admin surface should ship without authentication, authorization, and audit awareness.

## 3. Non-negotiable admin principles

These principles override convenience and aesthetics. They are not optional.

- **Decision-first analytics** — every metric must lead to a business or operational decision. No vanity metrics. If a number cannot change a decision, it is noise.
- **Privacy-first tracking** — no PII in generic analytics events. Track behavior and outcomes, not identities. Minimize, anonymize, and expire.
- **Security-first admin** — protected routes and actions, httpOnly session cookies, an audit log for state changes, no public admin links, and `noindex` on all admin pages.
- **Operational usefulness over beauty** — a plain table that drives action beats a decorative chart that drives nothing. Charts must justify their existence.
- **Phased implementation** — build in small phases, one clean task and one commit per stage. Never ship the whole superpanel as a single chaotic feature.

## 4. Target admin information architecture

Long-term route map (aspirational; not all routes ship at once):

```
/admin
/admin/login
/admin/dashboard
/admin/orders
/admin/orders/[orderCode]
/admin/catalog
/admin/catalog/products
/admin/catalog/categories
/admin/analytics
/admin/analytics/overview
/admin/analytics/funnel
/admin/analytics/products
/admin/analytics/search
/admin/analytics/marketing
/admin/analytics/seo
/admin/site-health
/admin/security
/admin/audit-log
/admin/settings
```

Routes are added stage by stage. A route is only created when there is real data and a real decision behind it. Empty shells are acceptable only as explicitly scoped navigation foundations (see Stage 20A).

## 5. Admin modules

Each module is a coherent area of capability. Modules map loosely to routes but are described by responsibility.

- **Admin Command Center** — the landing dashboard. Shows the few most important KPIs, alerts, and shortcuts. Answers "is the store healthy and what needs attention now?"
- **Orders Operations** — process orders fast: filter, search, change status, view detail, handle fulfillment workflow. Optimized for daily operational speed.
- **Catalog Management** — create/edit products, variants, categories, pricing, availability. The source of truth for what the store sells.
- **Catalog Quality Dashboard** — surfaces data-quality problems: missing images, short descriptions, no category, missing price, broken or duplicate slugs, missing SEO fields.
- **Inventory & Stock Intelligence** — current stock, low-stock and out-of-stock alerts, stock movement history, restock suggestions based on demand.
- **Customer / CRM-light Analytics** — aggregated, privacy-safe view of customer behavior: new vs returning, order frequency, average order value, segments. No raw PII dashboards.
- **Analytics Event System** — the foundation that captures storefront and admin events into a queryable store. Everything analytical depends on this.
- **Funnel Analytics** — conversion funnel from view → cart → checkout → order. Identifies the biggest drop-off steps.
- **Product Analytics** — per-product views, add-to-cart rate, conversion, revenue contribution, attention-without-conversion detection.
- **Search Analytics** — what customers search for, what returns no results, what gets clicked, unmet demand.
- **Marketing & Attribution** — traffic sources, UTM/campaign performance, referrers, which sources bring buyers (not just visitors).
- **SEO & Product Visibility** — indexability, metadata completeness, structured data validity, visibility problems that suppress organic traffic.
- **UX Behavior Analytics** — aggregated interaction patterns (filters used, sorts changed, navigation paths) to find friction. No raw replay.
- **Finance Analytics** — revenue, average order value, refunds, discounts/coupon impact, margin signals where data allows.
- **Site Health Dashboard** — server errors, 404s, API/DB errors, slow requests, structured-data errors. Operational reliability at a glance.
- **Performance & Core Web Vitals** — page performance metrics (LCP, CLS, INP) and where the storefront is slow.
- **Accessibility & Trust Checks** — automated checks for accessibility and trust signals that affect conversion.
- **Security & Audit Center** — login activity, failed logins, session management, and the audit log of admin state changes.
- **Alerts & Recommendations** — turns metrics into prioritized, actionable suggestions: what to fix, feature, restock or investigate next.

## 6. Analytics event taxonomy

Events are grouped by domain. Names are stable identifiers; payloads carry minimal, non-identifying context.

### Storefront
- `page_view`
- `category_view`
- `product_view`
- `add_to_cart`
- `remove_from_cart`
- `cart_view`
- `begin_checkout`
- `checkout_submit_attempt`
- `draft_order_created`
- `checkout_error`

### Search / discovery
- `search_performed`
- `search_result_clicked`
- `search_no_results`
- `filter_applied`
- `sort_changed`

### Marketing / source
- `landing_page_view`
- `utm_captured`
- `referrer_captured`
- `campaign_visit`

### Admin
- `admin_login_success`
- `admin_login_failure`
- `admin_logout`
- `admin_order_status_changed`
- `admin_product_changed`
- `admin_settings_changed`
- `admin_export_created`

### Site health
- `server_error`
- `not_found`
- `api_error`
- `db_error`
- `slow_request`
- `structured_data_error`

### What must NOT be stored in analytics events
Generic analytics payloads must never contain:

- passwords;
- session cookies;
- secrets (API keys, tokens, env values);
- full payment data (card numbers, CVV, full payment tokens);
- full IP addresses retained long-term (truncate/hash, expire quickly if used at all);
- raw phone, email, or name in generic analytics payloads.

Identifiable data, when truly needed, lives in the relevant domain model (e.g. orders) under access control — never in the generic event stream.

## 7. Data model roadmap

These are **potential future** models/tables. Do **not** add them all at once. Each arrives only when its consuming feature is being built.

- `AdminUser`
- `AdminSession`
- `AdminAuditLog`
- `AnalyticsEvent`
- `AnalyticsSession`
- `DailyStoreMetric`
- `DailyProductMetric`
- `DailyCategoryMetric`
- `DailySearchMetric`
- `DailySourceMetric`
- `ProductQualityCheck`
- `SiteHealthCheck`
- `PerformanceMetric`
- `SeoCheck`
- `StructuredDataCheck`
- `InventorySnapshot`
- `InventoryAdjustment`
- `AlertRule`
- `AlertEvent`
- `AdminNote`
- `ExportJob`

### Implementation order
1. `AdminAuditLog`
2. `AnalyticsEvent`
3. daily aggregate tables (`DailyStoreMetric`, `DailyProductMetric`, `DailyCategoryMetric`, `DailySearchMetric`, `DailySourceMetric`)
4. quality/health check tables (`ProductQualityCheck`, `SiteHealthCheck`, `SeoCheck`, `StructuredDataCheck`, `PerformanceMetric`)
5. alert tables (`AlertRule`, `AlertEvent`)
6. inventory history (`InventorySnapshot`, `InventoryAdjustment`)
7. advanced customer/marketing tables (`AnalyticsSession`, `AdminUser`, `AdminSession`, `AdminNote`, `ExportJob`)

Rationale: capture trustworthy raw signals (audit + events) first, then aggregate, then add quality/health, then automation (alerts), then deeper history and advanced relationships.

## 8. Metrics to include

Grouped by purpose. Each metric should be tied to a decision.

### Store KPI
- revenue (period, with comparison to prior period)
- number of orders
- average order value (AOV)
- conversion rate (sessions → orders)
- new vs returning customers

### Product
- product views
- add-to-cart rate
- product conversion rate
- revenue per product
- attention-without-conversion (high views, low add-to-cart/conversion)

### Category / collection
- views and revenue per category/collection
- conversion rate per category
- performance by material, price band, and occasion

### Search
- top searches
- no-result searches
- search → click rate
- search → conversion rate

### Checkout
- begin-checkout count
- checkout submit attempts
- draft orders created
- checkout error rate
- step-by-step drop-off

### Marketing
- sessions and orders by source/referrer
- UTM/campaign performance
- buyers per source (not just visitors)

### Technical
- server error rate
- 404 rate
- API/DB error counts
- slow request count
- Core Web Vitals (LCP, CLS, INP)

### Security
- admin login success/failure counts
- failed-login spikes
- recent admin state changes (from audit log)

## 9. Metrics to avoid or postpone

### Avoid (do not build)
- raw mouse movement capture
- raw session replay stored in our DB
- raw IP dashboards
- exact geo coordinates
- admin productivity tracking by time-on-page
- complex ML predictions on tiny data
- multi-touch attribution before traffic scale

### Postpone (revisit only at real scale)
- warehouse-grade BI
- predictive demand forecasting
- AI merchandising autopilot
- multi-warehouse inventory
- advanced CRM automation
- loyalty engine
- payment disputes (until real payments exist)

## 10. UX rules for admin UI

- **Persistent sidebar** for primary navigation.
- **Topbar** with a date-range selector and a logout control.
- **Desktop-first** admin layout (the panel is an operational tool, not a mobile storefront).
- **Tables** support filters, search, sorting, and pagination.
- **Clear empty / loading / error states** on every data view.
- **First dashboard screen** shows only **5–8 key widgets** — no clutter.
- **Every chart** must have: a title, the period shown, a comparison (vs prior period), a short explanation of what it means, and an action link to where the user can act on it.

Styling note: admin UI uses the project's existing CSS approach (`src/styles/admin.css`). Do **not** introduce Tailwind or CSS Modules.

## 11. Admin permissions roadmap

### V1 (current direction)
- single admin credential sourced from environment;
- protected admin routes and actions;
- httpOnly session.

### V2
- `AdminUser` model;
- password hash (no plaintext, no reversible storage);
- roles: `owner`, `manager`, `content`, `support`, `analyst`;
- per-action permissions.

### V3
- 2FA;
- active sessions list;
- forced logout;
- account recovery;
- admin invite flow.

Each version is additive and gated behind the prior version being stable.

## 12. Suggested implementation stages

One clean task and one commit per stage. Each stage states what to include and, importantly, what **not** to include.

- **18A — Admin Auth & Protection Foundation — done.** Protected routes/actions, httpOnly session, login. *Not included:* multi-user accounts, roles.
- **18B — Admin Security Hardening Pass.** Rate-limit login, lockout on repeated failures, security headers, confirm `noindex` on admin, session expiry review. *Not included:* 2FA, new data models.
- **19A — Admin Superpanel Roadmap Doc — this stage.** This document. *Not included:* any runtime code, schema, or migrations.
- **20A — Admin Shell & Navigation Foundation.** Persistent sidebar, topbar, route scaffolding for the target IA. *Not included:* real analytics data, charts.
- **21A — Admin Audit Log Foundation.** `AdminAuditLog` model + writing audit entries on admin state changes. *Not included:* analytics events, dashboards.
- **22A — Analytics Event Taxonomy & Spec.** Finalize event names, payload shapes, privacy rules as a spec/doc. *Not included:* capture implementation.
- **23A — Analytics Event Capture Foundation.** `AnalyticsEvent` model + capture pipeline for storefront events. *Not included:* aggregation tables, dashboards.
- **24A — Dashboard KPI v1.** First Command Center with 5–8 KPI widgets from available data. *Not included:* funnel, product deep-dives.
- **25A — Orders Operations v2.** Faster filtering/search, bulk-friendly status workflow, better order detail. *Not included:* analytics charts.
- **26A — Catalog Quality Dashboard.** Detect missing images/descriptions/categories/SEO fields. *Not included:* automated fixes.
- **27A — Search Analytics.** Top searches, no-result searches, click/conversion. *Not included:* recommendations engine.
- **28A — Funnel Analytics v1.** View → cart → checkout → order drop-off. *Not included:* multi-touch attribution.
- **29A — Product Performance Dashboard.** Views, add-to-cart, conversion, revenue, attention-without-conversion. *Not included:* forecasting.
- **30A — Marketing Attribution v1.** Source/UTM/referrer performance, buyers per source. *Not included:* multi-touch models.
- **31A — SEO & Product Visibility Health.** Indexability, metadata, structured-data validity checks. *Not included:* automated content rewriting.
- **32A — Performance & Site Health.** Errors, 404s, slow requests, Core Web Vitals surfacing. *Not included:* APM-grade tracing.
- **33A — Alerts Foundation.** `AlertRule`/`AlertEvent` + basic threshold alerts. *Not included:* ML anomaly detection.
- **34A — Reports & Exports.** `ExportJob` + CSV/report generation for key metrics. *Not included:* scheduled email delivery (unless explicitly scoped).
- **35A — Customer Analytics v1.** Privacy-safe aggregated segments, new vs returning, AOV by segment. *Not included:* raw PII dashboards.
- **36A — Behavior Analytics Integration Plan.** Plan for aggregated UX behavior signals. *Not included:* raw session replay storage.
- **37A — Advanced Insights / AI Assistant.** Natural-language insights/recommendations over existing data. *Not included:* autonomous changes to the store.

## 13. Readiness gates

Do not advance past a gate until its conditions are met.

- **Before analytics expansion:** admin auth is stable, audit log exists, and at least one reliable data source is in place.
- **Before raw analytics event storage:** the event taxonomy and privacy rules (Stage 22A) are finalized and reviewed; retention and minimization are defined.
- **Before customer analytics:** confirmed that all customer-facing metrics are aggregated and privacy-safe, with no raw PII in the analytics layer.
- **Before AI insights:** there is enough trustworthy historical data, and outputs are advisory only (no autonomous store changes).

## 14. Claude implementation rules for this roadmap

For every future stage built from this roadmap, the assistant must:

- start with `git status` and `git log` to confirm a clean, known state;
- explain the scope of the stage before changing anything;
- list the expected files to be created/modified;
- avoid unrelated changes (no drive-by refactors or formatting churn);
- run the relevant checks (typecheck, build, db verification, Prisma validate where applicable);
- produce a final report: summary, changed files, commands run, risks, and a clear safe-to-commit status;
- **never commit or push unless explicitly asked** after ChatGPT review — with the explicit exception that **this stage (19A) is already allowed to commit if the docs-only checks pass**.

## 15. Definition of "best admin" for AURELIA

The admin superpanel is successful when it:

- protects order and customer data;
- processes orders quickly;
- shows which products and categories work;
- shows where checkout loses customers;
- reveals search demand (including unmet demand);
- reveals catalog, data-quality, and SEO problems;
- warns about technical and security issues;
- explains changes through audit logs;
- helps decide what to feature, fix, hide, restock, or rewrite.

That is the bar: not the most features, but the most **decisions enabled per screen**, safely and quickly.
