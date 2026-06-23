/**
 * AURELIA — Product content readiness rules (Этап 71A)
 *
 * Pure + dependency-free (no Prisma, no `server-only`, no React), so the SAME rules are shared by
 * the server data layer (readiness-data.ts), the admin route, AND the verify script (run under
 * tsx) — mirroring the availability.ts / stock-health.ts / operations-dashboard.ts pattern.
 *
 * WHAT THIS IS: a read-only "is this product CARD ready" checker. It scores a product's content
 * against four honest readiness LEVELS and never mutates anything, never gates checkout, and never
 * changes availability logic (purchasability stays owned by availability.ts).
 *
 * THE PHOTO TRUTH (must never drift): the project has NO real final product photography yet. A
 * product "has a real photo" ONLY when an image slot carries a non-null URL (the storefront renders
 * a gem placeholder otherwise). A placeholder is HONEST for a local/buyer demo, but it is a content
 * GAP for a public demo / real sale — and a real licensed/owned photo is an OWNER-PROVIDED future
 * requirement that CANNOT be verified automatically. This module therefore flags the gap; it never
 * invents, downloads, generates, or claims a real photo exists.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Levels + severities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Readiness LEVELS form a ladder (each higher level requires everything below it):
 *   - local_demo  : honest enough to click through locally (placeholders allowed).
 *   - buyer_demo  : honest enough to show a prospective buyer (placeholders still allowed).
 *   - public_demo : exposed to the public — placeholder photos / missing copy become gaps.
 *   - real_sale   : ready to actually sell — needs real photos + complete content.
 */
export const READINESS_LEVELS = ['local_demo', 'buyer_demo', 'public_demo', 'real_sale'] as const
export type ReadinessLevel = (typeof READINESS_LEVELS)[number]

/** Index of a level in the ladder (lower = easier to reach). */
export function levelIndex(level: ReadinessLevel): number {
  return READINESS_LEVELS.indexOf(level)
}

export const READINESS_LEVEL_LABELS: Record<ReadinessLevel, string> = {
  local_demo: 'Локальное демо',
  buyer_demo: 'Демо покупателю',
  public_demo: 'Публичное демо',
  real_sale: 'Реальная продажа',
}

/** Severity of a single issue: blocker → warning → info. */
export type IssueSeverity = 'blocker' | 'warning' | 'info'

export const ISSUE_SEVERITY_LABELS: Record<IssueSeverity, string> = {
  blocker: 'Блокер',
  warning: 'Предупреждение',
  info: 'Инфо',
}

const SEVERITY_RANK: Record<IssueSeverity, number> = { blocker: 0, warning: 1, info: 2 }

// ─────────────────────────────────────────────────────────────────────────────
// Issue catalog
// ─────────────────────────────────────────────────────────────────────────────

/** Stable machine codes for every readiness issue (used by filters + verify). */
export type ReadinessIssueCode =
  | 'name-missing'
  | 'name-short'
  | 'slug-missing'
  | 'slug-unsafe'
  | 'category-missing'
  | 'price-missing-available'
  | 'currency-not-uah'
  | 'description-missing'
  | 'description-short'
  | 'description-placeholder'
  | 'specs-missing'
  | 'specs-thin'
  | 'photo-gap'
  | 'gallery-missing'
  | 'image-alt-missing'
  | 'image-duplicate'
  | 'variant-no-default'
  | 'sku-missing'
  | 'stock-zero-available'
  | 'stock-untracked-available'
  | 'legacy-rating-no-reviews'
  | 'no-approved-reviews'

export interface ReadinessIssue {
  code: ReadinessIssueCode
  severity: IssueSeverity
  /** Human-readable, safe-by-construction summary (no secrets/PII). */
  label: string
  /**
   * The LOWEST level this issue blocks; it blocks that level AND every higher one. `null` means it
   * never blocks any level (pure information — e.g. "no approved reviews yet").
   */
  blocksFrom: ReadinessLevel | null
}

