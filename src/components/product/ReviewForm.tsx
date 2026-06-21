'use client'

/**
 * AURELIA — ReviewForm (client) — Этап 59A
 *
 * Lets a visitor submit a product review. Logged-in customers get their display
 * name prefilled; guests type a name. On submit it calls the server action, which
 * validates + stores the review as PENDING (admin moderation) — so the UI is honest
 * that the review will appear only after approval. Reuses the existing checkout/
 * form classes (au-co-section / au-field / au-btn) — no new design system.
 */

import { useState } from 'react'
import { submitProductReview } from '../../lib/reviews/actions'
import { validateReviewInput, hasReviewErrors } from '../../lib/reviews/validate'
import { RATING_MAX, type ReviewFieldErrors } from '../../lib/reviews/types'

export default function ReviewForm({
  productSlug,
  initialAuthorName = null,
}: {
  productSlug: string
  initialAuthorName?: string | null
}) {
  const [rating, setRating] = useState(5)
  const [authorName, setAuthorName] = useState(initialAuthorName ?? '')
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState<ReviewFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="au-review-form-done" role="status">
        <p className="au-co-line-name">Дякуємо за відгук!</p>
        <p className="au-co-note">
          Відгук надіслано на модерацію — він зʼявиться після перевірки.
        </p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)

    const payload = { productSlug, rating, authorName, body }
    // Same rules the server enforces (instant UX). The logged-in name is a server
    // fallback, so the client only flags an empty name when none is provided.
    const { errors: clientErrors } = validateReviewInput(payload, initialAuthorName)
    if (hasReviewErrors(clientErrors)) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const result = await submitProductReview(payload)
      if (result.ok) {
        setDone(true)
        return
      }
      setErrors(result.fieldErrors ?? {})
      setGeneralError(result.error)
    } catch {
      setGeneralError('Не вдалося надіслати відгук. Спробуйте ще раз.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="au-co-section au-review-form" onSubmit={handleSubmit} noValidate>
      <h3 className="au-co-section-title">Залишити відгук</h3>

      <div className="au-field">
        <label htmlFor="rv-rating">Оцінка</label>
        <select
          id="rv-rating"
          className="au-co-select"
          value={rating}
          onChange={(e) => setRating(Number(e.target.value))}
          aria-invalid={!!errors.rating}
        >
          {Array.from({ length: RATING_MAX }, (_, i) => RATING_MAX - i).map((n) => (
            <option key={n} value={n}>
              {'★'.repeat(n)} ({n})
            </option>
          ))}
        </select>
        {errors.rating && <p className="au-field-error">{errors.rating}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="rv-name">Імʼя</label>
        <input
          id="rv-name"
          type="text"
          placeholder="Як вас підписати"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          aria-invalid={!!errors.authorName}
        />
        {errors.authorName && <p className="au-field-error">{errors.authorName}</p>}
      </div>

      <div className="au-field">
        <label htmlFor="rv-body">Відгук</label>
        <textarea
          id="rv-body"
          className="au-co-select"
          rows={4}
          placeholder="Поділіться враженнями про прикрасу"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={!!errors.body}
        />
        {errors.body && <p className="au-field-error">{errors.body}</p>}
      </div>

      {generalError && (
        <p className="au-field-error" role="alert">
          {generalError}
        </p>
      )}

      <button className="au-btn au-btn--primary" type="submit" disabled={pending}>
        {pending ? 'Надсилаємо…' : 'Надіслати відгук'}
      </button>
      <p className="au-co-note">
        Відгук проходить модерацію перед публікацією. Email-сповіщення поки не
        надсилаються.
      </p>
    </form>
  )
}
