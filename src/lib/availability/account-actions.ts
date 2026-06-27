'use server'

/**
 * AURELIA — Availability-interest account action (Этап 86A) — NO email, NO reservation
 *
 * Lets a logged-in customer withdraw ONE of their OWN email-based availability interests
 * from the account "Очікування товарів" section. The owner is ALWAYS re-derived from the
 * verified session — a client-supplied id is never trusted, and the cancel is hard-scoped to
 * the owner (another customer's id can never touch the row). It only sets the row to
 * `cancelled`: NO stock is reserved/held/released and NO email is ever sent.
 *
 * No admin audit entry is written — this mirrors the 69A product-interest cancel
 * (cancelProductInterestAction): it only withdraws a no-send waiting record, touches no
 * inventory, and exposes nothing about other customers.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentCustomer } from '../customer/session'
import { cancelMyAvailabilityInterest } from './account'

/**
 * Account-section cancel (progressive-enhancement <form action>). Reads the interest id from
 * the submitted form, cancels it (scoped to the owner), and revalidates the account page.
 */
export async function cancelAvailabilityInterestAction(formData: FormData): Promise<void> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return
  const id = formData.get('id')
  if (typeof id !== 'string') return
  try {
    await cancelMyAvailabilityInterest(customer.id, id)
    revalidatePath('/account')
  } catch {
    /* best-effort: a failed cancel just leaves the item; no user-facing error needed */
  }
}
