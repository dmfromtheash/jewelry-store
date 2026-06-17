/**
 * AURELIA — Checkout success fallback (Этап 16A → 27C)
 *
 * The primary order confirmation is now shown INLINE in CheckoutPageClient from
 * client state right after a successful order (orderCode + the values the
 * customer just submitted). This route is only a SAFE FALLBACK for a direct hit
 * / refresh / bookmark of /checkout/success.
 *
 * Этап 27C privacy hardening: it deliberately performs NO database lookup. It
 * does not read an order by code, so no order contents are exposed by a
 * guessable order code and no PII is ever returned here. At most it echoes the
 * code already present in the URL (which the customer themselves hold).
 */

import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Заказ создан — AURELIA',
  description: 'Заказ AURELIA принят (демо-режим).',
  robots: { index: false, follow: false },
}

const GemIcon = () => (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" aria-hidden="true">
    <path d="M7 4h10l4 5-9 11L3 9l4-5z" />
    <path d="M3 9h18" />
  </svg>
)

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>
}) {
  const { order: orderCode } = await searchParams

  return (
    <div className="au-container au-checkout">
      <div className="au-co-empty">
        <span className="au-co-empty-ico">
          <GemIcon />
        </span>
        <h1 className="au-co-empty-title">Заказ принят</h1>

        <p className="au-co-empty-sub">
          {orderCode ? (
            <>
              Номер заказа: <strong>{orderCode}</strong>. Мы свяжемся с вами для подтверждения.
            </>
          ) : (
            'Спасибо! Мы свяжемся с вами для подтверждения заказа.'
          )}
        </p>

        <p className="au-co-note" style={{ marginTop: 16 }}>
          Заказ оформлен в демо-режиме. Оплата подтверждается вручную по выбранному способу —
          сейчас с вас ничего не списано.
        </p>

        <div className="au-co-empty-actions">
          <Link className="au-btn au-btn--primary" href="/category/bijouterie">
            В каталог
          </Link>
          <Link className="au-btn au-btn--ghost" href="/">
            На главную
          </Link>
        </div>
      </div>
    </div>
  )
}
