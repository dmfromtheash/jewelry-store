/**
 * AURELIA — Order method allowlists (Этап 26B)
 *
 * Single source of truth for the free-text `deliveryMethod` / `paymentMethod`
 * columns. The schema stores these as plain strings today; until they become
 * structured (see docs/ORDER_LIFECYCLE_SPEC.md §7/§10 and DELIVERY_SPEC.md) this
 * module decides which values the checkout may submit and how the admin renders
 * them. Values are taken ONLY from the current checkout UI — no new carriers or
 * payment providers are invented here, and no real logistics/payment is added.
 *
 * Pure + dependency-free: safe to import from the client checkout form, the
 * server action, and the verify script alike.
 */

/** Delivery method keys, sourced from the current checkout <select> options. */
export const DELIVERY_METHODS = ['pickup', 'courier', 'post'] as const
export type DeliveryMethod = (typeof DELIVERY_METHODS)[number]

/**
 * Payment is not connected yet (Этап 16A placeholder). `not_connected` is the
 * ONLY legitimate value until a real provider is integrated (Payments SPEC).
 */
export const PAYMENT_METHODS = ['not_connected'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Human labels for admin display (the checkout shows its own "— скоро" copy). */
export const DELIVERY_METHOD_LABELS: Record<DeliveryMethod, string> = {
  pickup: 'Самовывоз',
  courier: 'Курьер',
  post: 'Почта',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  not_connected: 'Не подключена',
}

export function isAllowedDeliveryMethod(value: string): value is DeliveryMethod {
  return (DELIVERY_METHODS as readonly string[]).includes(value)
}

export function isAllowedPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value)
}

/** Display label with a safe fallback to the raw value (e.g. legacy rows). */
export function deliveryMethodLabel(value: string): string {
  return isAllowedDeliveryMethod(value) ? DELIVERY_METHOD_LABELS[value] : value
}

export function paymentMethodLabel(value: string): string {
  return isAllowedPaymentMethod(value) ? PAYMENT_METHOD_LABELS[value] : value
}
