/**
 * AURELIA — SEO & marketing readiness (pure) (Этап 72A)
 *
 * Pure, dependency-free helpers + types that turn already-safe aggregate inputs (counts/flags)
 * into an honest SEO/marketing readiness report for the admin /admin/seo view and the verify
 * script. NO Prisma, NO React, NO `server-only`, NO secrets/PII — it only ever sees small counts
 * and booleans the server data layer has already projected.
 *
 * This is intentionally focused on SEO/marketing surface readiness (sitemap/robots/canonical/OG/
 * structured data / production domain / social-preview), NOT on per-product CONTENT readiness —
 * that lives in src/lib/product-readiness (Этап 71A) and is linked, not duplicated, from here.
 */

import { isLocalDemoSiteUrl, productOgImages } from './site'

/** Status of a single readiness signal. */
export type SeoStatus = 'ok' | 'warn' | 'gap'

export interface SeoSignal {
  key: string
  label: string
  status: SeoStatus
  detail: string
}

// ── Site URL / domain status ─────────────────────────────────────────────────────────────────

export interface SiteUrlStatus {
  /** The resolved site origin (public, not a secret). */
  url: string
  /** True when NEXT_PUBLIC_SITE_URL is configured (vs falling back to the local/demo origin). */
  configured: boolean
  /** True when the resolved origin is localhost/loopback (no real public domain yet). */
  localDemo: boolean
}

/** Classifies the site-URL configuration into an honest readiness signal. */
export function siteUrlSignal(status: SiteUrlStatus): SeoSignal {
  if (status.localDemo) {
    return {
      key: 'site-url',
      label: 'Публічний домен',
      status: 'gap',
      detail: status.configured
        ? `Налаштовано локальний/демо-домен (${status.url}). Реальний публічний домен ще не підключено.`
        : 'Публічний домен НЕ налаштовано — використовується локальний демо-fallback. Налаштовується власником.',
    }
  }
  return {
    key: 'site-url',
    label: 'Публічний домен',
    status: 'ok',
    detail: `Налаштовано публічний домен (${status.url}). Деплой і підключення домену — рішення власника.`,
  }
}

// ── Product SEO coverage ─────────────────────────────────────────────────────────────────────

/** The minimal per-product projection the SEO coverage summary needs (no PII). */
export interface SeoProductRow {
  slug: string
  status: string
  isPublished: boolean
  /** Trimmed description length (0 when missing) — the text itself is NOT carried here. */
  descriptionLength: number
  /** Whether a REAL uploaded primary image exists (placeholder ⇒ false). */
  hasRealImage: boolean
}

export interface ProductSeoCoverage {
  total: number
  /** Published + available products (the set the sitemap advertises). */
  indexable: number
  withDescription: number
  missingDescription: number
  withOgImage: number
  /** Indexable products with only a placeholder (no real OG image). */
  ogImageGap: number
  /** Indexable products with an unsafe/empty slug. */
  slugIssues: number
}

const MIN_DESCRIPTION_LENGTH = 30
const SAFE_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Summarises product SEO coverage from safe per-product rows. "Indexable" mirrors the sitemap
 * eligibility (published + available). OG-image gaps count indexable products with no real photo —
 * honest, since we never fabricate imagery.
 */
export function summarizeProductSeo(rows: SeoProductRow[]): ProductSeoCoverage {
  const cov: ProductSeoCoverage = {
    total: rows.length,
    indexable: 0,
    withDescription: 0,
    missingDescription: 0,
    withOgImage: 0,
    ogImageGap: 0,
    slugIssues: 0,
  }
  for (const r of rows) {
    const indexable = r.isPublished && r.status === 'available'
    const hasDescription = r.descriptionLength >= MIN_DESCRIPTION_LENGTH
    if (hasDescription) cov.withDescription++
    else cov.missingDescription++
    if (r.hasRealImage) cov.withOgImage++
    if (indexable) {
      cov.indexable++
      if (!r.hasRealImage) cov.ogImageGap++
      if (!r.slug || !SAFE_SLUG.test(r.slug)) cov.slugIssues++
    }
  }
  return cov
}

// ── Structured-data coverage (static facts about what this build emits) ──────────────────────

export interface StructuredDataCoverage {
  organization: boolean
  website: boolean
  breadcrumb: boolean
  product: boolean
}

