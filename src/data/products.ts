/**
 * AURELIA — Product catalog SEED SOURCE (Этапы 8A → 15D)
 *
 * As of 15D this file is the **seed source / reference**, NOT the runtime
 * catalog. The storefront now reads products from PostgreSQL via Prisma
 * (src/lib/catalog/server.ts); `prisma/seed.ts` imports this array to populate
 * the DB. Keep it in sync if you change seeded products, then re-run db:seed.
 *
 * These are placeholder products: names, prices and specs are mock content. The
 * only brand is AURELIA (the store's own placeholder brand).
 *
 * Rules:
 *   - slug: latin only, unique;
 *   - categorySlug: 'bijouterie' | 'gifts';
 *   - status 'coming-soon' products carry no price (renders "— ₴").
 */

import type { Product } from '../lib/catalog/types'

const COATINGS = ['Позолота', 'Родирование', 'Сталь']

export const products: Product[] = [
  // ---- Бижутерия ----
  {
    slug: 'serogi-kaplya',
    name: 'Серьги AURELIA «Капля»',
    category: 'Серьги · позолота',
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
      'Лёгкие серьги-капли — образец будущего описания товара. Здесь появится рассказ о форме, покрытии и сочетаниях. Текст-заглушка для этапа каталога.',
    specs: [
      { label: 'Тип', value: 'Серьги' },
      { label: 'Покрытие', value: 'Позолота' },
      { label: 'Вставка', value: 'Без вставки' },
      { label: 'Размер', value: '24 мм' },
      { label: 'Вес', value: '3 г (пара)' },
    ],
  },
  {
    slug: 'koltso-volna',
    name: 'Кольцо AURELIA «Волна»',
    category: 'Кольцо · родирование',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 1890,
    sku: 'AU-1002',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description:
      'Тонкое кольцо с волнистой линией — placeholder-описание для витрины каталога AURELIA.',
    specs: [
      { label: 'Тип', value: 'Кольцо' },
      { label: 'Покрытие', value: 'Родирование' },
      { label: 'Размер', value: '16–18' },
      { label: 'Вес', value: '2 г' },
    ],
  },
  {
    slug: 'braslet-zhemchug',
    name: 'Браслет AURELIA «Жемчуг»',
    category: 'Браслет · жемчуг',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 2190,
    sku: 'AU-1003',
    brand: 'AURELIA',
    coatings: COATINGS,
    tag: 'Хит',
    rating: 0,
    reviewsCount: 0,
    description:
      'Браслет с искусственным жемчугом — текст-заглушка описания. Реальный контент появится позже.',
    specs: [
      { label: 'Тип', value: 'Браслет' },
      { label: 'Вставка', value: 'Искусственный жемчуг' },
      { label: 'Длина', value: '17 + 3 см' },
      { label: 'Вес', value: '5 г' },
    ],
  },
  {
    slug: 'tsepochka-luch',
    name: 'Цепочка AURELIA «Луч»',
    category: 'Цепочка · позолота',
    categorySlug: 'bijouterie',
    status: 'available',
    price: 2790,
    sku: 'AU-1004',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description: 'Цепочка плетения «Луч» — placeholder-описание для каталога.',
    specs: [
      { label: 'Тип', value: 'Цепочка' },
      { label: 'Покрытие', value: 'Позолота' },
      { label: 'Длина', value: '45 см' },
      { label: 'Вес', value: '4 г' },
    ],
  },
  {
    slug: 'kulon-gran',
    name: 'Кулон AURELIA «Грань»',
    category: 'Кулон · фианит',
    categorySlug: 'bijouterie',
    status: 'coming-soon',
    price: null,
    sku: 'AU-1005',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Кулон «Грань» скоро появится в продаже. Описание-заглушка для будущего товара.',
  },
  {
    slug: 'serogi-emal',
    name: 'Серьги AURELIA «Эмаль»',
    category: 'Серьги · эмаль',
    categorySlug: 'bijouterie',
    status: 'coming-soon',
    price: null,
    sku: 'AU-1006',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Серьги с цветной эмалью готовятся к запуску. Текст-заглушка описания.',
  },

  // ---- Подарки ----
  {
    slug: 'nabor-serogi-kulon',
    name: 'Набор AURELIA «Серьги + кулон»',
    category: 'Набор серьги + кулон',
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
      'Подарочный набор из серёг и кулона в фирменной упаковке — placeholder-описание.',
    specs: [
      { label: 'Состав', value: 'Серьги + кулон' },
      { label: 'Покрытие', value: 'Позолота' },
      { label: 'Упаковка', value: 'Подарочная коробка AURELIA' },
    ],
  },
  {
    slug: 'nabor-braslet-koltso',
    name: 'Набор AURELIA «Браслет + кольцо»',
    category: 'Набор браслет + кольцо',
    categorySlug: 'gifts',
    status: 'available',
    price: 3490,
    sku: 'AU-2002',
    brand: 'AURELIA',
    coatings: COATINGS,
    rating: 0,
    reviewsCount: 0,
    description:
      'Набор из браслета и кольца — текст-заглушка описания для витрины подарков.',
    specs: [
      { label: 'Состав', value: 'Браслет + кольцо' },
      { label: 'Покрытие', value: 'Родирование' },
      { label: 'Упаковка', value: 'Подарочная коробка AURELIA' },
    ],
  },
  {
    slug: 'sertifikat-podarochnyj',
    name: 'Подарочный сертификат AURELIA',
    category: 'Подарочный сертификат',
    categorySlug: 'gifts',
    status: 'available',
    price: 1000,
    sku: 'AU-2003',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Электронный подарочный сертификат — placeholder-описание. Номинал и условия появятся позже.',
    specs: [
      { label: 'Тип', value: 'Сертификат' },
      { label: 'Срок действия', value: '12 месяцев' },
    ],
  },
  {
    slug: 'nabor-zhemchug',
    name: 'Набор AURELIA «Жемчуг»',
    category: 'Набор «Жемчуг»',
    categorySlug: 'gifts',
    status: 'coming-soon',
    price: null,
    sku: 'AU-2004',
    brand: 'AURELIA',
    rating: 0,
    reviewsCount: 0,
    description:
      'Жемчужный набор скоро появится в продаже. Текст-заглушка описания.',
  },
]
