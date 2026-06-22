/**
 * AURELIA — Admin audit log (Этап 21A)
 *
 * Server-only helper that records important admin/security actions to the
 * append-only `AdminAuditLog` table and reads them back for the admin UI.
 *
 * Privacy & safety rules (enforced by construction here — see SECURITY_NOTES):
 *   - NEVER store passwords, the attempted password, session cookies, or the
 *     session secret.
 *   - NEVER store raw full customer PII in a generic audit payload. For orders
 *     we log the order CODE + status transition only, not name/phone/email.
 *   - Failed logins are recorded as actor "anonymous" with a machine `reason`;
 *     the attempted username is intentionally NOT stored.
 *   - Writing an audit row must never break the underlying admin action: every
 *     write is wrapped so a logging failure is swallowed (logged to server
 *     console without secrets), not propagated.
 */

import 'server-only'

import type { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'

/** Stable action identifiers. Keep these strings stable — they are queried. */
export const AUDIT_ACTIONS = {
  loginSuccess: 'admin.login.success',
  loginFailure: 'admin.login.failure',
  logout: 'admin.logout',
  orderStatusChanged: 'admin.order.status_changed',
  productCreated: 'admin.product.created',
  productUpdated: 'admin.product.updated',
  productHidden: 'admin.product.hidden',
  productPublished: 'admin.product.published',
  productImageUpdated: 'admin.product.image_updated',
  productImageRemoved: 'admin.product.image_removed',
  productVariantAdded: 'admin.product.variant_added',
  productVariantUpdated: 'admin.product.variant_updated',
  productVariantRemoved: 'admin.product.variant_removed',
  settingsUpdated: 'admin.settings.updated',
  pageUpdated: 'admin.page.updated',
  reviewApproved: 'admin.review.approved',
  reviewRejected: 'admin.review.rejected',
  promoCreated: 'admin.promo.created',
  promoUpdated: 'admin.promo.updated',
  promoActivated: 'admin.promo.activated',
  promoDeactivated: 'admin.promo.deactivated',
  promoArchived: 'admin.promo.archived',
} as const

/** Human-readable labels for the audit-log UI (fallback: the raw action). */
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  [AUDIT_ACTIONS.loginSuccess]: 'Вход',
  [AUDIT_ACTIONS.loginFailure]: 'Неуспешный вход',
  [AUDIT_ACTIONS.logout]: 'Выход',
  [AUDIT_ACTIONS.orderStatusChanged]: 'Смена статуса заказа',
  [AUDIT_ACTIONS.productCreated]: 'Товар создан',
  [AUDIT_ACTIONS.productUpdated]: 'Товар обновлён',
  [AUDIT_ACTIONS.productHidden]: 'Товар скрыт с витрины',
  [AUDIT_ACTIONS.productPublished]: 'Товар возвращён на витрину',
  [AUDIT_ACTIONS.productImageUpdated]: 'Изображение товара обновлено',
  [AUDIT_ACTIONS.productImageRemoved]: 'Изображение товара удалено',
  [AUDIT_ACTIONS.productVariantAdded]: 'Вариант товара добавлен',
  [AUDIT_ACTIONS.productVariantUpdated]: 'Вариант товара обновлён',
  [AUDIT_ACTIONS.productVariantRemoved]: 'Вариант товара удалён',
  [AUDIT_ACTIONS.settingsUpdated]: 'Настройки сайта обновлены',
  [AUDIT_ACTIONS.pageUpdated]: 'Инфо-страница обновлена',
  [AUDIT_ACTIONS.reviewApproved]: 'Отзыв одобрен',
  [AUDIT_ACTIONS.reviewRejected]: 'Отзыв отклонён',
  [AUDIT_ACTIONS.promoCreated]: 'Промокод создан',
  [AUDIT_ACTIONS.promoUpdated]: 'Промокод обновлён',
  [AUDIT_ACTIONS.promoActivated]: 'Промокод активирован',
  [AUDIT_ACTIONS.promoDeactivated]: 'Промокод деактивирован',
  [AUDIT_ACTIONS.promoArchived]: 'Промокод архивирован',
}

export interface AuditEventInput {
  /** Who acted (session subject, or "anonymous"). Never a secret. */
  actor: string
  /** One of AUDIT_ACTIONS (or another stable identifier). */
  action: string
  /** Defaults to true; pass false for failed/refused actions. */
  success?: boolean
  entityType?: string | null
  entityId?: string | null
  /** Short, safe, human-readable summary (no secrets/PII). */
  summary: string
  reason?: string | null
  /** Minimal structured context. MUST be free of secrets/cookies/PII. */
  metadata?: Prisma.InputJsonValue
}

/**
 * Records one audit event. Reliable but side-effect-safe: a failure to write
 * the audit row is caught and logged (without secrets) so it can never break
 * the admin action that triggered it.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    await prisma.adminAuditLog.create({
      data: {
        actor: input.actor,
        action: input.action,
        success: input.success ?? true,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        summary: input.summary,
        reason: input.reason ?? null,
        metadata: input.metadata,
      },
    })
  } catch (err) {
    // Audit logging must never throw into the caller. Log only the action and a
    // short error string — never the event payload (which could carry context).
    console.error(
      `[audit] failed to record "${input.action}": ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }
}

/** Successful admin login. */
export function auditLoginSuccess(actor: string): Promise<void> {
  return recordAuditEvent({
    actor,
    action: AUDIT_ACTIONS.loginSuccess,
    success: true,
    summary: `Успешный вход администратора (${actor}).`,
  })
}

/**
 * Failed/refused admin login. Records ONLY a machine reason
 * ("invalid_credentials" | "throttled" | ...) — never the attempted
 * username or password.
 */
export function auditLoginFailure(reason: string): Promise<void> {
  const summary =
    reason === 'throttled'
      ? 'Вход отклонён: слишком много попыток.'
      : 'Неуспешная попытка входа.'
  return recordAuditEvent({
    actor: 'anonymous',
    action: AUDIT_ACTIONS.loginFailure,
    success: false,
    reason,
    summary,
  })
}

/** Admin logout. */
export function auditLogout(actor: string): Promise<void> {
  return recordAuditEvent({
    actor,
    action: AUDIT_ACTIONS.logout,
    success: true,
    summary: `Выход администратора (${actor}).`,
  })
}

/** Recent audit events for the admin UI. Metadata is intentionally NOT selected
 * (the UI never dumps raw JSON). Defaults to the 50 most recent. */
export async function getRecentAuditEvents(limit = 50) {
  return prisma.adminAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      actor: true,
      action: true,
      success: true,
      entityType: true,
      entityId: true,
      summary: true,
      reason: true,
    },
  })
}

export type AdminAuditEvent = Awaited<ReturnType<typeof getRecentAuditEvents>>[number]
