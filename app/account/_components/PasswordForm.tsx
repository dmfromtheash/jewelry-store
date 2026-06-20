'use client'

/**
 * AURELIA — PasswordForm (client) — Этап 47B
 * Changes the logged-in customer's password via changeCustomerPasswordAction:
 * requires the current password, a new password (min 8), and a confirmation.
 * Errors are generic and never echo any password. Uses ONLY existing classes
 * (au-field / au-field-error / au-btn / au-co-note) — no new design/CSS. On
 * success it clears the inputs and refreshes server components.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changeCustomerPasswordAction } from '../../../src/lib/customer/actions'
import type { PasswordChangeFieldErrors } from '../../../src/lib/customer/validate'

const EMPTY = { currentPassword: '', newPassword: '', newPasswordConfirm: '' }

export default function PasswordForm() {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState<PasswordChangeFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [changed, setChanged] = useState(false)
  const [pending, startTransition] = useTransition()

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
    setChanged(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setGeneralError(null)
    setChanged(false)
    const result = await changeCustomerPasswordAction(form)
    if (result.ok) {
      setForm(EMPTY)
      setChanged(true)
      startTransition(() => router.refresh())
      return
    }
    setErrors(result.fieldErrors ?? {})
    setGeneralError(result.error)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="au-field">
        <label htmlFor="au-acc-cur-pass">Поточний пароль</label>
        <input
          id="au-acc-cur-pass"
          name="currentPassword"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          value={form.currentPassword}
          onChange={set('currentPassword')}
        />
        {errors.currentPassword && errors.currentPassword.trim() && (
          <p className="au-field-error">{errors.currentPassword}</p>
        )}
      </div>
      <div className="au-field">
        <label htmlFor="au-acc-new-pass">Новий пароль</label>
        <input
          id="au-acc-new-pass"
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
        <label htmlFor="au-acc-new-pass2">Повторіть новий пароль</label>
        <input
          id="au-acc-new-pass2"
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
      {changed && (
        <p className="au-co-note" role="status">
          Пароль змінено.
        </p>
      )}
      <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
        {pending ? 'Зберігаємо…' : 'Змінити пароль'}
      </button>
    </form>
  )
}
