/**
 * AURELIA — Catalog accessors (Этап 8A)
 *
 * Pure read helpers over the static mock catalog (src/data/products.ts).
 * Frontend-only: no backend, API, DB or caching — just array lookups.
 */

import { products } from '../../data/products'
import type { CategorySlug, Product, ProductStatus, ProductSpec, ProductImageRef } from './types'

export type { CategorySlug, Product, ProductStatus, ProductSpec, ProductImageRef }
export * from './search'
export * from './availability'

export function getAllProducts(): Product[] {
  return products
}

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((product) => product.slug === slug)
}

export function getProductsByCategorySlug(categorySlug: CategorySlug): Product[] {
  return products.filter((product) => product.categorySlug === categorySlug)
}

export function getAllProductSlugs(): string[] {
  return products.map((product) => product.slug)
}

/** "2 490 ₴" — UAH with thin grouping, frontend display only. */
export function formatPrice(price: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(price)} ₴`
}

/** Russian plural for the category count, e.g. "6 товаров" / "1 товар". */
export function productCountLabel(count: number): string {
  const mod10 = count % 10
  const mod100 = count % 100
  let word = 'товаров'
  if (mod10 === 1 && mod100 !== 11) word = 'товар'
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) word = 'товара'
  return `${count} ${word}`
}
