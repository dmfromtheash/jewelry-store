/**
 * AURELIA — Checkout page (Этап 10A)
 *
 * Frontend-only order page. The interactive part (reads the cart, renders the
 * summary + contact/delivery/payment blocks) lives in CheckoutPageClient.
 * No backend, API, payment or order processing — demo only.
 */

import type { Metadata } from 'next'
import CheckoutPageClient from '../../src/components/checkout/CheckoutPageClient'

export const metadata: Metadata = {
  title: 'Оформлення замовлення — AURELIA',
  description: 'Оформлення замовлення AURELIA.',
}

export default function CheckoutPage() {
  return <CheckoutPageClient />
}
