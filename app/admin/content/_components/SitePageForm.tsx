/**
 * AURELIA — Admin info-page form (Этап 46E)
 *
 * Server-rendered, no client JS — posts to updateSitePageAction. Built only from
 * existing admin primitives (.au-adm-card / .au-adm-section-title / .au-field /
 * .au-btn); adds NO CSS and does NOT touch the storefront.
 *
 * Structured, plain-text editing (no raw JSON): top-level title/SEO/intro/notice,
 * then one block per EXISTING section with line-based arrays:
 *   - paragraphs: one per line
 *   - bullets:    one per line
 *   - faq:        "Question :: Answer" per line
 * v1 edits the current sections in place (no add/remove section block — avoids a
 * page builder); arbitrary block types are not possible.
 */

import Link from 'next/link'
import type { AdminSitePageEdit } from '../../../../src/lib/site-pages/server'
import { updateSitePageAction } from '../../../../src/lib/admin/site-pages-actions'

function joinFaq(faq?: { q: string; a: string }[]): string {
  return (faq ?? []).map((f) => `${f.q} :: ${f.a}`).join('\n')
}

export function SitePageForm({ page }: { page: AdminSitePageEdit }) {
  return (
    <form action={updateSitePageAction} className="au-adm-form au-adm-card">
      <input type="hidden" name="slug" value={page.slug} />
      <input type="hidden" name="sectionCount" value={page.sections.length} />

      <div className="au-field">
        <label htmlFor="sp-title">Заголовок *</label>
        <input id="sp-title" name="title" type="text" required maxLength={120} defaultValue={page.title} />
      </div>

      <div className="au-field">
        <label htmlFor="sp-metaTitle">SEO title *</label>
        <input id="sp-metaTitle" name="metaTitle" type="text" required maxLength={160} defaultValue={page.metaTitle} />
      </div>

      <div className="au-field">
        <label htmlFor="sp-metaDescription">SEO description</label>
        <textarea id="sp-metaDescription" name="metaDescription" rows={2} maxLength={300} defaultValue={page.metaDescription} />
      </div>

      <div className="au-field">
        <label htmlFor="sp-intro">Вступление (intro)</label>
        <textarea id="sp-intro" name="intro" rows={2} maxLength={600} defaultValue={page.intro} />
      </div>

      <div className="au-field">
        <label htmlFor="sp-notice">Уведомление (notice)</label>
        <textarea id="sp-notice" name="notice" rows={2} maxLength={300} defaultValue={page.notice} />
      </div>

      <div className="au-field au-adm-form-check">
        <label htmlFor="sp-isPublished">
          <input id="sp-isPublished" name="isPublished" type="checkbox" defaultChecked={page.isPublished} />
          Опубликовать (иначе показывается статичный текст по умолчанию)
        </label>
      </div>

      {page.sections.map((section, i) => (
        <section key={i}>
          <h2 className="au-adm-section-title">Секция {i + 1}</h2>

          <div className="au-field">
            <label htmlFor={`sp-s${i}-heading`}>Заголовок секции</label>
            <input
              id={`sp-s${i}-heading`}
              name={`s${i}.heading`}
              type="text"
              maxLength={160}
              defaultValue={section.heading ?? ''}
            />
          </div>

          <div className="au-field">
            <label htmlFor={`sp-s${i}-paragraphs`}>Абзацы (по одному на строку)</label>
            <textarea
              id={`sp-s${i}-paragraphs`}
              name={`s${i}.paragraphs`}
              rows={3}
              defaultValue={(section.paragraphs ?? []).join('\n')}
            />
          </div>

          <div className="au-field">
            <label htmlFor={`sp-s${i}-bullets`}>Список (по одному пункту на строку)</label>
            <textarea
              id={`sp-s${i}-bullets`}
              name={`s${i}.bullets`}
              rows={3}
              defaultValue={(section.bullets ?? []).join('\n')}
            />
          </div>

          <div className="au-field">
            <label htmlFor={`sp-s${i}-faq`}>FAQ (формат «Вопрос :: Ответ», по одному на строку)</label>
            <textarea
              id={`sp-s${i}-faq`}
              name={`s${i}.faq`}
              rows={3}
              defaultValue={joinFaq(section.faq)}
            />
          </div>
        </section>
      ))}

      <div className="au-adm-form-actions">
        <button className="au-btn au-btn--primary" type="submit">
          Сохранить страницу
        </button>
        <Link className="au-btn au-btn--ghost" href="/admin/content">
          Отмена
        </Link>
      </div>
    </form>
  )
}