/** True for a code that gates a real sale (blocker/warning that reaches real_sale). */
function blocksLevel(issue: ReadinessIssue, level: ReadinessLevel): boolean {
  return issue.blocksFrom != null && levelIndex(issue.blocksFrom) <= levelIndex(level)
}

// ─────────────────────────────────────────────────────────────────────────────
// Input shape + pure detectors
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SAFE, minimal product facts the readiness rules need — never a secret/token/PII. Built from a
 * Prisma row by `productRowToReadinessInput`. All counts are pre-computed so the rules stay pure.
 */
export interface ProductReadinessInput {
  name: string
  slug: string
  /** Storefront caption / categoryLabel; empty string when missing. */
  categoryLabel: string
  status: 'available' | 'coming_soon'
  isPublished: boolean
  currency: string
  /** Integer minor units or null (coming-soon). */
  price: number | null
  /** null = not tracked; 0 = out; >0 = on hand. */
  stockQuantity: number | null
  sku: string | null
  description: string | null
  /** Number of spec rows ({label,value}). */
  specCount: number
  /** Count of image slots whose URL is a REAL (non-null, non-empty) asset. */
  realImageCount: number
  /** Of the real images, how many sit in a secondary (gallery, position > 0) slot. */
  realGalleryCount: number
  /** A real PRIMARY image exists but its alt text is empty. */
  primaryImageMissingAlt: boolean
  /** Two or more image slots share the same non-empty URL. */
  hasDuplicateImageUrl: boolean
  /** Total selectable variants. */
  variantCount: number
  /** Whether at least one variant is marked default. */
  hasDefaultVariant: boolean
  /** Approved (publicly visible) review count. */
  approvedReviewCount: number
  /** Legacy `rating` column value (may be > 0 even with no approved reviews). */
  legacyRating: number
}

/** Minimum lengths before content reads as "real" rather than a stub. */
export const NAME_MIN_LENGTH = 3
export const DESCRIPTION_MIN_LENGTH = 40
export const SPECS_RECOMMENDED = 3

/** Safe storefront slug: latin lower-case, digits, hyphens only (matches the catalog URL contract). */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
}

/**
 * Detects an obvious PLACEHOLDER / stub description (lorem ipsum, "todo", "test", "демо",
 * "заглушка", "placeholder", "описание появится", …). Conservative: only trips on clear markers so
 * a real short description is not falsely flagged (its shortness is a separate, softer issue).
 */
export function isPlaceholderDescription(description: string | null | undefined): boolean {
  const d = (description ?? '').trim().toLowerCase()
  if (d.length === 0) return false // "missing" is a different issue
  return /\b(lorem ipsum|placeholder|todo|tbd|test test|sample text)\b/.test(d) ||
    /(заглушк|плейсхолдер|описание\s+появит|текст\s+появит|demo\s+text|демо[-\s]?текст)/.test(d) ||
    /^(test|тест|демо|demo|xxx+|\.+|-+)$/.test(d)
}

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadinessLevelState {
  level: ReadinessLevel
  /** No issue blocks this level. */
  ready: boolean
  /** Issues that block this level (for the "why not" explanation). */
  blockingCodes: ReadinessIssueCode[]
}

export interface ProductReadiness {
  issues: ReadinessIssue[]
  /** Counts by severity (across all issues). */
  blockerCount: number
  warningCount: number
  infoCount: number
  /** 0..100 soft display score (NOT a gate — the levels are the real signal). */
  score: number
  /** Per-level readiness state. */
  levels: ReadinessLevelState[]
  /** Highest CONTIGUOUS level reached from local_demo upward, or null if even local_demo is blocked. */
  reachedLevel: ReadinessLevel | null
  /** Convenience flags. */
  realSaleReady: boolean
  publicDemoReady: boolean
  /** True when the product has no real photo (placeholder only) — the headline content gap. */
  hasPhotoGap: boolean
}

const SCORE_PENALTY: Record<IssueSeverity, number> = { blocker: 25, warning: 10, info: 3 }

