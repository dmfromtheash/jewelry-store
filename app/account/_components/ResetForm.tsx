'use client'

/**
 * AURELIA — ResetForm (client) — Этап 60A
 * Password-reset confirmation: takes a token (from the URL) + a new password and submits
 * to confirmPasswordResetAction. A missing/used/expired token yields a generic error.
 * On success the user is told to log in with the new password (the reset bumps the
 * session version, so all old sessions are revoked). Uses ONLY existing classes.
 *
 * NOTE: with no email provider, a real user never receives a token link today — this
 * page is provider-ready and is driven directly by the verify script for now.
 */

import { useState } from 'react'
import Link from 'next/link'
import { confirmPasswordResetAction } from '../../../src/lib/customer/recovery'
import type { ResetPasswordFieldErrors } from '../../../src/lib/customer/validate'

const EMPTY = { newPassword: '', newPasswordConfirm: '' }

export default function ResetForm({ token }: { token: string }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<ResetPasswordFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setGeneralError(null)
    setPending(true)
    const result = await confirmPasswordResetAction({ token, ...form })
    setPending(false)
    if (result.ok) {
      setDone(true)
      setForm(EMPTY)
      return
    }
    setErrors(result.fieldErrors ?? {})
    setGeneralError(result.error)
  }

  if (!token) {
    return (
      <p className="au-field-error" role="alert">
        Посилання неповне. Запросіть нове на сторінці відновлення пароля.
      </p>
    )
  }

  if (done) {
    return (
      <div>
        <p className="au-co-note" role="status">
          Пароль оновлено. Усі попередні сесії завершено — увійдіть із новим паролем.
        </p>
        <p className="au-co-info-link">
          <Link href="/account">До кабінету</Link>
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="au-field">
        <label htmlFor="au-reset-pass">Новий пароль</label>
        <input
          id="au-reset-pass"
          name="newPassword"
          type="password"
          placeholder="Мінімум 8 символів"
          autoComplete="new-password"
          value={form.newPassword}
          onChange={set('newPassword')}
        />
        {errors.newPassword && <p className="au-field-error">{errors.newPassword}</p>}
      </div>
      <div className="au-field">
        <label htmlFor="au-reset-pass2">Повторіть новий пароль</label>
        <input
          id="au-reset-pass2"
          name="newPasswordConfirm"
          type="password"
          placeholder="Ще раз"
          autoComplete="new-password"
          value={form.newPasswordConfirm}
          onChange={set('newPasswordConfirm')}
        />
        {errors.newPasswordConfirm && <p className="au-field-error">{errors.newPasswordConfirm}</p>}
      </div>
      {generalError && (
        <p className="au-field-error" role="alert">
          {generalError}
        </p>
      )}
      <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
        {pending ? 'Зберігаємо…' : 'Встановити новий пароль'}
      </button>
    </form>
  )
}
