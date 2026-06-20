/**
 * AURELIA — Checkout copy shape & key mapping (Этап 46F)
 *
 * Pure, dependency-light module (no Prisma, no `server-only`) shared by the server
 * presenter (getCheckoutCopySettings) and the client checkout component (TYPE import
 * only). It maps the SiteSetting keys → a typed, method-keyed copy object so the
 * checkout UI never references raw setting-key strings.
 *
 * IMPORTANT: this is the editable PRESENTATION copy for the MANUAL payment/delivery
 * model. It does NOT change the method KEYS or the server allowlist
 * (src/lib/orders/methods.ts), and the defaults stay honest — no claim of online
 * acquiring or carrier-API integration.
 */

import {
  type PaymentMethod,
  type DeliveryMethod,
} from '../orders/methods'

export interface CheckoutCopy {
  /** Select-option titles per payment method key. */
  paymentTitles: Record<PaymentMethod, string>
  /** Note shown under the payment select, per selected payment method. */
  paymentDescriptions: Record<PaymentMethod, string>
  /** Select-option titles per delivery method key. */
  deliveryTitles: Record<DeliveryMethod, string>
  /** Small note under the submit button. */
  paymentNotice: string
  /** Note on the "Замовлення прийнято" confirmation / success page. */
  confirmationPaymentNotice: string
}

/**
 * Builds the typed copy object from a resolver that returns the effective value
 * for a setting key (DB value or static default). Keeping the key→field mapping
 * here (one place) lets the server presenter and any default builder share it.
 */
export function buildCheckoutCopy(resolve: (key: string) => string): CheckoutCopy {
  return {
    paymentTitles: {
      cash_on_delivery: resolve('checkout.payment.cashOnDeliveryTitle'),
      manual_online: resolve('checkout.payment.manualOnlineTitle'),
    },
    paymentDescriptions: {
      cash_on_delivery: resolve('checkout.payment.cashOnDeliveryDescription'),
      manual_online: resolve('checkout.payment.manualOnlineDescription'),
    },
    deliveryTitles: {
      self_pickup: resolve('checkout.delivery.selfPickupTitle'),
      nova_poshta: resolve('checkout.delivery.novaPoshtaTitle'),
      ukrposhta: resolve('checkout.delivery.ukrposhtaTitle'),
      local_courier: resolve('checkout.delivery.localCourierTitle'),
    },
    paymentNotice: resolve('checkout.payment.notice'),
    confirmationPaymentNotice: resolve('checkout.confirmation.paymentNotice'),
  }
}
