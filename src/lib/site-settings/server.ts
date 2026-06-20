/**
 * AURELIA — Site settings server read helpers (Этап 46C → 46D) — server-only
 *
 * Loads persisted SiteSetting rows and merges them over the code defaults so a
 * caller always gets a complete, typed value for every allowlisted key.
 *
 *   - getSiteSettingsForAdmin() (46C): full list for the admin editor; shows the
 *     EXACT stored value (empty stays empty so the admin sees what is saved).
 *   - getPublicSiteSettings() (46D): a compact, typed object for PUBLIC storefront
 *     surfaces (Header/Footer). PUBLIC rows only; an empty value falls back to the
 *     code default so a locked layout never renders an empty brand/footer slot.
 *
 * Both NEVER throw into the caller — a DB failure surfaces as all-defaults, so the
 * storefront and admin keep rendering. The row read is deduped per request via
 * React cache() (Header and Footer both call it on the same page).
 */

import 'server-only'

import { cache } from 'react'
import { prisma } from '../db/prisma'
import {
  SITE_SETTING_DEFS,
  getSiteSettingDef,
  type SiteSettingDef,
  type SiteSettingGroup,
  type SiteSettingType,
} from './defaults'
import { buildCheckoutCopy, type CheckoutCopy } from './checkout-copy'

interface StoredRow {
  key: string
  value: string
  isPublic: boolean
}

/**
 * Reads the raw SiteSetting rows once per request (deduped). Read-only and
 * failure-safe: any error logs (without secrets) and yields an empty set, so
 * callers fall back to code defaults.
 */
const loadStoredRows = cache(async (): Promise<StoredRow[]> => {
  try {
    return await prisma.siteSetting.findMany({ select: { key: true, value: true, isPublic: true } })
  } catch (err) {
    console.error(
      `[site-settings] read failed, using defaults: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
    return []
  }
})

// ── Admin view (46C) ──────────────────────────────────────────────────────────

export interface SiteSettingView {
  key: string
  label: string
  group: SiteSettingGroup
  type: SiteSettingType
  /** Effective value: the stored row's value, or the static default. */
  value: string
  hint?: string
  maxLength: number
  optional: boolean
}

/** Admin effective value: stored value when a row exists (even ''), else default. */
function adminValue(def: SiteSettingDef, stored: Map<string, string>): string {
  const v = stored.get(def.key)
  return v != null ? v : def.defaultValue
}

/**
 * Returns every allowlisted setting with its effective value, in the fixed
 * SITE_SETTING_DEFS order. Used by the admin editor only.
 */
export async function getSiteSettingsForAdmin(): Promise<SiteSettingView[]> {
  const rows = await loadStoredRows()
  const stored = new Map<string, string>(rows.map((r) => [r.key, r.value]))

  return SITE_SETTING_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    group: def.group,
    type: def.type,
    value: adminValue(def, stored),
    hint: def.hint,
    maxLength: def.maxLength,
    optional: def.optional,
  }))
}

// ── Public view (46D) ─────────────────────────────────────────────────────────

/** Compact, typed settings object for public storefront surfaces. */
export interface PublicSiteSettings {
  brandDisplayName: string
  brandTagline: string
  footerBlurb: string
  footerCopyright: string
  contactPhone: string
  contactEmail: string
  contactAddress: string
  contactHours: string
  socialInstagram: string
  socialFacebook: string
  socialTelegram: string
}

/**
 * Public effective value for a key: the PUBLIC stored value when it is present
 * AND non-empty, otherwise the code default. (Non-public or empty rows fall back
 * to the default, so a locked layout never shows an empty brand/footer slot.)
 * Optional contact/social fields default to '' — the component decides whether to
 * render them, and never invents a fake value.
 */
function publicValue(key: string, publicStored: Map<string, string>): string {
  const stored = publicStored.get(key)
  if (stored != null && stored.length > 0) return stored
  return getSiteSettingDef(key)?.defaultValue ?? ''
}

/**
 * Loads the v1 public settings as a typed object. PUBLIC rows only; always
 * complete via default fallback; never throws (DB failure → all defaults).
 */
export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const rows = await loadStoredRows()
  const publicStored = new Map<string, string>(
    rows.filter((r) => r.isPublic).map((r) => [r.key, r.value]),
  )
  const v = (key: string) => publicValue(key, publicStored)

  return {
    brandDisplayName: v('brand.displayName'),
    brandTagline: v('brand.tagline'),
    footerBlurb: v('footer.blurb'),
    footerCopyright: v('footer.copyright'),
    contactPhone: v('contact.phone'),
    contactEmail: v('contact.email'),
    contactAddress: v('contact.address'),
    contactHours: v('contact.hours'),
    socialInstagram: v('social.instagram'),
    socialFacebook: v('social.facebook'),
    socialTelegram: v('social.telegram'),
  }
}

/**
 * Loads the editable checkout/manual payment & delivery copy (Этап 46F) as a typed,
 * method-keyed object. PUBLIC rows only; empty → static default; never throws.
 * Method KEYS and the server allowlist are untouched — this is presentation copy.
 */
export async function getCheckoutCopySettings(): Promise<CheckoutCopy> {
  const rows = await loadStoredRows()
  const publicStored = new Map<string, string>(
    rows.filter((r) => r.isPublic).map((r) => [r.key, r.value]),
  )
  return buildCheckoutCopy((key) => publicValue(key, publicStored))
}
