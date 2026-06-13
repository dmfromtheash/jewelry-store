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
      <button className="au-modal-close" type="button" aria-label="Закрыть" onClick={onClose}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>

      <div className="au-modal-brand">AURELIA</div>
      <h2 id="au-register-title">Регистрация</h2>

      <form onSubmit={(e) => e.preventDefault()}>
        <div className="au-field">
          <label htmlFor="au-reg-name">Имя</label>
          <input id="au-reg-name" type="text" placeholder="Как к вам обращаться" autoComplete="name" autoFocus />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-email">E-mail</label>
          <input id="au-reg-email" type="email" placeholder="you@example.com" autoComplete="email" />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass">Пароль</label>
          <input id="au-reg-pass" type="password" placeholder="Минимум 8 символов" autoComplete="new-password" />
        </div>
        <div className="au-field">
          <label htmlFor="au-reg-pass2">Повторите пароль</label>
          <input id="au-reg-pass2" type="password" placeholder="Ещё раз" autoComplete="new-password" />
        </div>
        <button className="au-btn au-btn--primary au-btn--block" type="submit">
          Зарегистрироваться
        </button>
      </form>

      <div className="au-modal-switch">
        Уже есть аккаунт?{' '}
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault()
            onSwitch()
          }}
        >
          Войти
        </a>
      </div>
    </div>
  )
}
