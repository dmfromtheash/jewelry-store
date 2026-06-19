'use client'

/**
 * AURELIA — LoginModal (client)
 * Source: docs/design/aurelia-prototype/06-07 Auth Modals.html
 * UI only: the form does not submit anywhere (preventDefault).
 */

interface LoginModalProps {
  onClose: () => void
  onSwitch: () => void
}

export default function LoginModal({ onClose, onSwitch }: LoginModalProps) {
  return (
    <div className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-login-title">
      <button className="au-modal-close" type="button" aria-label="Закрити" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <div className="au-modal-brand">AURELIA</div>
      <h2 id="au-login-title">Вхід в особистий кабінет</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="au-field">
          <label htmlFor="au-login-email">E-mail</label>
          <input id="au-login-email" type="email" placeholder="you@example.com" autoComplete="email" autoFocus />
        </div>
        <div className="au-field">
          <label htmlFor="au-login-pass">Пароль</label>
          <input id="au-login-pass" type="password" placeholder="••••••••" autoComplete="current-password" />
        </div>
        <button className="au-btn au-btn--primary au-btn--block" type="submit">
          Увійти
        </button>
      </form>

      <div className="au-modal-aux">
        <a href="#" onClick={(e) => e.preventDefault()}>
          Забули пароль?
        </a>
      </div>
      <div className="au-modal-switch">
        Немає акаунту?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
        >
          Зареєструватися
        </a>
      </div>
    </div>
  )
}
