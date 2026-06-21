/**
 * AURELIA — Password reset request page (Этап 60A)
 *
 * Server component shell around the (client) RecoverForm. Provider-ready foundation:
 * with no email provider configured, requesting a reset only RECORDS an intent — nothing
 * is actually emailed (the form copy is honest about this). noindex. Uses existing
 * storefront classes only — no new design/CSS.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import RecoverForm from '../_components/RecoverForm'

export const metadata: Metadata = {
  title: 'Відновлення пароля — AURELIA',
  robots: { index: false, follow: false },
}

export default function RecoverPage() {
  return (
    <div className="au-container au-checkout">
      <h1 className="au-co-title">Відновлення пароля</h1>
      <div className="au-co-section">
        <p className="au-co-line-meta">
          Вкажіть e-mail акаунту — ми надішлемо інструкції для відновлення пароля.
        </p>
        <RecoverForm />
        <p className="au-co-info-link">
          Згадали пароль? <Link href="/account">Увійти</Link>
        </p>
      </div>
    </div>
  )
}
