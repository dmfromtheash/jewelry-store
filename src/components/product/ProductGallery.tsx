import Placeholder from '../ui/Placeholder'

/**
 * AURELIA — ProductGallery (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Square gallery placeholder (admin "Добавить фото товара" / customer
 * "Скоро появится украшение") plus a row of thumbnail placeholders.
 * Visual only — no real images or selection logic yet.
 */

const ThumbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="3" y="4" width="18" height="15" rx="2" />
    <path d="M3 16.5l5-4.5 4 3.5 3.5-3 5.5 4.5" />
  </svg>
)

const THUMB_COUNT = 4

export default function ProductGallery() {
  return (
    <div>
      <Placeholder
        variant="gallery"
        adminTitle="Добавить фото товара"
        adminSub="Основное фото украшения, квадратный формат, светлый фон"
        adminHint="Нажмите, чтобы загрузить фото товара"
        customerTitle="Скоро появится украшение"
        customerSub="Фотографии будут добавлены в ближайшее время"
        withRule
        showImageIcon
      />
      <div className="au-gallery-thumbs">
        {Array.from({ length: THUMB_COUNT }).map((_, i) => (
          <span key={i} className={`thumb${i === 0 ? ' is-active' : ''}`}>
            <ThumbIcon />
          </span>
        ))}
      </div>
    </div>
  )
}
