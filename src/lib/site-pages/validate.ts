/**
 * AURELIA — Info-page content validation (Этап 46E)
 *
 * Pure, dependency-free validator for the SitePage content shape. Used on WRITE
 * (admin action) and re-used on READ (public loader re-checks a DB blob before
 * trusting it) and by the verify script. No Prisma, no `server-only`.
 *
 * Hard safety rules (CMS is PLAIN-TEXT business copy only — never a page builder):
 *   - strict shape: { heading?, paragraphs?[], bullets?[], faq?[{q,a}] };
 *   - NO HTML / scripts: reject `<` / `>` and `javascript:` / `data:` everywhere;
 *   - length + count limits on every field;
 *   - unknown/extra block types are dropped (never persisted).
 */

import type { InfoPage, InfoSection } from '../../data/info-pages'

// ── Limits ────────────────────────────────────────────────────────────────────
export const LIMITS = {
  title: 120,
  metaTitle: 160,
  metaDescription: 300,
  intro: 600,
  notice: 300,
  sections: 20,
  heading: 160,
  paragraph: 1000,
  paragraphs: 20,
  bullet: 300,
  bullets: 30,
  faq: 20,
  faqQ: 300,
  faqA: 1000,
} as const

export interface ParsedSitePage {
  title: string
  metaTitle: string
  metaDescription: string
  intro?: string
  notice?: string
  sections: InfoSection[]
}

export type SitePageReason =
  | 'title'
  | 'metaTitle'
  | 'metaDescription'
  | 'intro'
  | 'notice'
  | 'sections'
  | 'section'
  | 'html'

export type ValidateResult =
  | { ok: true; data: ParsedSitePage }
  | { ok: false; reason: SitePageReason; field: string }

/** True when the value carries markup or a dangerous URL scheme. */
export function hasUnsafeMarkup(value: string): boolean {
  if (/[<>]/.test(value)) return true
  return /(?:javascript|data)\s*:/i.test(value)
}

function fail(reason: SitePageReason, field: string): { ok: false; reason: SitePageReason; field: string } {
  return { ok: false, reason, field }
}

/** Validates a single section; returns a normalized section or an error. */
function validateSection(
  raw: unknown,
  index: number,
): { ok: true; data: InfoSection } | { ok: false; reason: SitePageReason; field: string } {
  if (typeof raw !== 'object' || raw === null) return fail('section', `s${index}`)
  const r = raw as Record<string, unknown>
  const out: InfoSection = {}

  // heading?
  if (r.heading != null) {
    if (typeof r.heading !== 'string') return fail('section', `s${index}.heading`)
    const h = r.heading.trim()
    if (h.length > LIMITS.heading) return fail('section', `s${index}.heading`)
    if (hasUnsafeMarkup(h)) return fail('html', `s${index}.heading`)
    if (h.length > 0) out.heading = h
  }

  // paragraphs?
  if (r.paragraphs != null) {
    if (!Array.isArray(r.paragraphs)) return fail('section', `s${index}.paragraphs`)
    if (r.paragraphs.length > LIMITS.paragraphs) return fail('section', `s${index}.paragraphs`)
    const ps: string[] = []
    for (const p of r.paragraphs) {
      if (typeof p !== 'string') return fail('section', `s${index}.paragraphs`)
      const t = p.trim()
      if (t.length === 0) continue
      if (t.length > LIMITS.paragraph) return fail('section', `s${index}.paragraphs`)
      if (hasUnsafeMarkup(t)) return fail('html', `s${index}.paragraphs`)
      ps.push(t)
    }
    if (ps.length > 0) out.paragraphs = ps
  }

  // bullets?
  if (r.bullets != null) {
    if (!Array.isArray(r.bullets)) return fail('section', `s${index}.bullets`)
    if (r.bullets.length > LIMITS.bullets) return fail('section', `s${index}.bullets`)
    const bs: string[] = []
    for (const b of r.bullets) {
      if (typeof b !== 'string') return fail('section', `s${index}.bullets`)
      const t = b.trim()
      if (t.length === 0) continue
      if (t.length > LIMITS.bullet) return fail('section', `s${index}.bullets`)
      if (hasUnsafeMarkup(t)) return fail('html', `s${index}.bullets`)
      bs.push(t)
    }
    if (bs.length > 0) out.bullets = bs
  }

  // faq?
  if (r.faq != null) {
    if (!Array.isArray(r.faq)) return fail('section', `s${index}.faq`)
    if (r.faq.length > LIMITS.faq) return fail('section', `s${index}.faq`)
    const fs: { q: string; a: string }[] = []
    for (const item of r.faq) {
      if (typeof item !== 'object' || item === null) return fail('section', `s${index}.faq`)
      const it = item as Record<string, unknown>
      if (typeof it.q !== 'string' || typeof it.a !== 'string') return fail('section', `s${index}.faq`)
      const q = it.q.trim()
      const a = it.a.trim()
      if (q.length === 0 && a.length === 0) continue
      if (q.length > LIMITS.faqQ || a.length > LIMITS.faqA) return fail('section', `s${index}.faq`)
      if (hasUnsafeMarkup(q) || hasUnsafeMarkup(a)) return fail('html', `s${index}.faq`)
      fs.push({ q, a })
    }
    if (fs.length > 0) out.faq = fs
  }

  return { ok: true, data: out }
}

