'use client'

/**
 * AURELIA — AvailabilityNotifyForm (client) — Этап 79A
 *
 * "Повідомити про наявність" for an unavailable product. Captures an email (guest or logged-in)
 * + explicit consent and records a back-in-stock interest. HONEST by design: it stores the
 * request only — NOTHING is emailed, no notification is delivered, and it is NOT a reservation
 * or a guarantee of availability. Reuses ONLY existing classes (au-co-section / au-field /
 * au-btn / au-co-note / au-field-error) — no new design. Includes a hidden honeypot.
 */

import { useState } from 'react'
import InfoHint from '../ui/InfoHint'
import { submitAvailabilityInterest } from '../../lib/availability/actions'
import { validateAvailabilityInterest, hasAvailabilityInterestErrors } from '../../lib/availability/validate'
import type { AvailabilityInterestFieldErrors } from '../../lib/availability/types'

export default function AvailabilityNotifyForm({
  productSlug,
  variantId,
}: {
  productSlug: string
  variantId?: string
}) {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  const [errors, setErrors] = useState<AvailabilityInterestFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <p className="au-co-note" role="status">
        Дякуємо! Ваш запит збережено. Це не бронювання та не гарантія наявності — автоматичні листи
        поки не надсилаються (поштовий сервіс не підключено).
      </p>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    const payload = { productSlug, variantId, email, consent, website }
    const { errors: clientErrors } = validateAvailabilityInterest(payload)
    if (hasAvailabilityInterestErrors(clientErrors)) {
      setErrors(clientErrors)
      return
    }
    setErrors({})
    setPending(true)
    try {
      const result = await submitAvailabilityInterest(payload)
      if (result.ok) {
        setDone(true)
        return
      }
      setErrors(result.fieldErrors ?? {})
      setGeneralError(result.error)
    } catch {
      setGeneralError('Не вдалося зберегти запит. Спробуйте ще раз.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="au-co-section au-avail-form" onSubmit={handleSubmit} noValidate>
      <h3 className="au-co-section-title">
        <span className="au-hint-label">
          Повідомити про наявність
          <InfoHint
            text="Ми збережемо ваш запит. Це не бронювання та не гарантія наявності."
            label="Як працює повідомлення про наявність"
            place="right"
          />
        </span>
      </h3>
      <p className="au-co-note">
        Залиште e-mail — ми збережемо ваш запит. Зараз листи не надсилаються (поштовий сервіс не
        підключено), тож це не бронювання та не гарантія наявності.
      </p>

      <div className="au-field">
        <label htmlFor="av-email">E-mail</label>
        <input
          id="av-email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={!!errors.email}
        />
        {errors.email && <p className="au-field-error">{errors.email}</p>}
      </div>

      <div className="au-field au-help-consent">
        <label>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />{' '}
          Погоджуюсь, щоб AURELIA зберегла мій e-mail для цього запиту.
        </label>
        {errors.consent && <p className="au-field-error">{errors.consent}</p>}
      </div>

      {/* Honeypot. */}
      <div className="au-hp" aria-hidden="true">
        <label htmlFor="av-website">Залиште це поле порожнім</label>
        <input
          id="av-website"
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

      <button className="au-btn au-btn--ghost au-btn--block" type="submit" disabled={pending}>
        {pending ? 'Зберігаємо…' : 'Повідомити про наявність'}
      </button>
    </form>
  )
}
