/**
 * AURELIA — HelpCenter (server component) — Этап 79A
 *
 * The real Help Center body: intro, a search field (GET form, ?q=), category filter chips
 * (?category=), the filtered FAQ/article list with an honest empty state, and the
 * "Поставити запитання" form. Content is the curated STATIC Help content (no fake claims);
 * the form is the DB-backed part. Reuses the existing info-page + checkout form classes plus
 * a small, isolated au-help-* block in content.css — no global/card/gallery changes.
 */

import Link from 'next/link'
import Breadcrumbs from '../ui/Breadcrumbs'
import HelpQuestionForm from './HelpQuestionForm'
import type { HelpSearchResult } from '../../lib/help/search'

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

  return (
    <div className="au-info-page">
      <div className="au-container au-info-inner">
        <Breadcrumbs items={[{ label: 'Головна', href: '/' }, { label: 'Допомога' }]} />

        <h1 className="au-info-title">Допомога</h1>
        {intro && <p className="au-info-intro">{intro}</p>}

        {/* Search (GET — keeps the page statically cacheable per query). */}
        <form className="au-help-search" action="/help" method="get" role="search">
          {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Пошук у довідці…"
            aria-label="Пошук у довідці"
          />
          <button className="au-btn au-btn--primary" type="submit">
            Знайти
          </button>
        </form>

        {/* Category filter chips. */}
        <nav className="au-help-cats" aria-label="Категорії довідки">
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

        {/* Article list / empty state. */}
        {articles.length === 0 ? (
          <div className="au-help-empty">
            <p className="au-info-p">
              За вашим запитом нічого не знайдено. Спробуйте інші слова або поставте запитання нижче.
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

        {/* Ask a question. */}
        <HelpQuestionForm categories={categories} defaultCategory={activeCategory ?? undefined} />
      </div>
    </div>
  )
}
