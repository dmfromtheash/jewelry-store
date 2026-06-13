/**
 * AURELIA — Home Page (placeholder)
 *
 * Этап 1 заглушка: подтверждает что проект поднялся и design tokens работают.
 * TODO [Этап 5]: заменить на полноценную главную страницу:
 *   - главный баннер (au-ph--hero)
 *   - категории-кружочки
 *   - подборки товаров
 *   - промо-блоки
 *   - benefits strip
 */

export default function HomePage() {
  return (
    <div className="au-container">
      <div className="home-stub">
        <div className="home-stub__logo">AURELIA</div>
        <div className="home-stub__tagline">Bijouterie without limits</div>
        <p className="home-stub__note">
          Проект запущен. Header и Footer подключены. Следующий этап — главная страница.
        </p>
      </div>

      <style>{`
        .home-stub {
          padding: 80px 0;
          text-align: center;
        }
        .home-stub__logo {
          font-family: var(--au-font-display);
          font-size: 44px;
          font-weight: 600;
          letter-spacing: 0.34em;
          text-indent: 0.34em;
          color: var(--au-ink);
          margin-bottom: 10px;
        }
        .home-stub__tagline {
          font-family: var(--au-font-ui);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.32em;
          text-indent: 0.32em;
          text-transform: uppercase;
          color: var(--au-muted);
          margin-bottom: 32px;
        }
        .home-stub__note {
          font-family: var(--au-font-ui);
          font-size: 14px;
          color: var(--au-muted);
          margin: 0 auto;
          max-width: 400px;
          line-height: 1.6;
        }
      `}</style>
    </div>
  )
}
