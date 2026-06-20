/**
 * AURELIA — Site settings defaults & allowlist (Этап 46C — Admin CMS foundation)
 *
 * Single source of truth for the v1 Site Settings: the FIXED key allowlist, each
 * key's admin label / group / validation type, and its default value taken from
 * the current static storefront copy. PUBLIC business content/settings ONLY —
 * never secrets, never markup/layout.
 *
 * Pure & dependency-free (no Prisma, no `server-only`) so it can be shared by the
 * admin validator/action, the idempotent seed, and the verify script alike. The
 * STOREFRONT does NOT read this yet — header/footer/contact integration is 46D.
 */

/** Validation/render kind for a setting value. Mirrors the Prisma SiteSettingType enum. */
export type SiteSettingType = 'text' | 'long_text' | 'email' | 'phone' | 'url'

/** UI grouping in the admin settings form. */
export type SiteSettingGroup =
  | 'brand'
  | 'contacts'
  | 'social'
  | 'footer'
  | 'payment'
  | 'delivery'
  | 'checkout'

export interface SiteSettingDef {
  /** Stable dotted key — the ONLY keys the CMS may ever write. */
  key: string
  /** Russian admin-facing field label. */
  label: string
  group: SiteSettingGroup
  type: SiteSettingType
  /** Default value seeded from current static copy (may be '' for optional fields). */
  defaultValue: string
  /** When true an empty value is accepted (optional contacts/social). */
  optional: boolean
  /** Max accepted value length (characters). */
  maxLength: number
  /** Optional admin placeholder/hint. */
  hint?: string
}

/** Admin labels for the groups (section headings). */
export const SITE_SETTING_GROUP_LABELS: Record<SiteSettingGroup, string> = {
  brand: 'Бренд',
  contacts: 'Контакты',
  social: 'Соцсети',
  footer: 'Футер',
  payment: 'Оплата (чекаут)',
  delivery: 'Доставка (чекаут)',
  checkout: 'Сообщения оформления',
}

/**
 * The v1 allowlist. Defaults reflect the CURRENT visible copy:
 *   - brand/footer values come from src/components/layout/Footer.tsx;
 *   - contact + social fields have NO real value today (the repo intentionally
 *     ships no real contacts), so they default to '' — honest empty, not fake.
 */
