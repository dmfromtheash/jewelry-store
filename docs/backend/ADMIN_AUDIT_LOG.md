# AURELIA — Admin Audit Log (Этап 21A)

The first **append-only** record of important admin/security actions. This is the
audit foundation called for in the admin superpanel roadmap (data-model item #1,
`AdminAuditLog`). It is intentionally minimal: no analytics event system, no
dashboards beyond a read-only list, no `AdminUser` model yet.

## What is recorded

| Action | `action` id | actor | success |
|---|---|---|---|
| Admin login succeeded | `admin.login.success` | session username | `true` |
| Admin login failed (bad credentials) | `admin.login.failure` | `anonymous` | `false` |
| Admin login refused (throttled) | `admin.login.failure` | `anonymous` | `false` |
| Admin logout | `admin.logout` | session username | `true` |
| Order status changed | `admin.order.status_changed` | session username | `true` |

Each row stores: `id`, `createdAt`, `actor`, `action`, `success`, optional
`entityType` / `entityId`, a human-readable `summary`, an optional machine
`reason`, and an optional minimal `metadata` JSON.

## Where it lives

- **Model:** `AdminAuditLog` in `prisma/schema.prisma` (migration
  `20260616182436_add_admin_audit_log` — additive: one table + two indexes,
  no changes to existing tables).
- **Helper (server-only):** `src/lib/admin/audit.ts` —
  `recordAuditEvent()` plus `auditLoginSuccess` / `auditLoginFailure` /
  `auditLogout`, and `getRecentAuditEvents()` for the UI.
- **Call sites:** `src/lib/admin/auth-actions.ts` (login success/failure,
  logout) and `src/lib/admin/actions.ts` (order status change).
- **UI:** `/admin/audit-log` — local-only (`ensureLocalAdmin`) + session-gated
  (`requireAdminSession`), `noindex`. Lists the 50 most recent events.

## Privacy & safety rules

Audit rows are safe **by construction**. They MUST NEVER contain:

- passwords or the **attempted** password (failed logins log only a machine
  `reason`, never the submitted username/password);
- session cookies or `ADMIN_SESSION_SECRET`;
- full payment data;
- raw full customer PII. For an order status change we log the **order code**
  and the status transition only — never customer name/phone/email.

Other guarantees:

- **Side-effect-safe:** `recordAuditEvent()` wraps the write in try/catch, so a
  logging failure is logged to the server console (without the payload) and can
  never break the admin action that triggered it.
- **No raw JSON dump:** the audit page does not select or render `metadata`; it
  shows action, actor, entity, summary, time and success only.
- **Append-only in practice:** there is no update/delete path in the helper or
  UI. (Retention/rotation is a later concern — see follow-up.)

## Verify

```bash
npm run db:verify:audit-log
```

Read-only: counts events and exercises the write path inside a transaction that
is always rolled back (no test data is committed).

## Not in this stage / follow-up

- No analytics event system, dashboards, catalog editor, customer accounts, or
  payment.
- No filtering/search/pagination beyond "most recent 50".
- No retention/rotation policy yet, and no IP/user-agent capture (would require
  hashing + a defined retention window first).
- Migrates to richer actors once an `AdminUser` model exists (roadmap V2); the
  `actor` string is forward-compatible with that.
