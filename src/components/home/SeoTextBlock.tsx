/**
 * AURELIA — SEO text block (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html (.au-seo)
 *
 * Light informational block: a heading and a few paragraphs flowing across
 * columns on wide screens. Defaults to the home-page copy; pass `title` /
 * `paragraphs` to reuse it on other pages (e.g. category).
 */

const HOME_TITLE = 'AURELIA — біжутерія без меж'
const HOME_PARAGRAPHS = [
  'AURELIA — інтернет-магазин сучасної біжутерії та аксесуарів. Ми збираємо прикраси, які легко носити щодня й приємно дарувати: сережки, каблучки, браслети, ланцюжки, кулони та готові набори.',
  'У каталозі — лаконічні базові форми та виразні акцентні моделі з покриттям із позолоти й родію, вставками зі скла, емалі та штучних перлів. Кожна прикраса проходить контроль якості та приїжджає до вас у фірмовому пакуванні.',
  'Замовляйте онлайн із доставкою по всій країні або забирайте в магазинах мережі. Якщо прикраса не підійшла — повернемо або обміняємо її протягом 30 днів.',
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