/**
 * Evaluates a product's content readiness (pure). Produces the issue list, a soft 0..100 score, and
 * the per-level ladder. Never throws on a sparse product. The `reachedLevel` is the highest level
 * with no blocking issue, respecting the ladder (a higher level is only "reached" if all lower ones
 * are too).
 */
export function evaluateProductReadiness(input: ProductReadinessInput): ProductReadiness {
  const issues: ReadinessIssue[] = []
  const add = (cond: boolean, issue: ReadinessIssue) => {
    if (cond) issues.push(issue)
  }

  const name = input.name.trim()
  const description = (input.description ?? '').trim()
  const isAvailable = input.status === 'available'
  // A product the storefront would treat as orderable by STATUS (published + available + priced).
  const sellableByStatus = input.isPublished && isAvailable && input.price != null

  // ── Core product data ──
  add(name.length === 0, { code: 'name-missing', severity: 'blocker', blocksFrom: 'local_demo', label: 'Нет названия товара.' })
  add(name.length > 0 && name.length < NAME_MIN_LENGTH, { code: 'name-short', severity: 'warning', blocksFrom: 'public_demo', label: 'Слишком короткое название.' })
  add(input.slug.trim().length === 0, { code: 'slug-missing', severity: 'blocker', blocksFrom: 'local_demo', label: 'Нет URL-адреса (slug).' })
  add(input.slug.trim().length > 0 && !isSafeSlug(input.slug), { code: 'slug-unsafe', severity: 'warning', blocksFrom: 'public_demo', label: 'Небезопасный slug (нужны только латиница, цифры и дефис).' })
  add(input.categoryLabel.trim().length === 0, { code: 'category-missing', severity: 'blocker', blocksFrom: 'local_demo', label: 'Не указана категория/подпись товара.' })
  add(isAvailable && input.price == null, { code: 'price-missing-available', severity: 'blocker', blocksFrom: 'local_demo', label: 'Доступный товар без цены.' })
  add(input.currency.toUpperCase() !== 'UAH', { code: 'currency-not-uah', severity: 'warning', blocksFrom: 'public_demo', label: `Валюта не ₴ (UAH): «${input.currency}».` })

  // ── Description / specs ──
  add(description.length === 0, { code: 'description-missing', severity: 'warning', blocksFrom: 'public_demo', label: 'Нет описания (для meta/SEO будет использован запасной текст).' })
  add(description.length > 0 && isPlaceholderDescription(description), { code: 'description-placeholder', severity: 'warning', blocksFrom: 'public_demo', label: 'Описание выглядит как заглушка/демо-текст.' })
  add(description.length > 0 && !isPlaceholderDescription(description) && description.length < DESCRIPTION_MIN_LENGTH, { code: 'description-short', severity: 'info', blocksFrom: 'real_sale', label: 'Слишком короткое описание для продажи.' })
  add(input.specCount === 0, { code: 'specs-missing', severity: 'info', blocksFrom: 'real_sale', label: 'Нет характеристик (материал/покрытие/размер).' })
  add(input.specCount > 0 && input.specCount < SPECS_RECOMMENDED, { code: 'specs-thin', severity: 'info', blocksFrom: 'real_sale', label: 'Мало характеристик для карточки ювелирки/аксессуара.' })

  // ── Image / photo readiness (placeholder = owner-provided real-photo requirement) ──
  add(input.realImageCount === 0, { code: 'photo-gap', severity: 'warning', blocksFrom: 'public_demo', label: 'Нет реального фото — демо-плейсхолдер. Реальное лицензированное/собственное фото предоставляет владелец.' })
  add(input.realImageCount > 0 && input.realGalleryCount === 0, { code: 'gallery-missing', severity: 'info', blocksFrom: 'real_sale', label: 'Только одно фото — нет галереи.' })
  add(input.realImageCount > 0 && input.primaryImageMissingAlt, { code: 'image-alt-missing', severity: 'info', blocksFrom: 'real_sale', label: 'У основного фото нет alt-текста (доступность/SEO).' })
  add(input.hasDuplicateImageUrl, { code: 'image-duplicate', severity: 'warning', blocksFrom: 'public_demo', label: 'Дублирующиеся URL изображений.' })

  // ── Catalog / commerce readiness ──
  add(input.variantCount > 0 && !input.hasDefaultVariant, { code: 'variant-no-default', severity: 'warning', blocksFrom: 'public_demo', label: 'Есть варианты, но не выбран вариант по умолчанию.' })
  add((input.sku ?? '').trim().length === 0, { code: 'sku-missing', severity: 'info', blocksFrom: 'real_sale', label: 'Нет SKU (артикула).' })
  add(sellableByStatus && input.stockQuantity === 0, { code: 'stock-zero-available', severity: 'warning', blocksFrom: 'real_sale', label: 'Доступный товар с нулевым остатком (не продаётся).' })
  // Untracked stock is an EXPLICIT, allowed policy (legacy/demo item stays purchasable on
  // status+price). So it is pure info — it never blocks a level.
  add(sellableByStatus && input.stockQuantity == null, { code: 'stock-untracked-available', severity: 'info', blocksFrom: null, label: 'Остаток не отслеживается (демо/легаси — допустимо, товар покупаем по статусу+цене).' })

  // ── Honesty / social proof (NEVER require fake reviews/ratings) ──
  add(input.legacyRating > 0 && input.approvedReviewCount === 0, { code: 'legacy-rating-no-reviews', severity: 'warning', blocksFrom: 'public_demo', label: 'Указан старый рейтинг, но нет одобренных отзывов (может вводить в заблуждение).' })
  add(input.approvedReviewCount === 0, { code: 'no-approved-reviews', severity: 'info', blocksFrom: null, label: 'Нет одобренных отзывов (необязательно — отсутствие не является дефектом).' })

  // ── Counts + score ──
  let blockerCount = 0
  let warningCount = 0
  let infoCount = 0
  let penalty = 0
  for (const i of issues) {
    if (i.severity === 'blocker') blockerCount++
    else if (i.severity === 'warning') warningCount++
    else infoCount++
    penalty += SCORE_PENALTY[i.severity]
  }
  const score = Math.max(0, Math.min(100, 100 - penalty))

  // ── Levels ladder ──
  const levels: ReadinessLevelState[] = READINESS_LEVELS.map((level) => {
    const blockingCodes = issues.filter((i) => blocksLevel(i, level)).map((i) => i.code)
    return { level, ready: blockingCodes.length === 0, blockingCodes }
  })

  // Highest CONTIGUOUS reached level from the bottom up.
  let reachedLevel: ReadinessLevel | null = null
  for (const state of levels) {
    if (state.ready) reachedLevel = state.level
    else break
  }

  const realSaleReady = levels[levelIndex('real_sale')].ready
  const publicDemoReady = levels[levelIndex('public_demo')].ready
  const hasPhotoGap = input.realImageCount === 0

  // Sort issues for stable display (blocker → warning → info, then code).
  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.code.localeCompare(b.code))

  return { issues, blockerCount, warningCount, infoCount, score, levels, reachedLevel, realSaleReady, publicDemoReady, hasPhotoGap }
}

