/**
 * AURELIA — Order draft validation (Этап 16A)
 *
 * Pure, dependency-free field validation. Used by the server action as the
 * authoritative check, and reused by the checkout form for instant UX feedback
 * (no duplicated rules). Validates only the customer fields + cart presence;
 * product prices/availability are validated server-side against the DB.
 */

import type { OrderDraftInput, OrderFieldErrors } from './types'

/** Lenient phone check: 10–18 chars, digits plus + ( ) - and spaces. */
const PHONE_RE = /^[+\d][\d\s()-]{8,17}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateOrderDraftFields(input: OrderDraftInput): OrderFieldErrors {
  const errors: OrderFieldErrors = {}

  const name = input.customerName?.trim() ?? ''
  if (name.length < 2) errors.customerName = 'Укажите имя (минимум 2 символа).'
  else if (name.length > 80) errors.customerName = 'Имя слишком длинное.'

  const phone = input.customerPhone?.trim() ?? ''
  if (!phone) errors.customerPhone = 'Укажите телефон.'
  else if (!PHONE_RE.test(phone)) errors.customerPhone = 'Проверьте формат телефона.'

  // Email is optional, but if provided it must look valid.
  const email = input.customerEmail?.trim() ?? ''
  if (email && !EMAIL_RE.test(email)) errors.customerEmail = 'Проверьте формат e-mail.'

  const city = input.deliveryCity?.trim() ?? ''
  if (city.length < 2) errors.deliveryCity = 'Укажите город доставки.'
  else if (city.length > 80) errors.deliveryCity = 'Название города слишком длинное.'

  if (!Array.isArray(input.items) || input.items.length === 0) {
    errors.items = 'Корзина пуста.'
  }

  return errors
}

export function hasErrors(errors: OrderFieldErrors): boolean {
  return Object.keys(errors).length > 0
}
