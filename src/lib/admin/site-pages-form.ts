/**
 * AURELIA — Admin info-page form parsing (Этап 46E) — server-only
 *
 * Turns the structured (no-JS) admin content form into a validated page. The form
 * edits a FIXED set of sections (the page's current sections) via plain text
 * fields; arrays are line-based so no raw JSON is exposed:
 *   - s{i}.heading      → section heading (one line)
 *   - s{i}.paragraphs   → one paragraph per line
 *   - s{i}.bullets      → one bullet per line
 *   - s{i}.faq          → one "Question :: Answer" per line
 *
 * The reconstructed sections are handed to the shared content validator, which
 * enforces the strict shape, length/count limits, and the no-HTML rule. No Prisma.
 */

import 'server-only'

import { validateSitePageContent, type ValidateResult } from '../site-pages/validate'

const FAQ_SEP = '::'
const MAX_SECTIONS = 20

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

/** Splits a textarea into trimmed, non-empty lines. */
function lines(formData: FormData, key: string): string[] {
  return String(formData.get(key) ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

/** Parses "Question :: Answer" lines into faq items (first `::` splits). */
function parseFaq(raw: string[]): { q: string; a: string }[] {
  const out: { q: string; a: string }[] = []
  for (const line of raw) {
    const idx = line.indexOf(FAQ_SEP)
    if (idx === -1) {
      // No separator → treat the whole line as the question (answer empty).
      out.push({ q: line, a: '' })
    } else {
      out.push({ q: line.slice(0, idx).trim(), a: line.slice(idx + FAQ_SEP.length).trim() })
    }
  }
  return out
}

/**
 * Parses + validates the admin page form. `sectionCount` (hidden) bounds how many
 * section blocks to read. Returns the same ValidateResult the content validator
 * produces (the action redirects with ?err=<reason>&f=<field> on failure).
 */
export function parseSitePageForm(formData: FormData): ValidateResult {
  const rawCount = Number(str(formData, 'sectionCount'))
  const count = Number.isInteger(rawCount) ? Math.max(0, Math.min(rawCount, MAX_SECTIONS)) : 0

  const sections: Record<string, unknown>[] = []
  for (let i = 0; i < count; i++) {
    sections.push({
      heading: str(formData, `s${i}.heading`),
      paragraphs: lines(formData, `s${i}.paragraphs`),
      bullets: lines(formData, `s${i}.bullets`),
      faq: parseFaq(lines(formData, `s${i}.faq`)),
    })
  }

  return validateSitePageContent({
    title: str(formData, 'title'),
    metaTitle: str(formData, 'metaTitle'),
    metaDescription: str(formData, 'metaDescription'),
    intro: str(formData, 'intro'),
    notice: str(formData, 'notice'),
    sections,
  })
}
