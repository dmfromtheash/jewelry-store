'use client'

import { useAuthModal } from './AuthModalProvider'
import LoginModal from './LoginModal'
import RegisterModal from './RegisterModal'

/**
 * AURELIA — AuthModals (client)
 * Renders the dimmed overlay + the active modal (login / register).
 * Clicking the overlay (outside the modal window) closes it.
 */

export default function AuthModals() {
  const { open, close, openLogin, openRegister } = useAuthModal()

  if (!open) return null

  return (
    <div
      className="au-modal-overlay is-open"
      onClick={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      {open === 'login' ? (
        <LoginModal onClose={close} onSwitch={openRegister} />
      ) : (
        <RegisterModal onClose={close} onSwitch={openLogin} />
      )}
    </div>
  )
}
