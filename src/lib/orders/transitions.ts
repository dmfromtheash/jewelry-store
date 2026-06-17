/**
 * AURELIA — Order status transition guard (Этап 26B)
 *
 * Central, decision-free map of which OrderStatus transitions are permitted for
 * the CURRENT enum (`draft` · `submitted` · `cancelled`). This hardens the order
 * spine ahead of payments/delivery WITHOUT touching the schema, the enum, or the
 * business flow: checkout still creates `submitted`, the admin can still cancel.
 * It only forbids illogical jumps (e.g. resurrecting a `cancelled` order).
 *
 * See docs/ORDER_LIFECYCLE_SPEC.md §5 for the future (payment-aware) table; this
 * module implements only the subset expressible with today's three statuses.
 *
 * Pure + dependency-light: only a TYPE import from Prisma (erased at runtime), so
 * it is safe to import from server actions, server components, and the verify
 * script without pulling in the Prisma client.
 */

import type { OrderStatus } from '@prisma/client'

/**
 * Allowed *changes* per source status (the target must differ from the source).
 * Anything not listed is denied. `cancelled` is terminal — no resurrection; a
 * re-order creates a brand new order.
 *
 *   draft     → submitted | cancelled
 *   submitted → cancelled
 *   cancelled → (terminal)
 */
export const ALLOWED_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['cancelled'],
  cancelled: [],
}

/**
 * True when the status is unchanged. A same-status update is treated as an
 * idempotent no-op (not a transition) by callers, BEFORE consulting the guard.
 */
export function isSameOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  return from === to
}

/**
 * Whether moving from `from` to a DIFFERENT `to` is permitted. Same-status is
 * intentionally NOT a transition here (returns false); callers detect it via
 * `isSameOrderStatus` and short-circuit to a no-op first.
 */
export function canTransitionOrderStatus(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) return false
  return ALLOWED_ORDER_TRANSITIONS[from]?.includes(to) ?? false
}

/**
 * Statuses an admin <select> may offer for the current status: the current one
 * (so the form keeps a stable default) plus every allowed next status. Terminal
 * statuses yield only themselves, so forbidden jumps are not even selectable.
 */
export function getSelectableOrderStatuses(from: OrderStatus): OrderStatus[] {
  return [from, ...ALLOWED_ORDER_TRANSITIONS[from]]
}
