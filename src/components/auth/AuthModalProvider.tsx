'use client'

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import AuthModals from './AuthModals'

/**
 * AURELIA — Auth modal state (client)
 * Source: docs/design/aurelia-prototype/06-07 Auth Modals.html
 *
 * Holds which auth modal is open and provides open/close/switch actions via
 * context, so a small client trigger in the (server) Header can open the
 * modals without turning the whole Header into a client component.
 *
 * UI only — no real auth, API, sessions or validation. Handles Escape-to-close
 * and body scroll lock while a modal is open.
 */

export type AuthView = 'login' | 'register' | null

interface AuthModalContextValue {
  open: AuthView
  openLogin: () => void
  openRegister: () => void
  close: () => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext)
  if (!ctx) throw new Error('useAuthModal must be used within <AuthModalProvider>')
  return ctx
}

export default function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<AuthView>(null)

  const openLogin = useCallback(() => setOpen('login'), [])
  const openRegister = useCallback(() => setOpen('register'), [])
  const close = useCallback(() => setOpen(null), [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, close])

  return (
    <AuthModalContext.Provider value={{ open, openLogin, openRegister, close }}>
      {children}
      <AuthModals />
    </AuthModalContext.Provider>
  )
}
