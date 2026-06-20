'use server'

/**
 * AURELIA — Admin site-settings action (Этап 46C — Admin CMS foundation)
 *
 * Single server action that saves the v1 Site Settings. Mirrors the catalog
 * action pattern exactly: re-check the local admin guard (cannot run in
 * production) AND require a valid admin session, validate with the pure parser,
 * upsert by key, audit the change, then redirect with ?ok=/?err= so the page can
 * show a notice without any client JS.
 *
 * Safety: only ALLOWLISTED keys are ever written (the parser iterates the def
 * list, not the raw form). Values are plain text validated server-side. Metadata
 * (label/group/type) is code-owned and re-synced on every save. NO storefront
 * revalidation here — the storefront does not read settings until 46D, so only
 * the admin page is revalidated.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import { parseSiteSettingsForm } from './settings-form'

const SETTINGS_PATH = '/admin/settings'

/** Save the v1 site settings from the admin form. */
export async function updateSiteSettingsAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const parsed = parseSiteSettingsForm(formData)
  if (!parsed.ok) {
    redirect(`${SETTINGS_PATH}?err=${parsed.reason}&f=${encodeURIComponent(parsed.field)}`)
  }

  // Existing values → detect which keys actually changed (for a precise,
  // value-free audit summary). Read failure is non-fatal: treat as "all changed".
  const before = new Map<string, string>()
  try {
    const rows = await prisma.siteSetting.findMany({ select: { key: true, value: true } })
    for (const r of rows) before.set(r.key, r.value)
  } catch {
    // ignore — audit will simply report every submitted key as changed
  }

  const changedKeys: string[] = []
  for (const s of parsed.data) {
    if (before.get(s.key) !== s.value) changedKeys.push(s.key)
    // Upsert by unique key; metadata is code-owned and kept in sync on write.
    await prisma.siteSetting.upsert({
      where: { key: s.key },
      update: { value: s.value, label: s.label, group: s.group, type: s.type, isPublic: true },
      create: { key: s.key, value: s.value, label: s.label, group: s.group, type: s.type, isPublic: true },
    })
  }

  // Nothing changed → quiet no-op (no audit noise).
  if (changedKeys.length === 0) {
    revalidatePath(SETTINGS_PATH)
    redirect(`${SETTINGS_PATH}?ok=noop`)
  }

  const changedGroups = Array.from(
    new Set(parsed.data.filter((s) => changedKeys.includes(s.key)).map((s) => s.group)),
  )

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.settingsUpdated,
    entityType: 'site_settings',
    entityId: changedGroups.join(','),
    // Safe metadata ONLY — changed KEYS/count/groups, never the values.
    summary: `Обновлены настройки сайта (${changedKeys.length}): ${changedKeys.join(', ')}.`,
    metadata: { changedKeys, changedCount: changedKeys.length, groups: changedGroups },
  })

  revalidatePath(SETTINGS_PATH)
  redirect(`${SETTINGS_PATH}?ok=saved`)
}
