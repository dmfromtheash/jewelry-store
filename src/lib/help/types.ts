/**
 * AURELIA — Help Center types (Этап 79A)
 *
 * Shared, serializable types for the Help Center. Safe to import from client and
 * server alike (no Prisma here). Help categories + articles are CURATED STATIC content
 * (src/lib/help/content.ts) — the source of truth for v1 — so the Help Center renders
 * fully even with an empty DB and contains NO fake business claims. Customer-submitted
 * Help questions are the DB-backed part (model HelpQuestion).
 */

/** A Help Center category (curated static content). */
export interface HelpCategory {
  /** Latin slug used in filter URLs (?category=...). */
  slug: string
  /** Ukrainian display name. */
  name: string
  /** Short Ukrainian description. */
  description: string
  sortOrder: number
}

/** A single FAQ/help article (curated static content). */
export interface HelpArticle {
  slug: string
  /** Slug of the owning HelpCategory. */
  categorySlug: string
  /** Ukrainian question/title. */
  title: string
  /** Ukrainian answer body (plain text). */
  body: string
  /** Extra search keywords (space-separated), not rendered. */
  keywords?: string
  sortOrder: number
  /** Honest label for seeded/sample evergreen content (never passed off as final policy). */
  isDemo?: boolean
}
