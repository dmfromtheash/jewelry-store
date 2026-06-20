/**
 * AURELIA — Info-page CMS defaults & slug allowlist (Этап 46E)
 *
 * Single source of truth for which info pages exist and their admin labels. The
 * actual default CONTENT stays in src/data/info-pages.ts (the static fallback,
 * intentionally NOT removed) — this module just wraps it with the FIXED slug
 * allowlist + Russian admin labels.
 *
 * Pure & dependency-free (no Prisma, no `server-only`) so the seed, verify script,
 * validator, and admin/public helpers can all share it.
 */

import { getInfoPage, type InfoPage } from '../../data/info-pages'

export interface SitePageDef {
  slug: string
  /** Russian admin-facing label (admin is internal/Russian by design). */
  label: string
}

/** The known info pages, in stable admin display order. v1 does NOT allow
 *  creating arbitrary new slugs — only these are editable. */
export const SITE_PAGE_DEFS: readonly SitePageDef[] = [
  { slug: 'delivery', label: 'Доставка и оплата' },
  { slug: 'returns', label: 'Возврат и обмен' },
  { slug: 'stores', label: 'Магазины' },
  { slug: 'help', label: 'Помощь' },
  { slug: 'about', label: 'О бренде' },
  { slug: 'contacts', label: 'Контакты' },
] as const

export const SITE_PAGE_SLUGS: readonly string[] = SITE_PAGE_DEFS.map((d) => d.slug)

/** True only for an allowlisted info-page slug. */
export function isKnownPageSlug(slug: string): boolean {
  return SITE_PAGE_SLUGS.includes(slug)
}

/** The static default content for a slug (the fallback source). */
export function getDefaultInfoPage(slug: string): InfoPage | undefined {
  return getInfoPage(slug)
}

export function getSitePageDef(slug: string): SitePageDef | undefined {
  return SITE_PAGE_DEFS.find((d) => d.slug === slug)
}
