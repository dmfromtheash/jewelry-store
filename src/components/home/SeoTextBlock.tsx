/**
 * AURELIA — SEO text block (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-seo)
 *
 * Light informational block: a heading and a few paragraphs flowing across
 * columns on wide screens. Defaults to the home-page copy; pass `title` /
 * `paragraphs` to reuse it on other pages (e.g. category).
 */

const HOME_TITLE = 'AURELIA — бижутерия без границ'
const HOME_PARAGRAPHS = [
  'AURELIA — интернет-магазин современной бижутерии и аксессуаров. Мы собираем украшения, которые легко носить каждый день и приятно дарить: серьги, кольца, браслеты, цепочки, кулоны и готовые наборы.',
  'В каталоге — лаконичные базовые формы и выразительные акцентные модели с покрытием из позолоты и родия, вставками из стекла, эмали и искусственного жемчуга. Каждое украшение проходит контроль качества и приезжает к вам в фирменной упаковке.',
  'Заказывайте онлайн с доставкой по всей стране или забирайте в магазинах сети. Если украшение не подошло — вернём или обменяем его в течение 30 дней.',
]

interface SeoTextBlockProps {
  title?: string
  paragraphs?: string[]
}

export default function SeoTextBlock({
  title = HOME_TITLE,
  paragraphs = HOME_PARAGRAPHS,
}: SeoTextBlockProps) {
  return (
    <section className="au-seo">
      <div className="au-container">
        <h2>{title}</h2>
        <div className="au-seo-cols">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </div>
    </section>
  )
}
