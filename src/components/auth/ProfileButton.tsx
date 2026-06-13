'use client'

import { useAuthModal } from './AuthModalProvider'

/**
 * AURELIA — ProfileButton (client)
 * The header profile icon. Opens the login modal via auth context, so the
 * Header itself can stay a server component.
 */

export default function ProfileButton() {
  const { openLogin } = useAuthModal()

  return (
    <button className="au-icon-btn" type="button" aria-label="Профиль" onClick={openLogin}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M4.5 20c1.4-3.4 4.2-5 7.5-5s6.1 1.6 7.5 5" />
      </svg>
    </button>
  )
}
