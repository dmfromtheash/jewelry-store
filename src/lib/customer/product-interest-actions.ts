'use server'

/**
 * AURELIA — Product-interest server actions (Этап 69A) — NO real notifications
 *
 * Add / cancel a logged-in customer's product interest ("повідомити, коли буде доступно").
 * The owner is ALWAYS re-derived from the verified session — a client id is never trusted, so
 * a customer can only ever touch their OWN interests. Guests CANNOT register interest (login
 * required) — there is no guest email-capture path in this stage.
 *
 * HONEST BY DESIGN: this records interest only. NOTHING is emailed and NO notification is ever
 * sent; the success copy must never promise a real message. A light durable throttle (51A
 * limiter, keyed by customer id) slows spam.
 */

import { revalidatePath } from 'next/cache'
import { recordProductInterestAdded } from '../analytics/record'
import { getCurrentCustomer } from './session'
import { isThrottled, registerAttempt, type ThrottleRule } from './rate-limit'
import { addProductInterestBySlug, cancelProductInterest } from './product-interest-repo'

export type ProductInterestResult =
  | { ok: true }
  | { ok: false; error: string; authenticated?: boolean }

const NOT_LOGGED_IN = 'Увійдіть, щоб стежити за наявністю.'
const THROTTLED = 'Забагато запитів. Зачекайте трохи й спробуйте знову.'
const PRODUCT_ERROR = 'Товар недоступний для відстеження.'
const SERVER_ERROR = 'Сталася помилка. Спробуйте ще раз.'

/** Max 20 interest writes per 10 min per customer (spam guard, not security). */
const INTEREST_THROTTLE: ThrottleRule = { windowMs: 10 * 60 * 1000, max: 20 }

/**
 * Registers interest in a product (by slug). Login required. Records interest ONLY — no email
 * is sent and no notification will ever be delivered (the UI copy says so).
 */
export async function addProductInterestAction(slug: string): Promise<ProductInterestResult> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false, error: NOT_LOGGED_IN, authenticated: false }

  const key = `product-interest:cust:${customer.id}`
  if (await isThrottled(key, INTEREST_THROTTLE)) return { ok: false, error: THROTTLED }

  try {
    const ok = await addProductInterestBySlug(customer.id, slug)
    await registerAttempt(key, INTEREST_THROTTLE)
    if (!ok) return { ok: false, error: PRODUCT_ERROR }
    // Anonymous analytics count (best-effort) — public slug only, never the customer id.
    await recordProductInterestAdded({ productSlug: slug })
    revalidatePath('/account')
    return { ok: true }
  } catch (e) {
    console.error('addProductInterestAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

/**
 * Account-section cancel (progressive-enhancement <form action>). Reads the interest id from
 * the submitted form, cancels it (scoped to the owner), and revalidates the account page.
 */
export async function cancelProductInterestAction(formData: FormData): Promise<void> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return
  const id = formData.get('id')
  if (typeof id !== 'string') return
  try {
    await cancelProductInterest(customer.id, id)
    revalidatePath('/account')
  } catch {
    /* best-effort: a failed cancel just leaves the item; no user-facing error needed */
  }
}