/** Validates the full page content (already-parsed field values + sections). */
export function validateSitePageContent(input: {
  title: string
  metaTitle: string
  metaDescription: string
  intro?: string | null
  notice?: string | null
  sections: unknown
}): ValidateResult {
  const title = input.title.trim()
  if (title.length === 0 || title.length > LIMITS.title) return fail('title', 'title')
  if (hasUnsafeMarkup(title)) return fail('html', 'title')

  const metaTitle = input.metaTitle.trim()
  if (metaTitle.length === 0 || metaTitle.length > LIMITS.metaTitle) return fail('metaTitle', 'metaTitle')
  if (hasUnsafeMarkup(metaTitle)) return fail('html', 'metaTitle')

  const metaDescription = input.metaDescription.trim()
  if (metaDescription.length > LIMITS.metaDescription) return fail('metaDescription', 'metaDescription')
  if (hasUnsafeMarkup(metaDescription)) return fail('html', 'metaDescription')

  const introRaw = (input.intro ?? '').trim()
  if (introRaw.length > LIMITS.intro) return fail('intro', 'intro')
  if (hasUnsafeMarkup(introRaw)) return fail('html', 'intro')

  const noticeRaw = (input.notice ?? '').trim()
  if (noticeRaw.length > LIMITS.notice) return fail('notice', 'notice')
  if (hasUnsafeMarkup(noticeRaw)) return fail('html', 'notice')

  if (!Array.isArray(input.sections)) return fail('sections', 'sections')
  if (input.sections.length > LIMITS.sections) return fail('sections', 'sections')

  const sections: InfoSection[] = []
  for (let i = 0; i < input.sections.length; i++) {
    const res = validateSection(input.sections[i], i)
    if (!res.ok) return res
    sections.push(res.data)
  }

  return {
    ok: true,
    data: {
      title,
      metaTitle,
      metaDescription,
      intro: introRaw.length > 0 ? introRaw : undefined,
      notice: noticeRaw.length > 0 ? noticeRaw : undefined,
      sections,
    },
  }
}

/**
 * Maps a validated page (+ slug) back to the InfoPage shape InfoPageLayout expects.
 * Used by the public loader after a DB row passes validation.
 */
export function toInfoPage(slug: string, data: ParsedSitePage): InfoPage {
  return {
    slug,
    title: data.title,
    metaTitle: data.metaTitle,
    metaDescription: data.metaDescription,
    intro: data.intro,
    notice: data.notice,
    sections: data.sections,
  }
}
