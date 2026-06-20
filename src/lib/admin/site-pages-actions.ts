'use server'

/**
 * AURELIA — Admin info-page action (Этап 46E — Info Pages CMS)
 *
 * Saves one public info page. Mirrors the catalog/settings pattern: re-check the
 * local admin guard (cannot run in production) AND require a valid admin session,
 * validate with the pure parser (strict shape, length/count limits, no HTML),
 * upsert by the ALLOWLISTED slug, audit the change, revalidate the public route +
 * root layout, then redirect with ?ok=/?err= for a no-JS notice.
 *
 * Only the six known slugs are writable — an unknown/arbitrary slug is rejected,
 * so the CMS can never create new pages or a freeform page tree.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'
import { parseSitePageForm } from './site-pages-form'
import { isKnownPageSlug, getSitePageDef } from '../site-pages/defaults'

const CONTENT_PATH = '/admin/content'
const editPath = (slug: string) => `${CONTENT_PATH}/${slug}`

/** Update one info page from the admin form. */
export async function updateSitePageAction(formData: FormData) {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const slug = String(formData.get('slug') ?? '').trim()
  // Slug allowlist — never create arbitrary pages.
  if (!slug || !isKnownPageSlug(slug)) redirect(`${CONTENT_PATH}?err=slug`)

  const isPublished = String(formData.get('isPublished') ?? '') === 'on'

  const parsed = parseSitePageForm(formData)
  if (!parsed.ok) {
    redirect(`${editPath(slug)}?err=${parsed.reason}&f=${encodeURIComponent(parsed.field)}`)
  }

  const data = parsed.data
  // sections is validated, plain-text JSON (InfoSection[]).
  const sectionsJson = data.sections as unknown as Prisma.InputJsonValue

  await prisma.sitePage.upsert({
    where: { slug },
    update: {
      title: data.title,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      intro: data.intro ?? null,
      notice: data.notice ?? null,
      sections: sectionsJson,
      isPublished,
    },
    create: {
      slug,
      title: data.title,
      metaTitle: data.metaTitle,
      metaDescription: data.metaDescription,
      intro: data.intro ?? null,
      notice: data.notice ?? null,
      sections: sectionsJson,
      isPublished,
    },
  })

  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.pageUpdated,
    entityType: 'site_page',
    entityId: slug,
    // Safe metadata ONLY — slug + section count + published flag, never the body.
    summary: `Обновлена инфо-страница «${getSitePageDef(slug)?.label ?? slug}» (${data.sections.length} секц.).`,
    metadata: { slug, sectionCount: data.sections.length, isPublished },
  })

  // Revalidate the public page itself and the root layout (Header/Footer links).
  revalidatePath(`/${slug}`)
  revalidatePath('/', 'layout')
  revalidatePath(editPath(slug))
  redirect(`${editPath(slug)}?ok=saved`)
}
