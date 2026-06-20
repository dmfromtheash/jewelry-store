/**
 * AURELIA — Site settings server read helper (Этап 46C) — server-only
 *
 * Loads the persisted SiteSetting rows and merges them over the code defaults so
 * a caller always gets a complete, typed value for every allowlisted key (a
 * missing/empty row falls back to its static default).
 *
 * SCOPE (46C): used by the ADMIN settings form only. The STOREFRONT does NOT call
 * this yet — header/footer/contact integration is the separate 46D stage. The
 * merge-with-fallback shape is built now so 46D can adopt it without re-plumbing.
 */

import 'server-only'

import { prisma } from '../db/prisma'
import {
  SITE_SETTING_DEFS,
  type SiteSettingDef,
  type SiteSettingGroup,
  type SiteSettingType,
} from './defaults'

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

/** Effective value for one def given the stored map (default when absent). */
function effectiveValue(def: SiteSettingDef, stored: Map<string, string>): string {
  const v = stored.get(def.key)
  return v != null ? v : def.defaultValue
}

/**
 * Returns every allowlisted setting with its effective value, in the fixed
 * SITE_SETTING_DEFS order. Read-only; never throws into the caller (a DB failure
 * surfaces as all-defaults so the admin form still renders).
 */
export async function getSiteSettingsForAdmin(): Promise<SiteSettingView[]> {
  const stored = new Map<string, string>()
  try {
    const rows = await prisma.siteSetting.findMany({ select: { key: true, value: true } })
    for (const r of rows) stored.set(r.key, r.value)
  } catch (err) {
    console.error(
      `[site-settings] read failed, using defaults: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  return SITE_SETTING_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    group: def.group,
    type: def.type,
    value: effectiveValue(def, stored),
    hint: def.hint,
    maxLength: def.maxLength,
    optional: def.optional,
  }))
}