// ─────────────────────────────────────────────────────────────────────────────
// Row → input mapping (pure; shared by data layer + verify)
// ─────────────────────────────────────────────────────────────────────────────

/** Minimal Prisma image-row shape the mapper reads. */
export interface ReadinessImageRow {
  url: string | null
  alt: string | null
  isPrimary: boolean
  position: number
}

/** Minimal Prisma variant-row shape the mapper reads. */
export interface ReadinessVariantRow {
  isDefault: boolean
}

/** Minimal Prisma product-row shape (+ relations) the mapper reads. */
export interface ReadinessProductRow {
  name: string
  slug: string
  categoryLabel: string
  status: 'available' | 'coming_soon'
  isPublished: boolean
  currency: string
  price: number | null
  stockQuantity: number | null
  sku: string | null
  description: string | null
  /** Prisma JSON; expected to be an array of {label,value}. Anything else → 0 specs. */
  specs: unknown
  rating: number
  images: ReadinessImageRow[]
  variants: ReadinessVariantRow[]
  /** Approved review count, resolved by the data layer (a grouped query / _count). */
  approvedReviewCount: number
}

/** A non-empty image URL (whitespace-only counts as empty). */
function hasRealUrl(url: string | null): boolean {
  return typeof url === 'string' && url.trim().length > 0
}

