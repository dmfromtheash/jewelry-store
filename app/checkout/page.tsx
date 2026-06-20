/**
 * AURELIA — Checkout page (Этап 10A)
 *
 * Frontend-only order page. The interactive part (reads the cart, renders the
 * summary + contact/delivery/payment blocks) lives in CheckoutPageClient.
 * No backend, API, payment or order processing — demo only.
 */

import type { Metadata } from 'next'
import CheckoutPageClient from '../../src/components/checkout/CheckoutPageClient'
import { getCheckoutCopySettings } from '../../src/lib/site-settings/server'

export const metadata: Metadata = {
  title: 'Оформлення замовлення — AURELIA',
  description: 'Оформлення замовлення AURELIA.',
}

export default async function CheckoutPage() {
  // Эtап 46F: editable manual payment/delivery copy is resolved on the SERVER
  // (DB + static fallback) and handed to the client component as a plain prop —
  // no client-side settings fetch. Method keys/allowlist are unchanged.
  const copy = await getCheckoutCopySettings()
  return <CheckoutPageClient copy={copy} />
}
