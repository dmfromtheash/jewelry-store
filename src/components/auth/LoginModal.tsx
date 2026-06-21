'use client'

/**
 * AURELIA — LoginModal (client) — real form (Этап 47A)
 * Source markup: docs/design/aurelia-prototype/06-07 Auth Modals.html (UNCHANGED
 * layout/classes). Submits to loginCustomerAction; on success closes the modal
 * and refreshes server components so the Header/account reflect the new session.
 * Errors are generic (no account-existence leak) and Ukrainian.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { loginCustomerAction } from '../../lib/customer/actions'

interface LoginModalProps {
  onClose: () => void
  onSwitch: () => void
}

export default function LoginModal({ onClose, onSwitch }: LoginModalProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const result = await loginCustomerAction({ email, password })
    if (result.ok) {
      onClose()
      startTransition(() => router.refresh())
      return
    }
    setError(result.error)
  }

  return (
    <div className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-login-title">
      <button className="au-modal-close" type="button" aria-label="Закрити" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <div className="au-modal-brand">AURELIA</div>
      <h2 id="au-login-title">Вхід в особистий кабінет</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="au-field">
          <label htmlFor="au-login-email">E-mail</label>
          <input
            id="au-login-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="au-field">
          <label htmlFor="au-login-pass">Пароль</label>
          <input
            id="au-login-pass"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="au-field-error" role="alert">
            {error}
          </p>
        )}
        <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
          {pending ? 'Входимо…' : 'Увійти'}
        </button>
      </form>

      <div className="au-modal-aux">
        {/* Этап 60A: real reset-request route (provider-ready; nothing emailed yet). */}
        <a
          href="/account/recover"
          onClick={() => {
            onClose()
          }}
        >
          Забули пароль?
        </a>
      </div>
      <div className="au-modal-switch">
        Немає акаунту?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
        >
          Зареєструватися
        </a>
      </div>
    </div>
  )
}
