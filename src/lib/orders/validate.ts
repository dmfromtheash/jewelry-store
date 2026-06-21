/**
 * AURELIA — Order draft validation (Этап 16A)
 *
 * Pure, dependency-free field validation. Used by the server action as the
 * authoritative check, and reused by the checkout form for instant UX feedback
 * (no duplicated rules). Validates only the customer fields + cart presence;
 * product prices/availability are validated server-side against the DB.
 */

import {
  DELIVERY_DETAILS_MAX,
  DELIVERY_BRANCH_MAX,
  DELIVERY_COMMENT_MAX,
  type OrderDraftInput,
  type OrderFieldErrors,
} from './types'
import { isAllowedDeliveryMethod, isAllowedPaymentMethod } from './methods'
import { hasUnsafeMarkup } from '../customer/validate'

/** Lenient phone check: 10–18 chars, digits plus + ( ) - and spaces. */
const PHONE_RE = /^[+\d][\d\s()-]{8,17}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOrderDraftFields(input: OrderDraftInput): OrderFieldErrors {
  const errors: OrderFieldErrors = {}

  const name = input.customerName?.trim() ?? ''
  if (name.length < 2) errors.customerName = 'Вкажіть імʼя (мінімум 2 символи).'
  else if (name.length > 80) errors.customerName = 'Імʼя задовге.'

  const phone = input.customerPhone?.trim() ?? ''
  if (!phone) errors.customerPhone = 'Вкажіть телефон.'
  else if (!PHONE_RE.test(phone)) errors.customerPhone = 'Перевірте формат телефону.'

  // Email is optional, but if provided it must look valid.
  const email = input.customerEmail?.trim() ?? ''
  if (email && !EMAIL_RE.test(email)) errors.customerEmail = 'Перевірте формат e-mail.'

  const city = input.deliveryCity?.trim() ?? ''
  if (city.length < 2) errors.deliveryCity = 'Вкажіть місто доставки.'
  else if (city.length > 80) errors.deliveryCity = 'Назва міста задовга.'

  // Method allowlists: only values offered by the current checkout are accepted,
  // so a tampered payload can't write an unknown delivery/payment method.
  const deliveryMethod = input.deliveryMethod?.trim() ?? ''
  if (!isAllowedDeliveryMethod(deliveryMethod)) {
    errors.deliveryMethod = 'Оберіть доступний спосіб доставки.'
  }

  const paymentMethod = input.paymentMethod?.trim() ?? ''
  if (!isAllowedPaymentMethod(paymentMethod)) {
    errors.paymentMethod = 'Цей спосіб оплати зараз недоступний.'
  }

  // Delivery note is optional; constrained by length AND a no-markup rule so a
  // tampered payload can't smuggle HTML/script into a stored/displayed field.
  const deliveryDetails = input.deliveryDetails?.trim() ?? ''
  if (deliveryDetails.length > DELIVERY_DETAILS_MAX) {
    errors.deliveryDetails = 'Коментар до доставки задовгий.'
  } else if (deliveryDetails && hasUnsafeMarkup(deliveryDetails)) {
    errors.deliveryDetails = 'Коментар містить недопустимі символи.'
  }

  // Manual branch/department (Этап 59A): optional plain text — length-capped, no markup.
  // This is the customer's typed branch only — never a carrier API / live lookup.
  const deliveryBranch = input.deliveryBranch?.trim() ?? ''
  if (deliveryBranch.length > DELIVERY_BRANCH_MAX) {
    errors.deliveryBranch = 'Назва відділення задовга.'
  } else if (deliveryBranch && hasUnsafeMarkup(deliveryBranch)) {
    errors.deliveryBranch = 'Відділення містить недопустимі символи.'
  }

  // Separate delivery comment (Этап 59A): optional plain text — length-capped, no markup.
  const deliveryComment = input.deliveryComment?.trim() ?? ''
  if (deliveryComment.length > DELIVERY_COMMENT_MAX) {
    errors.deliveryComment = 'Коментар задовгий.'
  } else if (deliveryComment && hasUnsafeMarkup(deliveryComment)) {
    errors.deliveryComment = 'Коментар містить недопустимі символи.'
  }

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'Кошик порожній.'
  }

  return errors
}

export function hasErrors(errors: OrderFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
