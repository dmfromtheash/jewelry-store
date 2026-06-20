/**
 * AURELIA — Info-page CMS server read helpers (Этап 46E) — server-only
 *
 *   - getInfoPageForPublic(slug): the PUBLIC loader. Returns a DB-backed InfoPage
 *     when a published, VALID row exists, else the static default from
 *     src/data/info-pages.ts. Never throws (DB error → default), so public info
 *     pages can never crash and always render the locked design.
 *   - getSitePagesForAdmin(): list rows for the admin content index.
 *   - getSitePageForAdmin(slug): the editable view (DB row, or the static default
 *     as the starting point when no row exists yet).
 *
 * The static info-pages.ts is intentionally KEPT as the fallback/default source.
 */

import 'server-only'

import { cache } from 'react'
import { prisma } from '../db/prisma'
import type { InfoPage } from '../../data/info-pages'
import {
  SITE_PAGE_DEFS,
  getDefaultInfoPage,
  isKnownPageSlug,
  type SitePageDef,
} from './defaults'
import { validateSitePageContent, toInfoPage, type ParsedSitePage } from './validate'

interface SitePageRow {
  slug: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string | null
  notice: string | null
  sections: unknown
  isPublished: boolean
}

/** Validates a raw DB row into a ParsedSitePage, or null when it is malformed. */
function parseRow(row: SitePageRow): ParsedSitePage | null {
  const res = validateSitePageContent({
    title: row.title,
    metaTitle: row.metaTitle,
    metaDescription: row.metaDescription,
    intro: row.intro,
    notice: row.notice,
    sections: row.sections,
  })
  return res.ok ? res.data : null
}

/**
 * PUBLIC loader: DB-backed page when a published, valid row exists; otherwise the
 * static default. Unknown slugs and any DB error resolve to the default (or
 * undefined when no default exists either).
 */
export const getInfoPageForPublic = cache(async (slug: string): Promise<InfoPage | undefined> => {
  const fallback = getDefaultInfoPage(slug)
  if (!isKnownPageSlug(slug)) return fallback

  try {
    const row = await prisma.sitePage.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        intro: true,
        notice: true,
        sections: true,
        isPublished: true,
      },
    })
    if (!row || !row.isPublished) return fallback

    const parsed = parseRow(row)
    if (!parsed) {
      console.error(`[site-pages] invalid stored content for "${slug}", using static default.`)
      return fallback
    }
    return toInfoPage(slug, parsed)
  } catch (err) {
    console.error(
      `[site-pages] read failed for "${slug}", using static default: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
    return fallback
  }
})

// ── Admin ─────────────────────────────────────────────────────────────────────

export interface AdminSitePageListItem {
  slug: string
  label: string
  title: string
  /** true when a DB row exists (edited/backfilled); false → still on static default. */
  hasRow: boolean
  isPublished: boolean
}

/** List of the known info pages with their DB state, for the admin index. */
export async function getSitePagesForAdmin(): Promise<AdminSitePageListItem[]> {
  const rows = new Map<string, { title: string; isPublished: boolean }>()
  try {
    const found = await prisma.sitePage.findMany({
      select: { slug: true, title: true, isPublished: true },
    })
    for (const r of found) rows.set(r.slug, { title: r.title, isPublished: r.isPublished })
  } catch (err) {
    console.error(
      `[site-pages] admin list read failed, showing defaults: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  return SITE_PAGE_DEFS.map((def: SitePageDef) => {
    const row = rows.get(def.slug)
    const fallback = getDefaultInfoPage(def.slug)
    return {
      slug: def.slug,
      label: def.label,
      title: row?.title ?? fallback?.title ?? def.slug,
      hasRow: row != null,
      isPublished: row?.isPublished ?? true,
    }
  })
}

export interface AdminSitePageEdit {
  slug: string
  label: string
  title: string
  metaTitle: string
  metaDescription: string
  intro: string
  notice: string
  isPublished: boolean
  sections: ParsedSitePage['sections']
}

/**
 * Editable view for one page: the DB row when present and valid, else the static
 * default as the starting point. Returns null for an unknown slug.
 */
export async function getSitePageForAdmin(slug: string): Promise<AdminSitePageEdit | null> {
  const def = SITE_PAGE_DEFS.find((d) => d.slug === slug)
  if (!def) return null

  const fallback = getDefaultInfoPage(slug)

  let row: SitePageRow | null = null
  try {
    row = await prisma.sitePage.findUnique({
      where: { slug },
      select: {
        slug: true,
        title: true,
        metaTitle: true,
        metaDescription: true,
        intro: true,
        notice: true,
        sections: true,
        isPublished: true,
      },
    })
  } catch (err) {
    console.error(
      `[site-pages] admin read failed for "${slug}", using default: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const parsed = row ? parseRow(row) : null

  if (row && parsed) {
    return {
      slug,
      label: def.label,
      title: parsed.title,
      metaTitle: parsed.metaTitle,
      metaDescription: parsed.metaDescription,
      intro: parsed.intro ?? '',
      notice: parsed.notice ?? '',
      isPublished: row.isPublished,
      sections: parsed.sections,
    }
  }

  // No (valid) row yet → start from the static default.
  return {
    slug,
    label: def.label,
    title: fallback?.title ?? '',
    metaTitle: fallback?.metaTitle ?? '',
    metaDescription: fallback?.metaDescription ?? '',
    intro: fallback?.intro ?? '',
    notice: fallback?.notice ?? '',
    isPublished: row?.isPublished ?? true,
    sections: fallback?.sections ?? [],
  }
}
