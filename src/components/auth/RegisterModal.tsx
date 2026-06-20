'use client'

/**
 * AURELIA — RegisterModal (client) — real form (Этап 47A)
 * Source markup: docs/design/aurelia-prototype/06-07 Auth Modals.html (UNCHANGED
 * layout/classes). Submits to registerCustomerAction; on success the customer is
 * logged in immediately, the modal closes and server components refresh. Field
 * + general errors are shown inline (Ukrainian). The optional phone field reuses
 * the existing au-field markup.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { registerCustomerAction } from '../../lib/customer/actions'
import type { CustomerFieldErrors } from '../../lib/customer/validate'

interface RegisterModalProps {
  onClose: () => void
  onSwitch: () => void
}

export default function RegisterModal({ onClose, onSwitch }: RegisterModalProps) {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', passwordConfirm: '' })
  const [errors, setErrors] = useState<CustomerFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setGeneralError(null)
    setErrors({})
    const result = await registerCustomerAction({
      name: form.name || undefined,
      email: form.email,
      phone: form.phone || undefined,
      password: form.password,
      passwordConfirm: form.passwordConfirm,
    })
    if (result.ok) {
      onClose()
      startTransition(() => router.refresh())
      return
    }
    setErrors(result.fieldErrors ?? {})
    setGeneralError(result.error)
  }

  return (
    <div className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-register-title">
      <button className="au-modal-close" type="button" aria-label="Закрити" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <div className="au-modal-brand">AURELIA</div>
      <h2 id="au-register-title">Реєстрація</h2>

      <form onSubmit={handleSubmit} noValidate>
        <div className="au-field">
          <label htmlFor="au-reg-name">Імʼя</label>
          <input
            id="au-reg-name"
            name="name"
            type="text"
            placeholder="Як до вас звертатися"
            autoComplete="name"
            autoFocus
            value={form.name}
            onChange={set('name')}
          />
          {errors.name && <p className="au-field-error">{errors.name}</p>}
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-email">E-mail</label>
          <input
            id="au-reg-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={form.email}
            onChange={set('email')}
          />
          {errors.email && errors.email.trim() && <p className="au-field-error">{errors.email}</p>}
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-phone">Телефон</label>
          <input
            id="au-reg-phone"
            name="phone"
            type="tel"
            placeholder="+380 __ ___ __ __"
            autoComplete="tel"
            value={form.phone}
            onChange={set('phone')}
          />
          {errors.phone && <p className="au-field-error">{errors.phone}</p>}
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass">Пароль</label>
          <input
            id="au-reg-pass"
            name="password"
            type="password"
            placeholder="Мінімум 8 символів"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
          {errors.password && <p className="au-field-error">{errors.password}</p>}
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass2">Повторіть пароль</label>
          <input
            id="au-reg-pass2"
            name="passwordConfirm"
            type="password"
            placeholder="Ще раз"
            autoComplete="new-password"
            value={form.passwordConfirm}
            onChange={set('passwordConfirm')}
          />
          {errors.passwordConfirm && <p className="au-field-error">{errors.passwordConfirm}</p>}
        </div>
        {generalError && (
          <p className="au-field-error" role="alert">
            {generalError}
          </p>
        )}
        <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
          {pending ? 'Створюємо акаунт…' : 'Зареєструватися'}
        </button>
      </form>

      <div className="au-modal-switch">
        Вже є акаунт?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
        >
          Увійти
        </a>
      </div>
    </div>
  )
}
