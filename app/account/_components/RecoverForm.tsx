'use client'

/**
 * AURELIA — RecoverForm (client) — Этап 60A
 * "Forgot password?" request form. Submits an email to requestPasswordResetAction,
 * which ALWAYS returns a generic acknowledgement (no account-existence leak). HONEST:
 * with no email provider configured nothing is actually delivered — the success copy
 * says so. Uses ONLY existing classes (au-field / au-btn / au-co-note) — no new CSS.
 */

import { useState } from 'react'
import Link from 'next/link'
import { requestPasswordResetAction } from '../../../src/lib/customer/recovery'

export default function RecoverForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await requestPasswordResetAction({ email })
    setPending(false)
    if (result.ok) setDone(true)
    else setError(result.error)
  }

  if (done) {
    return (
      <div>
        <p className="au-co-note" role="status">
          Якщо акаунт із такою адресою існує, ми надішлемо інструкції. Зараз надсилання
          листів не активне (не підключено поштовий сервіс), тож лист поки не надійде.
        </p>
        <p className="au-co-info-link">
          <Link href="/">На головну</Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="au-field">
        <label htmlFor="au-recover-email">E-mail</label>
        <input
          id="au-recover-email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error && (
        <p className="au-field-error" role="alert">
          {error}
        </p>
      )}
      <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
        {pending ? 'Надсилаємо…' : 'Надіслати інструкції'}
      </button>
    </form>
  )
}
