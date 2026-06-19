/**
 * AURELIA — Product catalog SEED SOURCE (Этапы 8A → 15D; uk-UA 39C)
 *
 * As of 15D this file is the **seed source / reference**, NOT the runtime
 * catalog. The storefront now reads products from PostgreSQL via Prisma
 * (src/lib/catalog/server.ts); `prisma/seed.ts` imports this array to populate
 * the DB. Keep it in sync if you change seeded products.
 *
 * Этап 39C — demo catalog copy localized to Ukrainian (names, category labels,
 * descriptions, specs, coatings, tags). The running local DB is updated in place
 * by `scripts/catalog/localize-catalog-uk.ts` (NOT db:seed — the variant upsert
 * key includes `value`, so a fresh seed would duplicate renamed variants).
 *
 * These are placeholder products: names, prices and specs are mock content. The
 * only brand is AURELIA (the store's own placeholder brand).
 *
 * Rules:
 *   - slug: latin only, unique (URLs depend on it — never change);
 *   - categorySlug: 'bijouterie' | 'gifts';
 *   - status 'coming-soon' products carry no price (renders "— ₴").
 */

import type { Product } from '../lib/catalog/types'

const COATINGS = ['Позолота', 'Родіювання', 'Сталь']

export const products: Product[] = [
  // ---- Біжутерія ----
  {
    slug: 'serogi-kaplya',
    name: 'Сережки AURELIA «Крапля»',
    category: 'Сережки · позолота',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 2490,
    sku: 'AU-1001',
    brand: 'AURELIA',
    coatings: COATINGS,
    tag: 'New',
    tagGold: true,
    rating: 0,
    reviewsCount: 0,
    description:
      'Легкі сережки-краплі — зразок майбутнього опису товару. Тут зʼявиться розповідь про форму, покриття та поєднання. Текст-заглушка для етапу каталогу.',
    specs: [
      { label: 'Тип', value: 'Сережки' },
      { label: 'Покриття', value: 'Позолота' },
      { label: 'Вставка', value: 'Без вставки' },
      { label: 'Розмір', value: '24 мм' },
      { label: 'Вага', value: '3 г (пара)' },
    ],
  },
  {
    slug: 'koltso-volna',
    name: 'Каблучка AURELIA «Хвиля»',
    category: 'Каблучка · родіювання',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 1890,
    sku: 'AU-1002',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description:
      'Тонка каблучка з хвилястою лінією — placeholder-опис для вітрини каталогу AURELIA.',
    specs: [
      { label: 'Тип', value: 'Каблучка' },
      { label: 'Покриття', value: 'Родіювання' },
      { label: 'Розмір', value: '16–18' },
      { label: 'Вага', value: '2 г' },
    ],
  },
  {
    slug: 'braslet-zhemchug',
    name: 'Браслет AURELIA «Перли»',
    category: 'Браслет · перли',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 2190,
    sku: 'AU-1003',
    brand: 'AURELIA',
    coatings: COATINGS,
    tag: 'Хіт',
    rating: 0,
    reviewsCount: 0,
    description:
      'Браслет зі штучними перлами — текст-заглушка опису. Реальний контент зʼявиться пізніше.',
    specs: [
      { label: 'Тип', value: 'Браслет' },
      { label: 'Вставка', value: 'Штучні перли' },
      { label: 'Довжина', value: '17 + 3 см' },
      { label: 'Вага', value: '5 г' },
    ],
  },
  {
    slug: 'tsepochka-luch',
    name: 'Ланцюжок AURELIA «Промінь»',
    category: 'Ланцюжок · позолота',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 2790,
    sku: 'AU-1004',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description: 'Ланцюжок плетіння «Промінь» — placeholder-опис для каталогу.',
    specs: [
      { label: 'Тип', value: 'Ланцюжок' },
      { label: 'Покриття', value: 'Позолота' },
      { label: 'Довжина', value: '45 см' },
      { label: 'Вага', value: '4 г' },
    ],
  },
  {
    slug: 'kulon-gran',
    name: 'Кулон AURELIA «Грань»',
    category: 'Кулон · фіаніт',
    categorySlug: 'bijouterie',
    status: 'coming-soon',
    price: null,
    sku: 'AU-1005',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Кулон «Грань» незабаром зʼявиться в продажу. Опис-заглушка для майбутнього товару.',
  },
  {
    slug: 'serogi-emal',
    name: 'Сережки AURELIA «Емаль»',
    category: 'Сережки · емаль',
    categorySlug: 'bijouterie',
    status: 'coming-soon',
    price: null,
    sku: 'AU-1006',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Сережки з кольоровою емаллю готуються до запуску. Текст-заглушка опису.',
  },

  // ---- Подарунки ----
  {
    slug: 'nabor-serogi-kulon',
    name: 'Набір AURELIA «Сережки + кулон»',
    category: 'Набір сережки + кулон',
    categorySlug: 'gifts',
    status: 'available',
    price: 3990,
    sku: 'AU-2001',
    brand: 'AURELIA',
    coatings: COATINGS,
    tag: 'New',
    tagGold: true,
    rating: 0,
    reviewsCount: 0,
    description:
      'Подарунковий набір із сережок і кулона у фірмовому пакуванні — placeholder-опис.',
    specs: [
      { label: 'Склад', value: 'Сережки + кулон' },
      { label: 'Покриття', value: 'Позолота' },
      { label: 'Пакування', value: 'Подарункова коробка AURELIA' },
    ],
  },
  {
    slug: 'nabor-braslet-koltso',
    name: 'Набір AURELIA «Браслет + каблучка»',
    category: 'Набір браслет + каблучка',
    categorySlug: 'gifts',
    status: 'available',
    price: 3490,
    sku: 'AU-2002',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description:
      'Набір із браслета та каблучки — текст-заглушка опису для вітрини подарунків.',
    specs: [
      { label: 'Склад', value: 'Браслет + каблучка' },
      { label: 'Покриття', value: 'Родіювання' },
      { label: 'Пакування', value: 'Подарункова коробка AURELIA' },
    ],
  },
  {
    slug: 'sertifikat-podarochnyj',
    name: 'Подарунковий сертифікат AURELIA',
    category: 'Подарунковий сертифікат',
    categorySlug: 'gifts',
    status: 'available',
    price: 1000,
    sku: 'AU-2003',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Електронний подарунковий сертифікат — placeholder-опис. Номінал і умови зʼявляться пізніше.',
    specs: [
      { label: 'Тип', value: 'Сертифікат' },
      { label: 'Термін дії', value: '12 місяців' },
    ],
  },
  {
    slug: 'nabor-zhemchug',
    name: 'Набір AURELIA «Перли»',
    category: 'Набір «Перли»',
    categorySlug: 'gifts',
    status: 'coming-soon',
    price: null,
    sku: 'AU-2004',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Перловий набір незабаром зʼявиться в продажу. Текст-заглушка опису.',
  },
]
