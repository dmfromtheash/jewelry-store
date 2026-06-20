'use client'

/**
 * AURELIA — ProfileForm (client) — Этап 47B
 * Edits the logged-in customer's name + phone via updateCustomerProfileAction.
 * Email is shown read-only by the account page (immutable login identity in v1).
 * Uses ONLY existing storefront classes (au-field / au-field-error / au-btn / au-co-note)
 * — no new design/CSS. On success it refreshes the server components so the
 * Header greeting + profile reflect the saved values.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateCustomerProfileAction } from '../../../src/lib/customer/actions'
import type { ProfileFieldErrors } from '../../../src/lib/customer/validate'

export default function ProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string
  initialPhone: string
}) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [phone, setPhone] = useState(initialPhone)
  const [errors, setErrors] = useState<ProfileFieldErrors>({})
  const [generalError, setGeneralError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setGeneralError(null)
    setSaved(false)
    const result = await updateCustomerProfileAction({
      name: name || undefined,
      phone: phone || undefined,
    })
    if (result.ok) {
      setSaved(true)
      startTransition(() => router.refresh())
      return
    }
    setErrors(result.fieldErrors ?? {})
    setGeneralError(result.error)
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="au-field">
        <label htmlFor="au-acc-name">Імʼя</label>
        <input
          id="au-acc-name"
          name="name"
          type="text"
          placeholder="Як до вас звертатися"
          autoComplete="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
        />
        {errors.name && <p className="au-field-error">{errors.name}</p>}
      </div>
      <div className="au-field">
        <label htmlFor="au-acc-phone">Телефон</label>
        <input
          id="au-acc-phone"
          name="phone"
          type="tel"
          placeholder="+380 __ ___ __ __"
          autoComplete="tel"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            setSaved(false)
          }}
        />
        {errors.phone && <p className="au-field-error">{errors.phone}</p>}
      </div>
      {generalError && (
        <p className="au-field-error" role="alert">
          {generalError}
        </p>
      )}
      {saved && (
        <p className="au-co-note" role="status">
          Зміни збережено.
        </p>
      )}
      <button className="au-btn au-btn--primary au-btn--block" type="submit" disabled={pending}>
        {pending ? 'Зберігаємо…' : 'Зберегти профіль'}
      </button>
    </form>
  )
}
