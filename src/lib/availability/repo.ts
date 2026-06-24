/**
 * AURELIA — Availability-interest data layer (Этап 79A) — server-only, NO real sending
 *
 * Prisma reads/writes for back-in-stock availability interest. Privacy by construction:
 *   - the product is resolved by SLUG → a real PUBLISHED product server-side (never an
 *     arbitrary id); a passed `variantId` is honoured only when it actually belongs to that
 *     product, else the interest is recorded at product level (variantId = null).
 *   - dedupe is application-level on (productId, variantId, emailHash): a NULL variantId is
 *     treated as one product-level bucket (Postgres unique would otherwise treat NULLs as
 *     distinct), so re-submitting the same email is idempotent. The unique constraint is a
 *     backstop for the non-null case + concurrent races (P2002 is swallowed as "deduped").
 *   - the raw `email` is stored only with consent; admin reads NEVER return it raw (see
 *     ../admin/availability-interests.ts, which masks it).
 */

import 'server-only'

import { Prisma } from '@prisma/client'
import { prisma } from '../db/prisma'
import { hashEmail } from '../support/email-utils'

const SLUG_RE = /^[a-z0-9-]{1,128}$/i

/** Resolves a slug to a published product id (+ its variant ids), or null. */
async function resolveProduct(slug: string): Promise<{ id: string; variantIds: Set<string> } | null> {
  if (!SLUG_RE.test(slug)) return null
  const row = await prisma.product.findFirst({
    where: { slug, isPublished: true },
    select: { id: true, variants: { select: { id: true } } },
  })
  if (!row) return null
  return { id: row.id, variantIds: new Set(row.variants.map((v) => v.id)) }
}

export interface RecordInterestArgs {
  slug: string
  email: string
  variantId?: string | null
  customerId?: string | null
  source?: string | null
}

export type RecordInterestOutcome =
  | { ok: true; deduped: boolean }
  | { ok: false; reason: 'unknown_product' }

/**
 * Records (or dedupes) an availability interest. Idempotent per (product, variant, email):
 * a repeat keeps a single row and re-activates a previously cancelled one. Stores the raw
 * email + consent timestamp (consent is enforced by the caller's validation). NO email is sent.
 */
export async function recordAvailabilityInterest(
  args: RecordInterestArgs,
): Promise<RecordInterestOutcome> {
  const product = await resolveProduct(args.slug)
  if (!product) return { ok: false, reason: 'unknown_product' }

  // Honour the variant only when it really belongs to this product; else product-level.
  const variantId =
    args.variantId && product.variantIds.has(args.variantId) ? args.variantId : null
  const emailHash = hashEmail(args.email)

  // Application-level dedupe (handles the NULL-variant bucket Postgres can't dedupe).
  const existing = await prisma.productAvailabilityInterest.findFirst({
    where: { productId: product.id, variantId, emailHash },
    select: { id: true, status: true },
  })
  if (existing) {
    await prisma.productAvailabilityInterest.update({
      where: { id: existing.id },
      data: {
        email: args.email,
        consentAt: new Date(),
        customerId: args.customerId ?? undefined,
        // Re-activate a previously cancelled/expired interest; leave others as-is.
        status:
          existing.status === 'cancelled' || existing.status === 'expired'
            ? 'requested'
            : existing.status,
      },
    })
    return { ok: true, deduped: true }
  }

  try {
    await prisma.productAvailabilityInterest.create({
      data: {
        productId: product.id,
        variantId,
        customerId: args.customerId ?? null,
        email: args.email,
        emailHash,
        source: args.source ?? null,
        consentAt: new Date(),
        status: 'requested',
      },
    })
    return { ok: true, deduped: false }
  } catch (e) {
    // Lost a race to a concurrent identical submit → treat as a successful dedupe.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return { ok: true, deduped: true }
    }
    throw e
  }
}
