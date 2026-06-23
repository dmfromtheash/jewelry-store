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
import { getCurrentCustomer } from '../../src/lib/customer/session'

// Transactional page — not indexable (Этап 72A; also disallowed in robots.txt).
export const metadata: Metadata = {
  title: 'Оформлення замовлення — AURELIA',
  description: 'Оформлення замовлення AURELIA.',
  robots: { index: false, follow: false },
}

export default async function CheckoutPage() {
  // Эtап 46F: editable manual payment/delivery copy is resolved on the SERVER
  // (DB + static fallback) and handed to the client component as a plain prop —
  // no client-side settings fetch. Method keys/allowlist are unchanged.
  const copy = await getCheckoutCopySettings()

  // Этап 47A: when a customer is logged in, prefill the contact fields from their
  // saved profile (safe display data only). Guests get empty fields and the flow
  // is unchanged. The order's customerId is attached server-side in the action —
  // this prop is purely a UX convenience and is never trusted for ownership.
  const customer = await getCurrentCustomer()
  const initialContact = customer
    ? { name: customer.name ?? '', phone: customer.phone ?? '', email: customer.email ?? '' }
    : null

  return <CheckoutPageClient copy={copy} initialContact={initialContact} />
}
