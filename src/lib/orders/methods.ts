/**
 * AURELIA — Order method allowlists (Этап 26B → 27B)
 *
 * Single source of truth for the free-text `deliveryMethod` / `paymentMethod`
 * columns. The schema stores these as plain strings; this module decides which
 * values the checkout may submit and how the admin renders them.
 *
 * Этап 27B — Ukraine-first MANUAL checkout MVP. These are honest manual options:
 * NO real payment provider (LiqPay/Fondy/WayForPay) and NO carrier API
 * (Nova Poshta / Ukrposhta) is integrated here — payment is confirmed manually
 * and delivery is just the customer's chosen method + an optional free-text note.
 *
 * Pure + dependency-free: safe to import from the client checkout form, the
 * server action, and the verify script alike.
 */

/** Delivery method keys (Ukraine-first), sourced from the checkout <select>. */
export const DELIVERY_METHODS = ['self_pickup', 'nova_poshta', 'ukrposhta', 'local_courier'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

/**
 * Payment method keys — both MANUAL (no provider API):
 *   - cash_on_delivery — оплата при получении ("оплата при отриманні")
 *   - manual_online    — онлайн-оплата по реквизитам, подтверждается вручную
 */
export const PAYMENT_METHODS = ['cash_on_delivery', 'manual_online'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Human labels for admin + checkout display. */
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  self_pickup: 'Самовивіз',
  nova_poshta: 'Нова Пошта',
  ukrposhta: 'Укрпошта',
  local_courier: 'Курʼєрська доставка',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash_on_delivery: 'Оплата при отриманні',
  manual_online: 'Оплата за реквізитами',
}

/**
 * Display-only labels for PRE-27B values still stored on historical orders.
 * These are NOT selectable anymore — they only keep the admin readable.
 */
const LEGACY_DELIVERY_LABELS: Record<string, string> = {
  pickup: 'Самовывоз',
  courier: 'Курьер',
  post: 'Почта',
}
const LEGACY_PAYMENT_LABELS: Record<string, string> = {
  not_connected: 'Не подключена',
}

export function isAllowedDeliveryMethod(value: string): value is DeliveryMethod {
  return (DELIVERY_METHODS as readonly string[]).includes(value)
}

export function isAllowedPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Display label: current allowlist → legacy map → raw value (never throws). */
export function deliveryMethodLabel(value: string): string {
  if (isAllowedDeliveryMethod(value)) return DELIVERY_METHOD_LABELS[value]
  return LEGACY_DELIVERY_LABELS[value] ?? value
}

export function paymentMethodLabel(value: string): string {
  if (isAllowedPaymentMethod(value)) return PAYMENT_METHOD_LABELS[value]
  return LEGACY_PAYMENT_LABELS[value] ?? value
}
