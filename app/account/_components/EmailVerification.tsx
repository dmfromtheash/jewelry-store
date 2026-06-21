'use client'

/**
 * AURELIA — EmailVerification (client) — Этап 60A
 * Shows the customer's email verification status and a "request verification email"
 * action. HONEST: because no email provider is configured, the request only RECORDS an
 * intent (nothing is delivered) — the copy says so and never claims an email was sent.
 * Uses ONLY existing classes (au-co-* / au-btn / au-field-error) — no new design/CSS.
 */

import { useState, useTransition } from 'react'
import { requestEmailVerificationAction } from '../../../src/lib/customer/recovery'

export default function EmailVerification({ verified }: { verified: boolean }) {
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (verified) {
    return (
      <p className="au-co-note" role="status">
        E-mail підтверджено.
      </p>
    )
  }

  function handleRequest() {
    setError(null)
    startTransition(async () => {
      const result = await requestEmailVerificationAction()
      if (result.ok) setRequested(true)
      else setError(result.error)
    })
  }

  return (
    <div>
      <p className="au-co-line-meta">E-mail ще не підтверджено.</p>
      {requested ? (
        <p className="au-co-note" role="status">
          Запит зафіксовано. Надсилання листів зараз не активне (не підключено поштовий
          сервіс), тож лист із підтвердженням поки не надійде.
        </p>
      ) : (
        <button
          className="au-btn au-btn--ghost au-btn--block"
          type="button"
          onClick={handleRequest}
          disabled={pending}
        >
          {pending ? 'Зачекайте…' : 'Надіслати лист для підтвердження'}
        </button>
      )}
      {error && (
        <p className="au-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
