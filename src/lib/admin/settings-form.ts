/**
 * AURELIA — Admin site-settings form parsing/validation (Этап 46C) — server-only
 *
 * Pure helpers for the admin Site Settings form. Kept out of settings-actions.ts
 * (which is `'use server'` and may only export async actions). No Prisma here —
 * just FormData → a validated, normalized list the action can upsert.
 *
 * Hard safety rules (CMS is for PUBLIC plain-text business copy only):
 *   - KEY ALLOWLIST: only keys in SITE_SETTING_DEFS are read; arbitrary/unknown
 *     form keys are ignored — the CMS can never create new keys.
 *   - NO MARKUP: reject `<` / `>` and `javascript:` / `data:` payloads everywhere.
 *   - Per-type checks: length limits, email format, https-only URLs, safe phone.
 *   - Empty allowed only for fields flagged `optional`.
 */

import 'server-only'

import {
  SITE_SETTING_DEFS,
  type SiteSettingDef,
  type SiteSettingGroup,
  type SiteSettingType,
} from '../site-settings/defaults'

/** Why a field failed validation (surfaced to the form via ?err=). */
export type SettingsFormReason = 'required' | 'length' | 'email' | 'url' | 'phone' | 'html'

/** One validated, persistable setting (metadata is code-owned, not user input). */
export interface ParsedSetting {
  key: string
  label: string
  group: SiteSettingGroup
  type: SiteSettingType
  value: string
}

export type ParseSettingsResult =
  | { ok: true; data: ParsedSetting[] }
  | { ok: false; reason: SettingsFormReason; field: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[0-9+\-()\s]+$/

/** True when the value carries markup or a dangerous URL scheme. */
function hasUnsafeMarkup(value: string): boolean {
  if (/[<>]/.test(value)) return true
  return /(?:javascript|data)\s*:/i.test(value)
}

/** Validates a single field's already-trimmed value against its definition. */
function validateValue(def: SiteSettingDef, value: string): SettingsFormReason | null {
  if (value.length === 0) {
    return def.optional ? null : 'required'
  }
  if (value.length > def.maxLength) return 'length'
  // Plain text only — no field accepts HTML or javascript:/data: URLs.
  if (hasUnsafeMarkup(value)) return 'html'

  switch (def.type) {
    case 'email':
      return EMAIL_RE.test(value) ? null : 'email'
    case 'phone':
      return PHONE_RE.test(value) ? null : 'phone'
    case 'url': {
      // Social links must be explicit https:// URLs with a real host.
      if (!value.startsWith('https://')) return 'url'
      try {
        const u = new URL(value)
        if (u.protocol !== 'https:' || !u.hostname.includes('.')) return 'url'
      } catch {
        return 'url'
      }
      return null
    }
    case 'text':
    case 'long_text':
      return null
  }
}

/**
 * Parses + validates the whole settings form. Iterates the ALLOWLIST (never the
 * raw FormData keys), so unknown keys are silently ignored and no arbitrary
 * setting can be created. Returns the first failure, or all normalized values.
 */
export function parseSiteSettingsForm(formData: FormData): ParseSettingsResult {
  const data: ParsedSetting[] = []

  for (const def of SITE_SETTING_DEFS) {
    const value = String(formData.get(def.key) ?? '').trim()
    const reason = validateValue(def, value)
    if (reason) return { ok: false, reason, field: def.key }
    data.push({ key: def.key, label: def.label, group: def.group, type: def.type, value })
  }

  return { ok: true, data }
}
