'use server'

/**
 * AURELIA — Admin promo management actions (Этап 63A)
 *
 * Create / edit / activate / deactivate / archive promo codes from the local admin screen.
 * Mirrors the other admin actions' security: re-checks the local admin guard (so it can't be
 * POSTed in production), requires a valid admin session, validates server-side (authoritative),
 * audits the change (no PII — promo code + action), and revalidates the page. No hard delete.
 */

import { revalidatePath } from 'next/cache'
import { ensureLocalAdmin } from './guard'
import { requireAdminSession } from './auth'
import { validatePromoForm, type PromoFormErrors, type PromoFormInput } from './promotion-form'
import {
  archivePromo,
  createPromo,
  DuplicatePromoCodeError,
  getAdminPromoById,
  setPromoActive,
  updatePromo,
} from './promotions'
import { AUDIT_ACTIONS, recordAuditEvent } from './audit'

export interface PromoActionState {
  ok?: boolean
  error?: string
  errors?: PromoFormErrors
}

const DUP_ERROR = 'Промокод з таким кодом вже існує.'
const GENERIC_ERROR = 'Не вдалося зберегти промокод. Спробуйте ще раз.'

function readForm(formData: FormData): PromoFormInput {
  const get = (k: string) => {
    const v = formData.get(k)
    return typeof v === 'string' ? v : undefined
  }
  return {
    code: get('code'),
    internalName: get('internalName'),
    type: get('type'),
    percentValue: get('percentValue'),
    amount: get('amount'),
    minSubtotal: get('minSubtotal'),
    maxDiscount: get('maxDiscount'),
    usageLimit: get('usageLimit'),
    startsAt: get('startsAt'),
    endsAt: get('endsAt'),
    notes: get('notes'),
  }
}

/**
 * Create (no `id`) or edit (with `id`) a promo. Used with `useActionState` so the form can
 * render inline field errors. Validation is authoritative here — the client form mirrors the
 * same rules only for instant UX.
 */
export async function savePromoAction(
  _prev: PromoActionState,
  formData: FormData,
): Promise<PromoActionState> {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  const { errors, value } = validatePromoForm(readForm(formData))
  if (!value) return { ok: false, error: 'Перевірте поля форми.', errors }

  try {
    if (id) {
      const existing = await getAdminPromoById(id)
      if (!existing) return { ok: false, error: 'Промокод не знайдено.' }
      await updatePromo(id, value)
      await recordAuditEvent({
        actor: session.sub,
        action: AUDIT_ACTIONS.promoUpdated,
        entityType: 'promo',
        entityId: id,
        summary: `Промокод ${value.code} обновлён.`,
        metadata: { type: value.type },
      })
    } else {
      const created = await createPromo(value)
      await recordAuditEvent({
        actor: session.sub,
        action: AUDIT_ACTIONS.promoCreated,
        entityType: 'promo',
        entityId: created.id,
        summary: `Промокод ${value.code} создан.`,
        metadata: { type: value.type },
      })
    }
    revalidatePath('/admin/promotions')
    return { ok: true }
  } catch (e) {
    if (e instanceof DuplicatePromoCodeError) {
      return { ok: false, error: DUP_ERROR, errors: { code: DUP_ERROR } }
    }
    console.error('savePromoAction failed:', e instanceof Error ? e.message : 'unknown')
    return { ok: false, error: GENERIC_ERROR }
  }
}

/** Activate or deactivate a promo (plain form action). `active` = "1" → activate. */
export async function togglePromoActiveAction(formData: FormData): Promise<void> {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  const promo = await getAdminPromoById(id)
  if (!promo || promo.archivedAt) return // archived promos can't be toggled

  const activate = String(formData.get('active') ?? '') === '1'
  if (promo.isActive === activate) {
    revalidatePath('/admin/promotions')
    return // idempotent no-op; don't pollute the audit log
  }

  await setPromoActive(id, activate)
  await recordAuditEvent({
    actor: session.sub,
    action: activate ? AUDIT_ACTIONS.promoActivated : AUDIT_ACTIONS.promoDeactivated,
    entityType: 'promo',
    entityId: id,
    summary: `Промокод ${promo.code} ${activate ? 'активирован' : 'деактивирован'}.`,
  })
  revalidatePath('/admin/promotions')
}

/** Soft-archive a promo (plain form action). No hard delete. */
export async function archivePromoAction(formData: FormData): Promise<void> {
  await ensureLocalAdmin()
  const session = await requireAdminSession()

  const id = String(formData.get('id') ?? '').trim()
  if (!id) return
  const promo = await getAdminPromoById(id)
  if (!promo || promo.archivedAt) return // already archived

  await archivePromo(id)
  await recordAuditEvent({
    actor: session.sub,
    action: AUDIT_ACTIONS.promoArchived,
    entityType: 'promo',
    entityId: id,
    summary: `Промокод ${promo.code} архивирован.`,
  })
  revalidatePath('/admin/promotions')
}
