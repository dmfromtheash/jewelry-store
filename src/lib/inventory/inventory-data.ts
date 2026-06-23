/**
 * AURELIA — Inventory operations data layer (Этап 70A) — server-only
 *
 * Server-only Prisma reads for the local /admin/inventory operations area. READ helpers only —
 * the mutation (manual stock adjustment) lives in ./inventory-actions. Everything here is REAL
 * data from PostgreSQL: the existing per-product / per-variant `stockQuantity` fields, classified
 * for health, plus the append-only movement ledger.
 *
 * This is NOT a warehouse-management / supplier / procurement / multi-location system: it only
 * describes the single store's stock. No secrets / tokens / cookies / PII are ever selected.
 *
 * Scale: the catalog is demo-scale (a few hundred products). The overview reads products with
 * their variants in ONE bounded query and classifies in memory; the dashboard count helpers are
 * plain bounded `count()`s. No per-row N+1.
 */

import 'server-only'

import { ProductStatus, type StockMovementReason } from '@prisma/client'
import { prisma } from '../db/prisma'
import { classifyStock, isAttentionState, LOW_STOCK_THRESHOLD, type StockState } from './stock-health'
import { STOCK_MOVEMENT_REASON_LABELS } from './movements'

const PRODUCT_LIMIT = 500
const MOVEMENTS_LIMIT = 25

export interface InventoryVariantRow {
  id: string
  name: string
  value: string
  isDefault: boolean
  stockQuantity: number | null
  state: StockState
}

export interface InventoryProductRow {
  id: string
  slug: string
  name: string
  sku: string | null
  status: ProductStatus
  isPublished: boolean
  stockQuantity: number | null
  state: StockState
  /** True when the product is published + available + priced (orderable by STATUS). */
  sellable: boolean
  variants: InventoryVariantRow[]
  trackedVariantCount: number
  /** Whether ANY level (product or one of its variants) is in an attention state. */
  hasAttention: boolean
}

export interface InventorySummary {
  threshold: number
  productsTotal: number
  productsTracked: number
  productsUntracked: number
  productsHealthy: number
  productsLow: number
  productsOut: number
  productsNegative: number
  variantsTotal: number
  variantsTracked: number
  variantsHealthy: number
  variantsLow: number
  variantsOut: number
  variantsNegative: number
  /** Published + available products whose product-level stock is exactly 0 (won't sell). */
  zeroStockPurchasable: number
  /** Published + available products whose product-level stock is 1..threshold. */
  lowStockPurchasable: number
}

export interface InventoryOverview {
  summary: InventorySummary
  products: InventoryProductRow[]
  /** Subset of `products` where some level needs attention (zero / low / negative). */
  problems: InventoryProductRow[]
}

/** Builds the full inventory overview: classified product + variant stock, with a health summary. */
export async function getInventoryOverview(): Promise<InventoryOverview> {
  const rows = await prisma.product.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    take: PRODUCT_LIMIT,
    select: {
      id: true,
      slug: true,
      name: true,
      sku: true,
      status: true,
      isPublished: true,
      price: true,
      stockQuantity: true,
      variants: {
        orderBy: [{ sortOrder: 'asc' }, { value: 'asc' }],
        select: { id: true, name: true, value: true, isDefault: true, stockQuantity: true },
      },
    },
  })

  const summary: InventorySummary = {
    threshold: LOW_STOCK_THRESHOLD,
    productsTotal: rows.length,
    productsTracked: 0,
    productsUntracked: 0,
    productsHealthy: 0,
    productsLow: 0,
    productsOut: 0,
    productsNegative: 0,
    variantsTotal: 0,
    variantsTracked: 0,
    variantsHealthy: 0,
    variantsLow: 0,
    variantsOut: 0,
    variantsNegative: 0,
    zeroStockPurchasable: 0,
    lowStockPurchasable: 0,
  }

  const products: InventoryProductRow[] = rows.map((p) => {
    const state = classifyStock(p.stockQuantity)
    // Product-level health tally.
    if (state === 'untracked') summary.productsUntracked++
    else summary.productsTracked++
    if (state === 'healthy') summary.productsHealthy++
    else if (state === 'low') summary.productsLow++
    else if (state === 'out') summary.productsOut++
    else if (state === 'negative') summary.productsNegative++

    const sellable = p.isPublished && p.status === ProductStatus.available && p.price != null
    if (sellable) {
      if (state === 'out') summary.zeroStockPurchasable++
      else if (state === 'low') summary.lowStockPurchasable++
    }

    let trackedVariantCount = 0
    let variantAttention = false
    const variants: InventoryVariantRow[] = p.variants.map((v) => {
      const vState = classifyStock(v.stockQuantity)
      summary.variantsTotal++
      if (vState !== 'untracked') {
        summary.variantsTracked++
        trackedVariantCount++
      }
      if (vState === 'healthy') summary.variantsHealthy++
      else if (vState === 'low') summary.variantsLow++
      else if (vState === 'out') summary.variantsOut++
      else if (vState === 'negative') summary.variantsNegative++
      if (isAttentionState(vState)) variantAttention = true
      return {
        id: v.id,
        name: v.name,
        value: v.value,
        isDefault: v.isDefault,
        stockQuantity: v.stockQuantity,
        state: vState,
      }
    })

    const hasAttention = isAttentionState(state) || variantAttention
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      sku: p.sku,
      status: p.status,
      isPublished: p.isPublished,
      stockQuantity: p.stockQuantity,
      state,
      sellable,
      variants,
      trackedVariantCount,
      hasAttention,
    }
  })

  const problems = products.filter((p) => p.hasAttention)
  return { summary, products, problems }
}

