/**
 * AURELIA — Placeholder (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-ph)
 *
 * A designed empty-state block. It carries BOTH states in markup:
 *   - .only-admin  → "Добавить ..." (upload affordance)
 *   - .only-customer → "Скоро появится ..." (storefront message)
 * Which one is shown is controlled purely by CSS via the [data-view]
 * attribute on an ancestor (see src/styles/home.css). The storefront
 * defaults to the customer state; the admin state is wired up later.
 *
 * No client JS — the admin "upload" affordance is visual only for now.
 */

type PlaceholderVariant = 'hero' | 'banner' | 'banner-wide' | 'square' | 'gallery'

interface PlaceholderProps {
  variant: PlaceholderVariant
  adminTitle: string
  adminSub?: string
  adminHint?: string
  customerTitle: string
  customerSub?: string
  /** thin rule between admin title and sub (used on the hero) */
  withRule?: boolean
  /** extra image icon under the admin zone (used on the hero) */
  showImageIcon?: boolean
}

const PlusIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const RichGemIcon = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18M9.5 9L12 20 14.5 9M7 4l2.5 5L12 4l2.5 5L17 4" />
  </svg>
)

const BannerGemIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

const ImageIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="3" y="4" width="18" height="15" rx="2" />
    <circle cx="9" cy="9.5" r="1.6" />
    <path d="M3 16.5l5-4.5 4 3.5 3.5-3 5.5 4.5" />
  </svg>
)

const InfoIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8v.2" />
  </svg>
)

export default function Placeholder({
  variant,
  adminTitle,
  adminSub,
  adminHint,
  customerTitle,
  customerSub,
  withRule = false,
  showImageIcon = false,
}: PlaceholderProps) {
  // hero/gallery get the larger "rich" plus + gem treatment (no au-ph--sm)
  const isRich = variant === 'hero' || variant === 'gallery'
  const variantClass = {
    hero: 'au-ph--hero',
    banner: 'au-ph--banner-half au-ph--sm',
    'banner-wide': 'au-ph--banner au-ph--sm',
    square: 'au-ph--square au-ph--sm',
    gallery: 'au-ph--gallery',
  }[variant]
  const rootClass = ['au-ph', variantClass, adminHint ? 'has-hint' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={rootClass}>
      {/* Admin: upload affordance */}
      <div className="au-ph-zone only-admin">
        <span className="au-ph-plus">
          <PlusIcon size={isRich ? 22 : 18} />
        </span>
        <span className="au-ph-title">{adminTitle}</span>
        {withRule && <span className="au-ph-rule" />}
        {adminSub && <span className="au-ph-sub">{adminSub}</span>}
        {showImageIcon && (
          <span className="au-ph-img-ico">
            <ImageIcon />
          </span>
        )}
      </div>

      {/* Customer: storefront message */}
      <div className="au-ph-zone only-customer">
        <span className="au-ph-gem">
          {isRich ? <RichGemIcon size={variant === 'gallery' ? 38 : 34} /> : <BannerGemIcon />}
        </span>
        <span className="au-ph-cust-title">{customerTitle}</span>
        {customerSub && <span className="au-ph-sub">{customerSub}</span>}
      </div>

      {adminHint && (
        <div className="au-ph-hint only-admin">
          <InfoIcon />
          {adminHint}
        </div>
      )}
    </div>
  )
}
