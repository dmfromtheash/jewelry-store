'use client'

/**
 * AURELIA — RegisterModal (client)
 * Source: docs/design/aurelia-prototype/06-07 Auth Modals.html
 * UI only: the form does not submit anywhere (preventDefault).
 */

interface RegisterModalProps {
  onClose: () => void
  onSwitch: () => void
}

export default function RegisterModal({ onClose, onSwitch }: RegisterModalProps) {
  return (
    <div className="au-modal" role="dialog" aria-modal="true" aria-labelledby="au-register-title">
      <button className="au-modal-close" type="button" aria-label="Закрити" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <div className="au-modal-brand">AURELIA</div>
      <h2 id="au-register-title">Реєстрація</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="au-field">
          <label htmlFor="au-reg-name">Імʼя</label>
          <input id="au-reg-name" type="text" placeholder="Як до вас звертатися" autoComplete="name" autoFocus />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-email">E-mail</label>
          <input id="au-reg-email" type="email" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass">Пароль</label>
          <input id="au-reg-pass" type="password" placeholder="Мінімум 8 символів" autoComplete="new-password" />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass2">Повторіть пароль</label>
          <input id="au-reg-pass2" type="password" placeholder="Ще раз" autoComplete="new-password" />
        </div>
        <button className="au-btn au-btn--primary au-btn--block" type="submit">
          Зареєструватися
        </button>
      </form>

      <div className="au-modal-switch">
        Вже є акаунт?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
        >
          Увійти
        </a>
      </div>
    </div>
  )
}