export interface StockMovementRow {
  id: string
  createdAt: Date
  reason: StockMovementReason
  reasonLabel: string
  level: string
  delta: number
  quantityBefore: number | null
  quantityAfter: number | null
  productId: string | null
  variantId: string | null
  orderCode: string | null
  actorLabel: string | null
  note: string | null
  /** Resolved product name/slug for display (loose id → may be null if the product was deleted). */
  productName: string | null
  productSlug: string | null
}

/**
 * Recent stock movements for the admin feed (newest first). Resolves product names for the loose
 * ids in ONE batched query (no N+1); a deleted product simply shows its id. Note text is
 * already validated/markup-stripped at write time, so it is safe to render.
 */
export async function getRecentStockMovements(limit = MOVEMENTS_LIMIT): Promise<StockMovementRow[]> {
  const movements = await prisma.inventoryStockMovement.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      reason: true,
      level: true,
      delta: true,
      quantityBefore: true,
      quantityAfter: true,
      productId: true,
      variantId: true,
      orderCode: true,
      actorLabel: true,
      note: true,
    },
  })

  const productIds = [...new Set(movements.map((m) => m.productId).filter((id): id is string => !!id))]
  const productMap = new Map<string, { name: string; slug: string }>()
  if (productIds.length) {
    const found = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, slug: true },
    })
    for (const p of found) productMap.set(p.id, { name: p.name, slug: p.slug })
  }

  return movements.map((m) => {
    const product = m.productId ? productMap.get(m.productId) : undefined
    return {
      ...m,
      reasonLabel: STOCK_MOVEMENT_REASON_LABELS[m.reason],
      productName: product?.name ?? null,
      productSlug: product?.slug ?? null,
    }
  })
}

/**
 * Loads the current stock value of one adjustable level (product OR variant), or null when the
 * row does not exist. Used by the manual-adjustment action to validate against the live value.
 */
export async function getAdjustableLevel(
  level: 'product' | 'variant',
  id: string,
): Promise<{ id: string; stockQuantity: number | null; productId: string; productSlug: string; label: string } | null> {
  if (!id) return null
  if (level === 'product') {
    const p = await prisma.product.findUnique({
      where: { id },
      select: { id: true, slug: true, name: true, stockQuantity: true },
    })
    return p ? { id: p.id, stockQuantity: p.stockQuantity, productId: p.id, productSlug: p.slug, label: p.name } : null
  }
  const v = await prisma.productVariant.findUnique({
    where: { id },
    select: {
      id: true,
      stockQuantity: true,
      value: true,
      product: { select: { id: true, slug: true, name: true } },
    },
  })
  return v
    ? {
        id: v.id,
        stockQuantity: v.stockQuantity,
        productId: v.product.id,
        productSlug: v.product.slug,
        label: `${v.product.name} · ${v.value}`,
      }
    : null
}
