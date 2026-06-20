'use client'

import Link from 'next/link'
import { useAuthModal } from './AuthModalProvider'

/**
 * AURELIA — ProfileButton (client) — Этап 47A
 * The header profile icon. Logged OUT: opens the login modal via auth context
 * (unchanged behaviour). Logged IN: becomes a link to the account page using the
 * SAME icon + classes (design unchanged) so the customer can reach their cabinet.
 *
 * `accountName` is the only customer data passed to the client — a safe display
 * label (name or email), resolved on the server in the Header.
 */

export default function ProfileButton({ accountName }: { accountName?: string | null }) {
  const { openLogin } = useAuthModal()

  const icon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
    </svg>
  )

  if (accountName) {
    return (
      <Link className="au-icon-btn" href="/account" aria-label={`Кабінет: ${accountName}`}>
        {icon}
      </Link>
    )
  }

  return (
    <button className="au-icon-btn" type="button" aria-label="Профіль" onClick={openLogin}>
      {icon}
    </button>
  )
}