/** What structured data this build actually emits (Этап 72A). */
export function structuredDataCoverage(): StructuredDataCoverage {
  return { organization: true, website: true, breadcrumb: true, product: true }
}

// ── Marketing readiness notes (honest, owner-gated) ──────────────────────────────────────────

export interface MarketingNote {
  label: string
  note: string
}

/**
 * Honest marketing-readiness notes. These describe what the SEO foundation supports and what is
 * deliberately NOT built (no analytics/pixels/ads/CRM/automation). Owner-gated boundaries are
 * stated plainly so the admin view can never imply an integration exists.
 */
export function buildMarketingReadinessNotes(): MarketingNote[] {
  return [
    {
      label: 'Соц-прев’ю (Open Graph / Twitter)',
      note: 'Базові OG/Twitter-теги є на головній, картках товарів і категоріях. Реального бренд-OG-зображення ще немає — для товарів без фото зображення не підставляється (без фейку).',
    },
    {
      label: 'UTM-мітки',
      note: 'Маршрути не залежать від query-параметрів, тож UTM-посилання (utm_source/medium/campaign) безпечні; вони НЕ відстежуються (немає аналітики/подій) і не впливають на canonical.',
    },
    {
      label: 'Лендінги кампаній',
      note: 'Окремих лендінгів кампаній немає — посилайтеся на наявні сторінки категорій/товарів. Створення нових лендінгів — рішення власника.',
    },
    {
      label: 'Аналітика / події',
      note: 'Зовнішня аналітика, піксель, ретаргетинг і рекламні інтеграції НЕ підключені (тільки локальні лічильники). Це окремий етап.',
    },
    {
      label: 'Email-маркетинг / CRM',
      note: 'Email-маркетинг, автоматизація та CRM НЕ реалізовані; реальні листи не надсилаються (немає провайдера).',
    },
  ]
}

// ── Public-demo blockers (SEO/marketing angle) ───────────────────────────────────────────────

export interface SeoBlockerInput {
  siteUrl: SiteUrlStatus
  coverage: ProductSeoCoverage
  /** Whether a brand-level OG image asset exists (none yet → true here means "exists"). */
  hasBrandOgAsset: boolean
}

/**
 * The SEO/marketing blockers that stand between the current local demo and a public launch.
 * Honest: a missing public domain and the absence of real product/brand photography are the
 * headline gaps; they are owner-provided, never fabricated.
 */
export function buildSeoBlockers(input: SeoBlockerInput): SeoSignal[] {
  const blockers: SeoSignal[] = []

  if (input.siteUrl.localDemo) {
    blockers.push({
      key: 'no-public-domain',
      label: 'Немає публічного домену',
      status: 'gap',
      detail: 'Сайт не розгорнуто на публічному домені — canonical/OG/sitemap використовують локальний демо-URL.',
    })
  }
  if (!input.hasBrandOgAsset) {
    blockers.push({
      key: 'no-brand-og',
      label: 'Немає бренд-OG-зображення',
      status: 'gap',
      detail: 'Немає фірмового OG-зображення для сторінок без фото товару — соц-прев’ю показується без картинки (це чесно, без фейку).',
    })
  }
  if (input.coverage.ogImageGap > 0) {
    blockers.push({
      key: 'product-photo-gap',
      label: 'Товари без реального фото',
      status: 'warn',
      detail: `${input.coverage.ogImageGap} індексованих товар(ів) використовують плейсхолдер — реальні фото надає власник (див. /admin/readiness).`,
    })
  }
  if (input.coverage.missingDescription > 0) {
    blockers.push({
      key: 'missing-descriptions',
      label: 'Товари без опису',
      status: 'warn',
      detail: `${input.coverage.missingDescription} товар(ів) без повноцінного опису — meta-опис підставляє чесний fallback, але краще додати реальний текст.`,
    })
  }
  if (input.coverage.slugIssues > 0) {
    blockers.push({
      key: 'slug-issues',
      label: 'Небезпечні slug',
      status: 'warn',
      detail: `${input.coverage.slugIssues} індексованих товар(ів) мають неоптимальний slug.`,
    })
  }
  return blockers
}

/** A tiny re-export so callers/tests can derive OG images from the same honest policy. */
export { productOgImages, isLocalDemoSiteUrl }
