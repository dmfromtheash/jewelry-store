/**
 * AURELIA — HelpCenter (server component) — Этап 79A, decluttered Этап 87A
 *
 * The real «Вопросы / Ответы» body: a slim header, a search field promoted to the primary
 * entry (GET form, ?q=), secondary category chips (?category=), the filtered FAQ/article list
 * with an honest empty state, a subtle product-Q&A cross-link, and a contained
 * "Не знайшли відповідь?" CTA that reveals the ask-a-question form.
 *
 * Этап 87A cleanup: merged the duplicated intro + hero into one line, made search visually
 * primary, removed the three page-level InfoHints (hero/search/categories — they restated
 * visible copy) and added a clearer answers heading/result summary. Content is the curated
 * STATIC Help content (no fake claims); the form is the DB-backed part. Reuses existing
 * au-info-* / au-help-* / au-co-* classes only — no global/card/gallery changes.
 */

import Link from 'next/link'
import Breadcrumbs from '../ui/Breadcrumbs'
import HelpQuestionForm from './HelpQuestionForm'
import type { HelpSearchResult } from '../../lib/help/search'

const DEFAULT_INTRO =
  'Питання, відповіді та підказки покупцю: оплата, доставка, розміри й догляд за прикрасами. ' +
  'Скористайтесь пошуком або оберіть тему — не знайшли відповідь, поставте запитання.'

function buildHref(category: string | null, query: string): string {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (query) params.set('q', query)
  const qs = params.toString()
  return qs ? `/help?${qs}` : '/help'
}

export default function HelpCenter({
  result,
  intro,
}: {
  result: HelpSearchResult
  intro?: string
}) {
  const { categories, activeCategory, query, articles } = result
  const activeCat = activeCategory ? categories.find((c) => c.slug === activeCategory) : undefined

  // Answers-area heading + a short, plain-language summary of the current state.
  const answersTitle = query ? 'Результати пошуку' : activeCat ? activeCat.name : 'Часті запитання'
  const summary =
    articles.length === 0
      ? null
      : query
        ? `За запитом «${query}» — ${articles.length}`
        : activeCat
          ? `Питань у темі: ${articles.length}`
          : null

  return (
    <div className="au-info-page">
      <div className="au-container au-info-inner">
        <Breadcrumbs items={[{ label: 'Головна', href: '/' }, { label: 'Вопросы / Ответы' }]} />

        {/* Slim header — one intro line (CMS intro or a sensible default). */}
        <h1 className="au-info-title">Вопросы / Ответы</h1>
        <p className="au-info-intro">{intro || DEFAULT_INTRO}</p>

        {/* Search — promoted to the primary entry point in its own labelled panel. */}
        <div className="au-help-search-block">
          <p className="au-help-search-label">Знайти відповідь</p>
          <form className="au-help-search" action="/help" method="get" role="search">
            {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Введіть слово або тему — напр. «доставка», «розмір»…"
              aria-label="Пошук у розділі «Вопросы / Ответы»"
            />
            <button className="au-btn au-btn--primary" type="submit">
              Знайти
            </button>
          </form>
        </div>

        {/* Category chips — clearly secondary navigation. */}
        <nav className="au-help-cats" aria-label="Категорії">
          <Link
            href={buildHref(null, query)}
            className={`au-help-cat${activeCategory ? '' : ' is-active'}`}
          >
            Усі
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={buildHref(c.slug, query)}
              className={`au-help-cat${activeCategory === c.slug ? ' is-active' : ''}`}
            >
              {c.name}
            </Link>
          ))}
        </nav>

        {/* Answers area — the primary content. */}
        <div className="au-help-answers-head">
          <h2 className="au-help-answers-title">{answersTitle}</h2>
          {summary && <span className="au-help-result">{summary}</span>}
        </div>

        {articles.length === 0 ? (
          <div className="au-help-empty">
            <p className="au-info-p">
              За вашим запитом нічого не знайдено. Спробуйте інші слова, оберіть іншу тему або
              поставте запитання нижче.
            </p>
            <p>
              <Link className="au-info-link" href={buildHref(null, '')}>
                Скинути фільтри
              </Link>
            </p>
          </div>
        ) : (
          <div className="au-info-faq au-help-articles">
            {articles.map((a) => (
              <div className="au-info-faq-item" key={a.slug}>
                <p className="au-info-faq-q">{a.title}</p>
                <p className="au-info-faq-a">{a.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Product-specific questions live on the product page — quiet cross-link. */}
        <p className="au-help-xlink">
          Питання про конкретну прикрасу? Запитайте прямо на сторінці товару — у блоці «Запитання
          про товар».
        </p>

        {/* Contained ask-a-question CTA → reveals the form. */}
        <HelpQuestionForm categories={categories} defaultCategory={activeCategory ?? undefined} />
      </div>
    </div>
  )
}
