/**
 * AURELIA — Admin product form (Этап 26I)
 *
 * Shared server-rendered form for creating and editing a catalog product. No
 * client JS — it posts to a server action (create or update). Built entirely from
 * the existing admin/auth UI primitives (.au-field / .au-adm-* / .au-btn); it does
 * NOT touch the storefront or its product cards. Images and variants are managed
 * elsewhere (26F) and are intentionally absent here.
 */

import Link from 'next/link'
import type { AdminCategoryOption, AdminProductForEdit } from '../../../../src/lib/admin/catalog'

const ERROR_MESSAGES: Record<string, string> = {
  name: 'Укажите название товара.',
  slug: 'Slug должен быть из латинских букв в нижнем регистре, цифр и дефисов (например, koltso-volna).',
  category: 'Выберите категорию.',
  status: 'Выберите статус.',
  price: 'Для товара «в наличии» укажите корректную цену больше нуля.',
  duplicate: 'Товар с таким slug уже существует — выберите другой.',
}

interface ProductFormProps {
  /** Server action handling the submit (create or update). */
  action: (formData: FormData) => Promise<void>
  submitLabel: string
  categories: AdminCategoryOption[]
  /** Validation error code from the ?err= query param, if any. */
  errorCode?: string
  /** Present in edit mode — pre-fills the fields. */
  product?: AdminProductForEdit
}

export function ProductForm({
  action,
  submitLabel,
  categories,
  errorCode,
  product,
}: ProductFormProps) {
  const message = errorCode ? ERROR_MESSAGES[errorCode] : undefined
  // Price is stored in minor units (kopecks); show whole RUB in the input.
  const priceValue = product?.price != null ? String(product.price / 100) : ''

  return (
    <form action={action} className="au-adm-form au-adm-card">
      {product && <input type="hidden" name="id" value={product.id} />}

      {message && (
        <p className="au-adm-login-error" role="alert">
          {message}
        </p>
      )}

      <div className="au-field">
        <label htmlFor="au-product-name">Название *</label>
        <input
          id="au-product-name"
          name="name"
          type="text"
          required
          defaultValue={product?.name ?? ''}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-slug">Slug *</label>
        <input
          id="au-product-slug"
          name="slug"
          type="text"
          required
          pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
          placeholder="koltso-volna"
          defaultValue={product?.slug ?? ''}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-category">Категория *</label>
        <select id="au-product-category" name="categoryId" required defaultValue={product?.categoryId ?? ''}>
          <option value="" disabled>
            — выберите категорию —
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="au-field">
        <label htmlFor="au-product-categoryLabel">Подпись на карточке</label>
        <input
          id="au-product-categoryLabel"
          name="categoryLabel"
          type="text"
          placeholder="Серьги · позолота (пусто — название категории)"
          defaultValue={product?.categoryLabel ?? ''}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-status">Статус *</label>
        <select id="au-product-status" name="status" required defaultValue={product?.status ?? 'available'}>
          <option value="available">В наличии</option>
          <option value="coming_soon">Скоро в продаже</option>
        </select>
      </div>

      <div className="au-field">
        <label htmlFor="au-product-price">Цена, ₽</label>
        <input
          id="au-product-price"
          name="price"
          type="text"
          inputMode="decimal"
          placeholder="2490"
          defaultValue={priceValue}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-sku">Артикул</label>
        <input
          id="au-product-sku"
          name="sku"
          type="text"
          defaultValue={product?.sku ?? ''}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-brand">Бренд</label>
        <input
          id="au-product-brand"
          name="brand"
          type="text"
          defaultValue={product?.brand ?? ''}
        />
      </div>

      <div className="au-field">
        <label htmlFor="au-product-tag">Бейдж</label>
        <input
          id="au-product-tag"
          name="tag"
          type="text"
          placeholder="New / Хит"
          defaultValue={product?.tag ?? ''}
        />
      </div>

      <div className="au-field au-adm-form-check">
        <label htmlFor="au-product-tagGold">
          <input
            id="au-product-tagGold"
            name="tagGold"
            type="checkbox"
            defaultChecked={product?.tagGold ?? false}
          />
          Золотой бейдж
        </label>
      </div>

      <div className="au-field">
        <label htmlFor="au-product-description">Описание</label>
        <textarea
          id="au-product-description"
          name="description"
          rows={4}
          defaultValue={product?.description ?? ''}
        />
      </div>

      <div className="au-adm-form-actions">
        <button className="au-btn au-btn--primary" type="submit">
          {submitLabel}
        </button>
        <Link className="au-btn au-btn--ghost" href="/admin/catalog">
          Отмена
        </Link>
      </div>
    </form>
  )
}
