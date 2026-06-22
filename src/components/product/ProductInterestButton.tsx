'use client'

/**
 * AURELIA — ProductInterestButton (client) — Этап 69A
 *
 * "Повідомити, коли буде доступно" for an unavailable product. A logged-in customer registers
 * interest (recorded server-side); a guest is asked to log in. HONEST by design: NOTHING is
 * emailed and no notification is ever delivered (no email provider) — the success copy says so
 * and never promises a real message. Reuses ONLY existing classes (au-btn / au-prod-notify /
 * au-co-note / au-field-error) — no new design/CSS.
 */

import { useState, useTransition } from 'react'
import { addProductInterestAction } from '../../lib/customer/product-interest-actions'

export default function ProductInterestButton({ slug }: { slug: string }) {
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    setMessage(null)
    setIsError(false)
    startTransition(async () => {
      const result = await addProductInterestAction(slug)
      if (result.ok) {
        setDone(true)
      } else {
        setIsError(true)
        setMessage(result.error)
      }
    })
  }

  if (done) {
    return (
      <p className="au-co-note" role="status">
        Додано до списку очікування. Листи поки не надсилаються (поштовий сервіс не підключено) —
        стежте за наявністю в особистому кабінеті.
      </p>
    )
  }

  return (
    <>
      <button
        className="au-btn au-btn--ghost au-btn--block au-prod-notify"
        type="button"
        onClick={handleClick}
        disabled={pending}
      >
        {pending ? 'Зачекайте…' : 'Повідомити, коли буде доступно'}
      </button>
      {message && (
        <p className={isError ? 'au-field-error' : 'au-co-note'} role={isError ? 'alert' : 'status'}>
          {message}
        </p>
      )}
    </>
  )
}
