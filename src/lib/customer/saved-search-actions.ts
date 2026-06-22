'use server'

/**
 * AURELIA — Saved-search server actions (Этап 69A)
 *
 * Create / remove a logged-in customer's saved catalog searches. The owner is ALWAYS
 * re-derived from the verified session (getCurrentCustomer) — a client-supplied id is never
 * trusted, so a customer can only ever touch their OWN saved searches. All input is validated
 * server-side (src/lib/customer/saved-search.ts); only clean fields are stored (never a URL).
 *
 * A light durable throttle (reusing the 51A limiter, keyed by customer id) slows save spam.
 * No email/notification is involved — a saved search is a convenience bookmark only.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentCustomer } from './session'
import { isThrottled, registerAttempt, type ThrottleRule } from './rate-limit'
import { validateSavedSearchInput, type SavedSearchInputRaw } from './saved-search'
import { createSavedSearch, removeSavedSearch } from './saved-search-repo'

export type SavedSearchActionResult =
  | { ok: true }
  | { ok: false; error: string; authenticated?: boolean }

const NOT_LOGGED_IN = 'Увійдіть, щоб зберігати пошуки.'
const THROTTLED = 'Забагато збережень. Зачекайте трохи й спробуйте знову.'
const LIMIT_REACHED = 'Досягнуто ліміту збережених пошуків. Видаліть якийсь, щоб додати новий.'
const INVALID = 'Не вдалося зберегти пошук. Перевірте параметри.'
const SERVER_ERROR = 'Сталася помилка. Спробуйте ще раз.'

/** Max 10 saved-search writes per 10 min per customer (spam guard, not security). */
const SAVE_THROTTLE: ThrottleRule = { windowMs: 10 * 60 * 1000, max: 10 }

/** Creates a saved search from the current catalog filter params. Login required. */
export async function createSavedSearchAction(
  input: SavedSearchInputRaw,
): Promise<SavedSearchActionResult> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false, error: NOT_LOGGED_IN, authenticated: false }

  const key = `saved-search:cust:${customer.id}`
  if (await isThrottled(key, SAVE_THROTTLE)) return { ok: false, error: THROTTLED }

  const { value } = validateSavedSearchInput(input ?? {})
  if (!value) {
    await registerAttempt(key, SAVE_THROTTLE)
    return { ok: false, error: INVALID }
  }

  try {
    const result = await createSavedSearch(customer.id, value)
    await registerAttempt(key, SAVE_THROTTLE)
    if (result === 'limit_reached') return { ok: false, error: LIMIT_REACHED }
    revalidatePath('/account')
    return { ok: true }
  } catch (e) {
    console.error('createSavedSearchAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: SERVER_ERROR }
  }
}

/**
 * Account-section remove (progressive-enhancement <form action>). Reads the id from the
 * submitted form, removes it (scoped to the owner), and revalidates the account page.
 */
export async function removeSavedSearchAction(formData: FormData): Promise<void> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return
  const id = formData.get('id')
  if (typeof id !== 'string') return
  try {
    await removeSavedSearch(customer.id, id)
    revalidatePath('/account')
  } catch {
    /* best-effort: a failed remove just leaves the item; no user-facing error needed */
  }
}
