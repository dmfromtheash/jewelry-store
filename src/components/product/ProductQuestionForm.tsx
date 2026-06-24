'use client'

/**
 * AURELIA — ProductQuestionForm (client) — Этап 79A
 *
 * Lets a visitor ask a question about a product. Logged-in customers get their display name
 * prefilled; guests type a name. On submit it calls the server action, which validates +
 * stores the question as PENDING (admin moderation) — so the UI is honest that the question
 * appears only after it's answered + published. Reuses ONLY existing form classes
 * (au-co-section / au-field / au-btn) — no new design. Includes a hidden honeypot.
 */

import { useState } from 'react'
import InfoHint from '../ui/InfoHint'
import { submitProductQuestion } from '../../lib/product-qa/actions'
import { validateProductQuestion, hasProductQuestionErrors } from '../../lib/product-qa/validate'
import type { ProductQuestionFieldErrors } from '../../lib/product-qa/types'

export default function ProductQuestionForm({
  productSlug,
  initialAuthorName = null,
}: {
  productSlug: string
  initialAuthorName?: string | null
}) {
  const [authorName, setAuthorName] = useState(initialAuthorName ?? '')
  const [body, setBody] = useState('')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<ProductQuestionFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="au-review-form-done" role="status">
        <p className="au-co-line-name">Дякуємо за запитання!</p>
        <p className="au-co-note">
          Запитання надіслано на модерацію — воно зʼявиться після відповіді. Email-сповіщення поки
          не надсилаються.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    const payload = { productSlug, authorName, body, email, consent, website }
    const { errors: clientErrors } = validateProductQuestion(payload, initialAuthorName)
    if (hasProductQuestionErrors(clientErrors)) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const result = await submitProductQuestion(payload)
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

  return (
    <form className="au-co-section au-review-form" onSubmit={handleSubmit} noValidate>
      <h3 className="au-co-section-title">
        <span className="au-hint-label">
          Поставити запитання про товар
          <InfoHint
            text="Запитайте про розмір, матеріал або наявність."
            label="Про запитання щодо товару"
            place="right"
          />
        </span>
      </h3>

      <div className="au-field">
        <label htmlFor="pq-name">Імʼя</label>
        <input
          id="pq-name"
          type="text"
          placeholder="Як вас підписати"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          aria-invalid={!!errors.authorName}
        />
        {errors.authorName && <p className="au-field-error">{errors.authorName}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="pq-body">Запитання</label>
        <textarea
          id="pq-body"
          className="au-co-select"
          rows={3}
          placeholder="Наприклад: який розмір каблучки доступний?"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={!!errors.body}
        />
        {errors.body && <p className="au-field-error">{errors.body}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="pq-email">E-mail для відповіді (необовʼязково)</label>
        <input
          id="pq-email"
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
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{' '}
            Погоджуюсь, щоб зі мною звʼязалися щодо цього запитання.
          </label>
          {errors.consent && <p className="au-field-error">{errors.consent}</p>}
        </div>
      )}

      {/* Honeypot. */}
      <div className="au-hp" aria-hidden="true">
        <label htmlFor="pq-website">Залиште це поле порожнім</label>
        <input
          id="pq-website"
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
        Запитання проходить модерацію перед публікацією. Це не відгук — для оцінки скористайтеся
        формою відгуку вище.
      </p>
    </form>
  )
}
