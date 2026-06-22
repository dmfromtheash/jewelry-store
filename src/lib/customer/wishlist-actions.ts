'use server'

/**
 * AURELIA — Server-side wishlist actions (Этап 62A)
 *
 * Server actions for the logged-in customer's persistent wishlist. Called from the
 * client favourites store (which keeps working for guests, localStorage-only) and from
 * the account wishlist section.
 *
 * Security:
 *   - the owner is ALWAYS re-derived from the verified session (getCurrentCustomer) —
 *     a client-supplied customer id is never trusted, so a customer can only ever touch
 *     their OWN wishlist;
 *   - slugs are validated + resolved to a PUBLISHED product server-side (see the repo),
 *     so hidden/unknown products are never stored or surfaced;
 *   - every read/write fails closed: a logged-out caller gets `authenticated:false` /
 *     `ok:false` and the storefront silently stays on its guest (localStorage) behaviour.
 *
 * No audit events are emitted here: a wishlist toggle is a low-risk, high-frequency
 * personalization action (not a security/account-state change), so logging it would only
 * add noise to the admin audit trail — consistent with the "do not overdo it" guidance.
 */

import { revalidatePath } from 'next/cache'
import { getCurrentCustomer } from './session'
import {
  addManyWishlistBySlug,
  addWishlistBySlug,
  clearWishlist,
  getWishlistSlugs,
  removeWishlistBySlug,
} from './wishlist-repo'

/** Loads the current customer's server wishlist (published slugs). Returns
 *  `authenticated:false` for guests so the client store stays localStorage-only. */
export async function loadServerFavoritesAction(): Promise<{
  authenticated: boolean
  slugs: string[]
}> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { authenticated: false, slugs: [] }
  try {
    return { authenticated: true, slugs: await getWishlistSlugs(customer.id) }
  } catch {
    return { authenticated: true, slugs: [] }
  }
}

/** Persists a single add for the logged-in customer (best-effort; no-op for guests). */
export async function addFavoriteAction(slug: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false }
  try {
    return { ok: await addWishlistBySlug(customer.id, slug) }
  } catch {
    return { ok: false }
  }
}

/** Persists a single removal for the logged-in customer (best-effort; no-op for guests). */
export async function removeFavoriteAction(slug: string): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false }
  try {
    return { ok: await removeWishlistBySlug(customer.id, slug) }
  } catch {
    return { ok: false }
  }
}

/**
 * One-time merge of the guest localStorage favourites into the server wishlist right
 * after login. Idempotent + capped in the repo. Returns the merged server slug set so the
 * client can reconcile its state.
 */
export async function syncFavoritesAction(slugs: string[]): Promise<{
  ok: boolean
  slugs: string[]
}> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false, slugs: [] }
  try {
    await addManyWishlistBySlug(customer.id, Array.isArray(slugs) ? slugs : [])
    return { ok: true, slugs: await getWishlistSlugs(customer.id) }
  } catch {
    return { ok: false, slugs: [] }
  }
}

/** Clears the logged-in customer's server wishlist (mirrors "clear favourites"). */
export async function clearServerFavoritesAction(): Promise<{ ok: boolean }> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return { ok: false }
  try {
    await clearWishlist(customer.id)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/**
 * Account-section remove (progressive-enhancement <form action>). Reads the slug from the
 * submitted form, removes it, and revalidates the account page so the list refreshes.
 */
export async function removeAccountFavoriteAction(formData: FormData): Promise<void> {
  const customer = await getCurrentCustomer().catch(() => null)
  if (!customer) return
  const slug = formData.get('slug')
  if (typeof slug !== 'string') return
  try {
    await removeWishlistBySlug(customer.id, slug)
    revalidatePath('/account')
  } catch {
    /* best-effort: a failed remove just leaves the item; no user-facing error needed */
  }
}
