/**
 * AURELIA — Admin customer support: pure indicators + types (Этап 68A)
 *
 * Pure, dependency-free logic + types for the /admin/customers support view. NO Prisma,
 * NO `server-only`, NO React — so the SAME indicator logic is shared by the server data
 * layer (customers.ts) AND the verify script (under tsx, which cannot import `server-only`).
 *
 * Everything here is derived from already-safe aggregate inputs (counts / booleans). It
 * NEVER sees a password hash, token hash, raw token, cookie/session, email body, recipient,
 * or raw provider payload — those never reach this module by construction.
 *
 * These are honest SUPPORT signals for the store owner, not alarms: each item is factual,
 * carries a count, a severity, and an admin link to act on it. Nothing here is a destructive
 * action — the admin customer area is strictly read-only.
 */

/** Severity of a support indicator: needs doing → noteworthy → informational. */
export type SupportSeverity = 'action' | 'warn' | 'info'

export interface CustomerSupportIndicator {
  /** Stable key (for React keys + deterministic tests). */
  key: string
  label: string
  severity: SupportSeverity
  /** Admin link to act on / investigate (always an in-app /admin or /product link). */
  href: string
}

/**
 * SAFE aggregate inputs the indicator builder needs — all counts / booleans, never PII.
 * Computed server-side from the customer's already-minimised projection.
 */
export interface CustomerSupportInput {
  /** Email is verified (Customer.emailVerifiedAt is set). */
  emailVerified: boolean
  /** Customer has at least one stored contact phone. */
  hasPhone: boolean
  orderCount: number
  /** Reviews by this customer still awaiting moderation (status = pending). */
  pendingReviewCount: number
  /** Outbox rows for this customer/their orders in a failed/skipped terminal state. */
  emailProblemCount: number
  /** Wishlist rows pointing at a hidden/unavailable product the buyer can't actually get. */
  wishlistUnavailableCount: number
  /** Live (unused, unexpired) password-reset tokens — a recent recovery attempt. */
  liveRecoveryTokenCount: number
  /** Orders that carry a manual delivery branch/comment the owner must fulfil by hand. */
  manualDeliveryOrderCount: number
}

const SEVERITY_RANK: Record<SupportSeverity, number> = { action: 0, warn: 1, info: 2 }

export const SUPPORT_SEVERITY_LABELS: Record<SupportSeverity, string> = {
  action: 'Действие',
  warn: 'Внимание',
  info: 'Инфо',
}

/**
 * Builds the customer's support indicator list (pure). Only conditions that are actually
 * true are emitted, ordered by severity (action → warn → info) then declared order, so the
 * verify script can assert the output exactly. The `customerId` only shapes the links — it
 * is an opaque cuid, never PII.
 *
 * Tone is deliberately calm: an unverified email or an empty order history is INFO, not an
 * alarm. A pending review (the owner must moderate) and a stale recovery request that may
 * mean a stuck customer are the only "action" items.
 */
export function buildCustomerSupportIndicators(
  input: CustomerSupportInput,
  customerId: string,
): CustomerSupportIndicator[] {
  const items: CustomerSupportIndicator[] = []
  const add = (cond: boolean, item: CustomerSupportIndicator) => {
    if (cond) items.push(item)
  }

  add(input.pendingReviewCount > 0, {
    key: 'pending-reviews',
    label: `Отзывы на модерации: ${input.pendingReviewCount}`,
    severity: 'action',
    href: '/admin/reviews?status=pending',
  })
  add(input.liveRecoveryTokenCount > 0, {
    key: 'recent-recovery',
    label: 'Есть активный запрос на восстановление доступа (письмо не отправляется — нет провайдера)',
    severity: 'action',
    href: '/admin/email-outbox',
  })
  add(input.emailProblemCount > 0, {
    key: 'email-problem',
    label: `Письма с проблемой (не отправлено/ошибка): ${input.emailProblemCount}`,
    severity: 'warn',
    href: '/admin/email-outbox',
  })
  add(input.manualDeliveryOrderCount > 0 && !input.hasPhone, {
    key: 'no-phone-manual-delivery',
    label: 'Есть заказы с ручной доставкой, но не указан телефон для связи',
    severity: 'warn',
    href: `/admin/customers/${customerId}`,
  })
  add(input.wishlistUnavailableCount > 0, {
    key: 'wishlist-unavailable',
    label: `В избранном недоступные товары (скрыты/не в продаже): ${input.wishlistUnavailableCount}`,
    severity: 'info',
    href: '/admin/catalog',
  })
  add(!input.emailVerified, {
    key: 'email-unverified',
    label: 'E-mail не подтверждён (подтверждение по почте не обязательно и письма не отправляются)',
    severity: 'info',
    href: `/admin/customers/${customerId}`,
  })
  add(input.orderCount === 0, {
    key: 'no-orders',
    label: 'Пока нет ни одного заказа',
    severity: 'info',
    href: '/admin/orders',
  })
  add(input.manualDeliveryOrderCount > 0, {
    key: 'manual-delivery',
    label: `Заказы с ручной доставкой (отделение/комментарий): ${input.manualDeliveryOrderCount}`,
    severity: 'info',
    href: '/admin/orders',
  })

  return items.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])
}
