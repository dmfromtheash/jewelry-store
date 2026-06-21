/**
 * AURELIA — Manual delivery details helper (Этап 59A)
 *
 * A small, future-ready type + helpers for the MANUAL delivery branch/department
 * fields. There is NO carrier integration here: AURELIA does NOT call the Nova Poshta
 * / Ukrposhta APIs, does NOT fetch live branches, does NOT create a TTN / tracking
 * number, and does NOT compute carrier price. These are just the customer's typed
 * choices — a method key, a city, an optional branch/department, and free-text notes.
 *
 * When a real carrier integration is added (owner-gated — see docs/DELIVERY_SPEC.md),
 * the branch field becomes the natural slot for a selected warehouse id; until then it
 * is plain text. Pure + dependency-free (safe on client + server + verify alike).
 */

import { isAllowedDeliveryMethod } from './methods'

/** The manual delivery fields stored on an Order. */
export interface ManualDeliveryDetails {
  city: string
  method: string
  /** Branch / department / warehouse text (manual, no carrier lookup). */
  branch?: string | null
  /** Legacy free-text note (kept for backward compatibility). */
  details?: string | null
  /** Separate delivery comment. */
  comment?: string | null
}

/**
 * Whether a method typically uses a branch/department field. This is ONLY a UI hint
 * for the manual flow (which field to emphasise) — never a carrier call. Unknown/
 * legacy methods default to false.
 */
export function methodUsesBranch(method: string): boolean {
  if (!isAllowedDeliveryMethod(method)) return false
  return method === 'nova_poshta' || method === 'ukrposhta'
}