export const SITE_SETTING_DEFS: readonly SiteSettingDef[] = [
  // ── Brand ──────────────────────────────────────────────────────────────────
  {
    key: 'brand.displayName',
    label: 'Название бренда',
    group: 'brand',
    type: 'text',
    defaultValue: 'AURELIA',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'brand.tagline',
    label: 'Слоган',
    group: 'brand',
    type: 'text',
    defaultValue: 'Bijouterie without limits',
    optional: true,
    maxLength: 120,
  },
  // ── Footer ─────────────────────────────────────────────────────────────────
  {
    key: 'footer.blurb',
    label: 'Текст о бренде в футере',
    group: 'footer',
    type: 'long_text',
    defaultValue: 'Сучасна біжутерія та аксесуари. Дизайн-прототип інтернет-магазину.',
    optional: true,
    maxLength: 400,
  },
  {
    key: 'footer.copyright',
    label: 'Строка копирайта',
    group: 'footer',
    type: 'text',
    defaultValue: '© 2026 AURELIA. Дизайн-прототип.',
    optional: true,
    maxLength: 160,
  },
  // ── Contacts ───────────────────────────────────────────────────────────────
  {
    key: 'contact.phone',
    label: 'Телефон',
    group: 'contacts',
    type: 'phone',
    defaultValue: '',
    optional: true,
    maxLength: 40,
    hint: '+380 …',
  },
  {
    key: 'contact.email',
    label: 'E-mail',
    group: 'contacts',
    type: 'email',
    defaultValue: '',
    optional: true,
    maxLength: 120,
    hint: 'hello@example.com',
  },
  {
    key: 'contact.address',
    label: 'Адрес',
    group: 'contacts',
    type: 'text',
    defaultValue: '',
    optional: true,
    maxLength: 200,
  },
  {
    key: 'contact.hours',
    label: 'Часы работы',
    group: 'contacts',
    type: 'text',
    defaultValue: '',
    optional: true,
    maxLength: 120,
  },
  // ── Social ─────────────────────────────────────────────────────────────────
  {
    key: 'social.instagram',
    label: 'Instagram (ссылка)',
    group: 'social',
    type: 'url',
    defaultValue: '',
    optional: true,
    maxLength: 200,
    hint: 'https://instagram.com/…',
  },
  {
    key: 'social.facebook',
    label: 'Facebook (ссылка)',
    group: 'social',
    type: 'url',
    defaultValue: '',
    optional: true,
    maxLength: 200,
    hint: 'https://facebook.com/…',
  },
  {
    key: 'social.telegram',
    label: 'Telegram (ссылка)',
    group: 'social',
    type: 'url',
    defaultValue: '',
    optional: true,
    maxLength: 200,
    hint: 'https://t.me/…',
  },
  // ── Payment / checkout (Этап 46F) ───────────────────────────────────────────
  // Editable PUBLIC copy for the MANUAL payment model. Honest by default — no
  // claim of online acquiring. Method KEYS/allowlist (orders/methods.ts) unchanged.
  {
    key: 'checkout.payment.cashOnDeliveryTitle',
    label: 'Оплата при отриманні — название',
    group: 'payment',
    type: 'text',
    defaultValue: 'Оплата при отриманні',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'checkout.payment.cashOnDeliveryDescription',
    label: 'Оплата при отриманні — описание',
    group: 'payment',
    type: 'long_text',
    defaultValue:
      'Оплата при отриманні. Оплата через сайт не списується — розрахунок відбувається при отриманні замовлення.',
    optional: true,
    maxLength: 400,
  },
  {
    key: 'checkout.payment.manualOnlineTitle',
    label: 'Оплата за реквізитами — название',
    group: 'payment',
    type: 'text',
    defaultValue: 'Оплата за реквізитами',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'checkout.payment.manualOnlineDescription',
    label: 'Оплата за реквізитами — описание',
    group: 'payment',
    type: 'long_text',
    defaultValue:
      'Автоматична онлайн-оплата на сайті не підключена. Реквізити для переказу надішлемо після оформлення; оплата підтверджується вручну.',
    optional: true,
    maxLength: 400,
  },
  // ── Delivery / checkout (Этап 46F) ──────────────────────────────────────────
  // Method TITLES only (the select labels). No carrier API — manual choice.
  {
    key: 'checkout.delivery.selfPickupTitle',
    label: 'Самовивіз — название',
    group: 'delivery',
    type: 'text',
    defaultValue: 'Самовивіз',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'checkout.delivery.novaPoshtaTitle',
    label: 'Нова Пошта — название',
    group: 'delivery',
    type: 'text',
    defaultValue: 'Нова Пошта',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'checkout.delivery.ukrposhtaTitle',
    label: 'Укрпошта — название',
    group: 'delivery',
    type: 'text',
    defaultValue: 'Укрпошта',
    optional: false,
    maxLength: 80,
  },
  {
    key: 'checkout.delivery.localCourierTitle',
    label: 'Курʼєрська доставка — название',
    group: 'delivery',
    type: 'text',
    defaultValue: 'Курʼєрська доставка',
    optional: false,
    maxLength: 80,
  },
  // ── Checkout notices (Этап 46F) ─────────────────────────────────────────────
  {
    key: 'checkout.payment.notice',
    label: 'Заметка под кнопкой оформления',
    group: 'checkout',
    type: 'long_text',
    defaultValue: 'Демо-режим: замовлення зберігається, оплата підключається пізніше.',
    optional: true,
    maxLength: 400,
  },
  {
    key: 'checkout.confirmation.paymentNotice',
    label: 'Заметка на странице «Замовлення прийнято»',
    group: 'checkout',
    type: 'long_text',
    defaultValue:
      'Замовлення оформлено в демо-режимі. Оплата підтверджується вручну за обраним способом — зараз з вас нічого не списано.',
    optional: true,
    maxLength: 400,
  },
] as const

/** Ordered list of the groups for stable rendering. */
export const SITE_SETTING_GROUPS: readonly SiteSettingGroup[] = [
  'brand',
  'contacts',
  'social',
  'footer',
  'payment',
  'delivery',
  'checkout',
]

/** All allowlisted keys (used by the verify script for strict checks). */
export const SITE_SETTING_KEYS: readonly string[] = SITE_SETTING_DEFS.map((d) => d.key)

/** Lookup a def by key (undefined for any non-allowlisted key). */
export function getSiteSettingDef(key: string): SiteSettingDef | undefined {
  return SITE_SETTING_DEFS.find((d) => d.key === key)
}