/** Counts spec rows in the JSON blob, tolerating any non-array shape (→ 0). */
export function countSpecs(specs: unknown): number {
  return Array.isArray(specs) ? specs.length : 0
}

/** Pure: turns a safe Prisma product row (+ relations) into the readiness input. */
export function productRowToReadinessInput(row: ReadinessProductRow): ProductReadinessInput {
  const realImages = row.images.filter((img) => hasRealUrl(img.url))
  const primary = row.images.find((img) => img.isPrimary) ?? row.images.find((img) => img.position === 0)
  const primaryHasRealUrl = primary != null && hasRealUrl(primary.url)

  const urls = realImages.map((img) => img.url!.trim())
  const hasDuplicateImageUrl = new Set(urls).size !== urls.length

  return {
    name: row.name,
    slug: row.slug,
    categoryLabel: row.categoryLabel,
    status: row.status,
    isPublished: row.isPublished,
    currency: row.currency,
    price: row.price,
    stockQuantity: row.stockQuantity,
    sku: row.sku,
    description: row.description,
    specCount: countSpecs(row.specs),
    realImageCount: realImages.length,
    realGalleryCount: realImages.filter((img) => !img.isPrimary && img.position > 0).length,
    primaryImageMissingAlt: primaryHasRealUrl && (primary?.alt ?? '').trim().length === 0,
    hasDuplicateImageUrl,
    variantCount: row.variants.length,
    hasDefaultVariant: row.variants.some((v) => v.isDefault),
    approvedReviewCount: row.approvedReviewCount,
    legacyRating: row.rating,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation (pure)
// ─────────────────────────────────────────────────────────────────────────────

export interface ReadinessSummary {
  total: number
  /** Products by their reached level (null = below local_demo). */
  belowLocalDemo: number
  localDemoOnly: number
  buyerDemoReady: number
  publicDemoReady: number
  realSaleReady: number
  /** Products carrying at least one blocker / warning. */
  withBlockers: number
  withWarnings: number
  /** Products with no real photo (placeholder only). */
  withPhotoGap: number
}

/** Pure: rolls a set of per-product readiness results into a store-wide summary. */
export function summarizeReadiness(results: ProductReadiness[]): ReadinessSummary {
  const summary: ReadinessSummary = {
    total: results.length,
    belowLocalDemo: 0,
    localDemoOnly: 0,
    buyerDemoReady: 0,
    publicDemoReady: 0,
    realSaleReady: 0,
    withBlockers: 0,
    withWarnings: 0,
    withPhotoGap: 0,
  }
  for (const r of results) {
    if (r.reachedLevel == null) summary.belowLocalDemo++
    else if (r.reachedLevel === 'local_demo') summary.localDemoOnly++
    // These are cumulative "reached at least this level" tallies (a real-sale-ready product is
    // also buyer/public ready), so the owner can read "how many are at least X".
    if (r.reachedLevel != null && levelIndex(r.reachedLevel) >= levelIndex('buyer_demo')) summary.buyerDemoReady++
    if (r.publicDemoReady) summary.publicDemoReady++
    if (r.realSaleReady) summary.realSaleReady++
    if (r.blockerCount > 0) summary.withBlockers++
    if (r.warningCount > 0) summary.withWarnings++
    if (r.hasPhotoGap) summary.withPhotoGap++
  }
  return summary
}
