/**
 * AURELIA — Inventory stock-health policy + manual-adjustment validation (Этап 70A)
 *
 * Pure + dependency-free (no Prisma, no `server-only`, no React), so the SAME rules are shared by
 * the server data layer, the manual-adjustment action, AND the verify script (run under tsx) —
 * mirroring the availability.ts / transitions.ts pattern.
 *
 * This module owns two things:
 *   1. Stock-health classification of a single `stockQuantity` value (null/0/low/healthy/negative).
 *   2. Validation of a manual stock adjustment (absolute "set" or signed "delta"), enforcing
 *      integer-only, no-NaN, no-negative-final, and a safe note (length-capped, markup-stripped).
 *
 * It is deliberately NOT a warehouse/supplier/procurement model: it only describes + safely
 * changes the existing per-product / per-variant `stockQuantity` field.
 */

/**
 * Default low-stock threshold (Этап 70A). A TRACKED level with 1..LOW_STOCK_THRESHOLD units is
 * "low". This is a single global default — there are NO per-product thresholds (do not pretend
 * otherwise). Documented in docs/sale/FEATURES_AND_LIMITS.md.
 */
export const LOW_STOCK_THRESHOLD = 5

/** Health state of one stock level. */
export type StockState = 'untracked' | 'out' | 'low' | 'healthy' | 'negative'

/**
 * Classifies a single `stockQuantity` value (Этап 70A):
 *   - `null`/`undefined` → `untracked` (28B: not tracked, stays purchasable on status+price);
 *   - `< 0`              → `negative` (data anomaly — should never happen; surfaced so the owner
 *                          can correct it. The order paths can never produce this);
 *   - `0`                → `out`;
 *   - `1..threshold`     → `low`;
 *   - `> threshold`      → `healthy`.
 */
export function classifyStock(
  stockQuantity: number | null | undefined,
  threshold: number = LOW_STOCK_THRESHOLD,
): StockState {
  if (stockQuantity == null) return 'untracked'
  if (!Number.isFinite(stockQuantity) || stockQuantity < 0) return 'negative'
  if (stockQuantity === 0) return 'out'
  if (stockQuantity <= threshold) return 'low'
  return 'healthy'
}

/** True for a state the owner should look at (zero / low / negative). */
export function isAttentionState(state: StockState): boolean {
  return state === 'out' || state === 'low' || state === 'negative'
}

// ─────────────────────────────────────────────────────────────────────────────
// Manual stock adjustment validation
// ─────────────────────────────────────────────────────────────────────────────

/** How a manual adjustment is expressed. */
export type AdjustMode = 'set' | 'delta'

/** Max length of an optional adjustment note (plain text). */
export const ADJUSTMENT_NOTE_MAX = 200

/** Upper safety bound for any stock quantity an admin can set (defensive — not a business limit). */
export const STOCK_MAX = 1_000_000

/** Validation error codes — surfaced to the inventory page via the ?err= query param. */
export type AdjustErrorCode =
  | 'target' // missing/invalid target (product/variant id or level)
  | 'mode' // mode not 'set' | 'delta'
  | 'value' // value missing / not an integer / NaN / out of bounds
  | 'untracked' // a delta was requested against an untracked (null) level
  | 'negative' // the resulting stock would be negative
  | 'noop' // the change resolves to no change (delta 0 / set == current)
  | 'note' // note too long or contains markup

export interface ParsedAdjustment {
  mode: AdjustMode
  /** The signed change to apply (negative = decrement, positive = increment). Never zero. */
  delta: number
  /** The resulting stock value (always a non-negative integer). */
  newValue: number
  note: string | null
}

export type ParseAdjustmentResult =
  | { ok: true; data: ParsedAdjustment }
  | { ok: false; error: AdjustErrorCode }

/** Returns the mode when valid, else null. */
export function parseAdjustMode(raw: string): AdjustMode | null {
  return raw === 'set' || raw === 'delta' ? raw : null
}

/**
 * Validates + normalises an optional adjustment note (Этап 70A): trims, enforces the length cap,
 * and REJECTS any angle-bracket markup so a `<script>`/HTML payload can never be stored. Empty →
 * null. Returns 'invalid' on a too-long or markup-bearing note.
 */
export function parseAdjustmentNote(raw: string | null | undefined): { value: string | null } | 'invalid' {
  const v = (raw ?? '').trim()
  if (v.length === 0) return { value: null }
  if (v.length > ADJUSTMENT_NOTE_MAX) return 'invalid'
  if (/[<>]/.test(v)) return 'invalid'
  return { value: v }
}

/** Parses a raw integer string (no decimals, optional leading sign for delta). */
function parseIntStrict(raw: string, allowSign: boolean): number | null {
  const cleaned = raw.replace(/\s/g, '')
  if (cleaned.length === 0) return null
  const re = allowSign ? /^[+-]?\d+$/ : /^\d+$/
  if (!re.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isInteger(n)) return null
  return n
}

/**
 * Validates a manual stock adjustment against the CURRENT level value (Этап 70A).
 *
 *   - `current` is the level's existing `stockQuantity` (null = untracked).
 *   - mode `set`:   `value` is the absolute new quantity (>= 0 integer, <= STOCK_MAX). Allowed even
 *                   when `current` is null (starts tracking the level). The final value is `value`.
 *   - mode `delta`: `value` is a signed change applied to `current`. REJECTED when `current` is
 *                   null (you cannot add to an untracked level — set an absolute value first).
 *
 * The resulting stock must be a non-negative integer (no backorder/negative stock by default) and
 * within STOCK_MAX. A change that resolves to no net change is rejected as `noop`.
 *
 * This NEVER sets a level back to null (untracking stays in the catalog edit form), so it cannot
 * change which level is the decrement source — it only edits the same field, safely + audited.
 */
export function parseAdjustment(args: {
  mode: string
  rawValue: string
  current: number | null
  rawNote?: string | null
}): ParseAdjustmentResult {
  const mode = parseAdjustMode(args.mode)
  if (!mode) return { ok: false, error: 'mode' }

  const parsedNote = parseAdjustmentNote(args.rawNote)
  if (parsedNote === 'invalid') return { ok: false, error: 'note' }

  let newValue: number
  let delta: number

  if (mode === 'set') {
    const value = parseIntStrict(args.rawValue, false)
    if (value == null || value < 0 || value > STOCK_MAX) return { ok: false, error: 'value' }
    newValue = value
    // From an untracked level, "before" is treated as 0 for the recorded delta.
    delta = value - (args.current ?? 0)
  } else {
    // delta mode
    if (args.current == null) return { ok: false, error: 'untracked' }
    const change = parseIntStrict(args.rawValue, true)
    if (change == null || change > STOCK_MAX || change < -STOCK_MAX) return { ok: false, error: 'value' }
    newValue = args.current + change
    if (newValue < 0) return { ok: false, error: 'negative' }
    if (newValue > STOCK_MAX) return { ok: false, error: 'value' }
    delta = change
  }

  if (delta === 0) return { ok: false, error: 'noop' }
  if (newValue < 0) return { ok: false, error: 'negative' }

  return { ok: true, data: { mode, delta, newValue, note: parsedNote.value } }
}
