'use client'

/**
 * AURELIA — HelpQuestionForm (client) — Этап 79A, contained CTA Этап 87A
 *
 * The public "Поставити запитання" form for the Help Center. Submits to the server action,
 * which validates + stores the question as `new` for admin triage (never auto-published).
 * HONEST by design: the success copy says answers are handled manually and that automatic
 * emails are not sent. Reuses ONLY existing form classes (au-co-section / au-field / au-btn /
 * au-co-note / au-field-error) — no new design system. Includes a hidden honeypot field.
 *
 * Этап 87A: the form starts collapsed behind a contained "Не знайшли відповідь?" CTA so the
 * page no longer ends in a wall of always-open inputs. Clicking «Поставити запитання» reveals
 * the same form — validation, honeypot, throttle, consent and no-send copy are unchanged.
 */

import { useState } from 'react'
import { submitHelpQuestion } from '../../lib/help/question-actions'
import { validateHelpQuestion, hasHelpQuestionErrors } from '../../lib/help/question-validate'
import type { HelpQuestionFieldErrors } from '../../lib/help/question-types'
import type { HelpCategory } from '../../lib/help/types'

export default function HelpQuestionForm({
  categories,
  defaultCategory,
}: {
  categories: HelpCategory[]
  defaultCategory?: string
}) {
  const [categorySlug, setCategorySlug] = useState(defaultCategory ?? categories[0]?.slug ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<HelpQuestionFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)
  const [revealed, setRevealed] = useState(false)

  if (done) {
    return (
      <div className="au-co-section" role="status">
        <p className="au-co-line-name">Дякуємо! Ваше запитання отримано.</p>
        <p className="au-co-note">
          Ми відповідаємо вручну. Автоматичні листи поки не надсилаються — поштовий сервіс не
          підключено.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    const payload = { categorySlug, subject, message, authorName, email, consent, website }
    const { errors: clientErrors } = validateHelpQuestion(payload)
    if (hasHelpQuestionErrors(clientErrors)) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const result = await submitHelpQuestion(payload)
      if (result.ok) {
        setDone(true)
        return
      }
      setErrors(result.fieldErrors ?? {})
      setGeneralError(result.error)
    } catch {
      setGeneralError('Не вдалося надіслати запитання. Спробуйте ще раз.')
    } finally {
      setPending(false)
    }
  }

  // Collapsed by default: a calm, contained CTA instead of an always-open form.
  if (!revealed) {
    return (
      <section className="au-help-ask" aria-label="Поставити запитання">
        <h3 className="au-help-ask-title">Не знайшли відповідь?</h3>
        <p className="au-help-ask-text">
          Поставте запитання — ми відповідаємо вручну. Автоматичні листи поки не надсилаються
          (поштовий сервіс не підключено).
        </p>
        <button
          className="au-btn au-btn--primary"
          type="button"
          onClick={() => setRevealed(true)}
        >
          Поставити запитання
        </button>
      </section>
    )
  }

  return (
    <form className="au-co-section au-help-form" onSubmit={handleSubmit} noValidate>
      <h3 className="au-co-section-title">Поставити запитання</h3>

      <div className="au-field">
        <label htmlFor="hq-cat">Категорія</label>
        <select
          id="hq-cat"
          className="au-co-select"
          value={categorySlug}
          onChange={(e) => setCategorySlug(e.target.value)}
          aria-invalid={!!errors.categorySlug}
        >
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.categorySlug && <p className="au-field-error">{errors.categorySlug}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="hq-subject">Тема</label>
        <input
          id="hq-subject"
          type="text"
          placeholder="Коротко про що запитання"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-invalid={!!errors.subject}
        />
        {errors.subject && <p className="au-field-error">{errors.subject}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="hq-message">Запитання</label>
        <textarea
          id="hq-message"
          className="au-co-select"
          rows={4}
          placeholder="Опишіть запитання детальніше"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-invalid={!!errors.message}
        />
        {errors.message && <p className="au-field-error">{errors.message}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="hq-name">Імʼя (необовʼязково)</label>
        <input
          id="hq-name"
          type="text"
          placeholder="Як до вас звертатися"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          aria-invalid={!!errors.authorName}
        />
        {errors.authorName && <p className="au-field-error">{errors.authorName}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="hq-email">E-mail для відповіді (необовʼязково)</label>
        <input
          id="hq-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="au-field-error">{errors.email}</p>}
      </div>

      {email.trim() && (
        <div className="au-field au-help-consent">
          <label>
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />{' '}
            Погоджуюсь, щоб зі мною звʼязалися щодо цього запитання.
          </label>
          {errors.consent && <p className="au-field-error">{errors.consent}</p>}
        </div>
      )}

      {/* Honeypot — visually hidden; bots fill it, humans never do. */}
      <div className="au-hp" aria-hidden="true">
        <label htmlFor="hq-website">Залиште це поле порожнім</label>
        <input
          id="hq-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {generalError && (
        <p className="au-field-error" role="alert">
          {generalError}
        </p>
      )}

      <button className="au-btn au-btn--primary" type="submit" disabled={pending}>
        {pending ? 'Надсилаємо…' : 'Надіслати запитання'}
      </button>
      <p className="au-co-note">
        Запитання обробляється вручну. Email-сповіщення поки не надсилаються (поштовий сервіс не
        підключено).
      </p>
    </form>
  )
}
