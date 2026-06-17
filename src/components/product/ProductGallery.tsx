import Placeholder from '../ui/Placeholder'
import type { ProductImageRef } from '../../lib/catalog'

/**
 * AURELIA — ProductGallery (server component)
 * Source: docs/design/aurelia-prototype/05 Product Page.html
 *
 * Square gallery. With no uploaded images it renders the original placeholder
 * (admin "Добавить фото товара" / customer "Скоро появится украшение") 1:1.
 * Once images exist it renders the real primary image in the same square slot
 * plus a thumbnail row — sizing is inline so no gallery stylesheet is touched.
 */

const ThumbIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
    <rect x="3" y="4" width="18" height="15" rx="2" />
    <path d="M3 16.5l5-4.5 4 3.5 3.5-3 5.5 4.5" />
  </svg>
)

const THUMB_COUNT = 4

const fill = { width: '100%', height: '100%', objectFit: 'cover' as const, display: 'block' }

export default function ProductGallery({ images }: { images?: ProductImageRef[] }) {
  const hasImages = !!images && images.length > 0

  if (!hasImages) {
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

  const main = images![0]
  return (
    <div>
      <div
        className="au-ph au-ph--gallery"
        style={{ overflow: 'hidden', padding: 0 }}
      >
        <img src={main.url} alt={main.alt || 'Фото товара'} style={fill} />
      </div>
      <div className="au-gallery-thumbs">
        {images!.map((img, i) => (
          <span key={img.url} className={`thumb${i === 0 ? ' is-active' : ''}`} style={{ overflow: 'hidden' }}>
            <img src={img.url} alt={img.alt || 'Миниатюра'} style={fill} />
          </span>
        ))}
      </div>
    </div>
  )
}
