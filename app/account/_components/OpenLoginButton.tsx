'use client'

import { useAuthModal } from '../../../src/components/auth/AuthModalProvider'

/**
 * AURELIA — OpenLoginButton (client) — Этап 47A
 * Tiny client trigger used by the (server) account page's not-logged-in prompt.
 * Opens the existing login modal via the shared auth context — no new UI.
 */

export default function OpenLoginButton({ children }: { children: React.ReactNode }) {
  const { openLogin } = useAuthModal()
  return (
    <button className="au-btn au-btn--primary" type="button" onClick={openLogin}>
      {children}
    </button>
  )
}
