/**
 * AURELIA — Help Center curated content (Этап 79A)
 *
 * STATIC, curated, Ukrainian-first Help Center content — the v1 source of truth (no DB
 * seeding, per the build rules: "prefer static fallback data in code"). Everything here is
 * HONEST and evergreen: it never invents prices, delivery times, phone numbers, legal terms,
 * or guarantees, and never implies a real payment/provider/delivery/email integration exists.
 * Pre-launch realities are stated plainly ("зараз демо-режим", "буде уточнено перед запуском").
 *
 * Articles are flagged `isDemo` so nothing is misrepresented as final policy. Where content
 * would duplicate a binding info page (delivery/returns), the body points to that page rather
 * than restating terms.
 */

import type { HelpCategory, HelpArticle } from './types'

export const HELP_CATEGORIES: HelpCategory[] = [
  { slug: 'orders', name: 'Замовлення', description: 'Як оформити та відстежити замовлення.', sortOrder: 10 },
  { slug: 'payment', name: 'Оплата', description: 'Способи оплати (зараз демо-режим).', sortOrder: 20 },
  { slug: 'delivery', name: 'Доставка', description: 'Доставка та отримання замовлень.', sortOrder: 30 },
  { slug: 'returns', name: 'Повернення та обмін', description: 'Умови повернення й обміну.', sortOrder: 40 },
  { slug: 'sizing-materials', name: 'Розміри та матеріали', description: 'Як обрати розмір; з чого зроблені прикраси.', sortOrder: 50 },
  { slug: 'care', name: 'Догляд за прикрасами', description: 'Як зберегти вигляд покриттів і вставок.', sortOrder: 60 },
  { slug: 'gifts-packaging', name: 'Подарунки та пакування', description: 'Подарункове пакування та супровід.', sortOrder: 70 },
  { slug: 'account', name: 'Акаунт', description: 'Реєстрація, вхід, особистий кабінет.', sortOrder: 80 },
  { slug: 'availability', name: 'Наявність товару', description: 'Очікування товару та сповіщення про наявність.', sortOrder: 90 },
  { slug: 'promos', name: 'Акції та промокоди', description: 'Як застосувати промокод.', sortOrder: 100 },
]

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'how-to-order',
    categorySlug: 'orders',
    title: 'Як оформити замовлення?',
    body:
      'Додайте прикрасу в кошик і перейдіть до оформлення. Зараз магазин працює в демо-режимі: ' +
      'оформлення доступне, а онлайн-оплату буде підключено перед запуском.',
    keywords: 'кошик оформлення checkout замовлення',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'track-order',
    categorySlug: 'orders',
    title: 'Як дізнатися статус замовлення?',
    body:
      'Якщо ви оформляли замовлення з акаунтом, його статус видно в розділі «Мої замовлення» ' +
      'в особистому кабінеті. Сповіщення на e-mail поки не надсилаються — поштовий сервіс не підключено.',
    keywords: 'статус трекінг замовлення кабінет',
    sortOrder: 20,
    isDemo: true,
  },
  {
    slug: 'payment-methods',
    categorySlug: 'payment',
    title: 'Які способи оплати доступні?',
    body:
      'Перелік способів оплати буде опубліковано перед запуском. Зараз оформлення працює в демо-режимі ' +
      'без реальної онлайн-оплати. Детальніше — на сторінці «Доставка та оплата».',
    keywords: 'оплата картка онлайн демо',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'delivery-options',
    categorySlug: 'delivery',
    title: 'Які є способи доставки?',
    body:
      'Заплановані варіанти отримання (курʼєр, пункти видачі, поштова доставка) буде уточнено перед запуском. ' +
      'Актуальний опис — на сторінці «Доставка та оплата».',
    keywords: 'доставка курʼєр пошта відділення',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'returns-basics',
    categorySlug: 'returns',
    title: 'Чи можна повернути або обміняти прикрасу?',
    body:
      'Планується можливість обміну або повернення протягом встановленого строку після отримання. ' +
      'Фінальні умови буде опубліковано перед запуском — дивіться сторінку «Повернення та обмін».',
    keywords: 'повернення обмін гарантія строк',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'choose-size',
    categorySlug: 'sizing-materials',
    title: 'Як обрати розмір?',
    body:
      'Інформація про розміри зʼявляється в картках товарів у міру наповнення каталогу. Якщо потрібного ' +
      'розміру немає, скористайтеся формою «Поставити запитання» — ми підкажемо.',
    keywords: 'розмір таблиця каблучка браслет',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'materials',
    categorySlug: 'sizing-materials',
    title: 'З яких матеріалів виготовлені прикраси?',
    body:
      'Ми плануємо працювати з акуратними покриттями та вставками — позолота, родіювання, гіпоалергенна ' +
      'сталь, штучні перли та фіаніти. Конкретні матеріали вказані в характеристиках кожного товару.',
    keywords: 'матеріал покриття сталь позолота родіювання перли',
    sortOrder: 20,
    isDemo: true,
  },
  {
    slug: 'jewelry-care',
    categorySlug: 'care',
    title: 'Як доглядати за прикрасами?',
    body:
      'Зберігайте прикраси окремо, уникайте контакту з парфумами, водою та побутовою хімією, ' +
      'протирайте мʼякою тканиною. Рекомендації з догляду за конкретним покриттям буде додано в картки товарів.',
    keywords: 'догляд чистка зберігання покриття',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'gift-packaging',
    categorySlug: 'gifts-packaging',
    title: 'Чи є подарункове пакування?',
    body:
      'Так — фірмове подарункове пакування плануємо додавати до замовлень. Деталі та оформлення подарунка ' +
      'буде уточнено перед запуском.',
    keywords: 'подарунок пакування коробка',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'account-basics',
    categorySlug: 'account',
    title: 'Навіщо потрібен акаунт?',
    body:
      'Акаунт зберігає історію замовлень, обране та збережені пошуки. Реєстрація необовʼязкова — оформити ' +
      'замовлення можна і як гість. Скидання пароля через e-mail поки не активне (поштовий сервіс не підключено).',
    keywords: 'акаунт реєстрація вхід кабінет пароль',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'notify-availability',
    categorySlug: 'availability',
    title: 'Товару немає в наявності — що робити?',
    body:
      'На сторінці товару, який зараз недоступний, можна залишити e-mail у формі «Повідомити про наявність». ' +
      'Ми збережемо ваш запит. Зверніть увагу: автоматичні листи поки не надсилаються — поштовий сервіс не підключено, ' +
      'тож це не бронювання та не гарантія наявності.',
    keywords: 'наявність очікування повідомити сповіщення back in stock',
    sortOrder: 10,
    isDemo: true,
  },
  {
    slug: 'use-promo',
    categorySlug: 'promos',
    title: 'Як застосувати промокод?',
    body:
      'Введіть промокод у відповідне поле під час оформлення замовлення — знижку буде розраховано на сервері ' +
      'й показано в підсумку. Якщо код не діє, перевірте умови акції.',
    keywords: 'промокод знижка акція купон',
    sortOrder: 10,
    isDemo: true,
  },
]

/** Category slugs as an allowlist (used to validate the ask-a-question category field). */
export const HELP_CATEGORY_SLUGS: readonly string[] = HELP_CATEGORIES.map((c) => c.slug)

/** True when the slug is a known Help category. */
export function isHelpCategorySlug(slug: unknown): slug is string {
  return typeof slug === 'string' && HELP_CATEGORY_SLUGS.includes(slug)
}

/** Looks up a category by slug (or undefined). */
export function getHelpCategory(slug: string): HelpCategory | undefined {
  return HELP_CATEGORIES.find((c) => c.slug === slug)
}
