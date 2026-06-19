import Placeholder from '../ui/Placeholder'

/**
 * AURELIA — PromoBlocks / "Специальные подборки" (server component)
 * Source: docs/design/aurelia-prototype/02 Home Page.html
 *
 * Three square promo placeholders. Like the rest of the home page they
 * carry both admin ("Добавить промо-блок") and customer ("Скоро появится
 * контент") states; CSS [data-view] decides which shows.
 */

const PROMO_COUNT = 3

export default function PromoBlocks() {
  return (
    <section className="au-section">
      <div className="au-section-head au-container">
        <h2 className="au-section-title">Спеціальні добірки</h2>
      </div>
      <div className="au-container au-home-squares">
        {Array.from({ length: PROMO_COUNT }).map((_, i) => (
          <Placeholder
            key={`promo-${i}`}
            variant="square"
            adminTitle="Добавить промо-блок"
            adminSub="Для пользователей: скоро появится контент"
            adminHint="Нажмите, чтобы загрузить квадратное изображение"
            customerTitle="Незабаром зʼявиться контент"
            withRule
          />
        ))}
      </div>
    </section>
  )
}
