/**
 * AURELIA — Password reset confirmation page (Этап 60A)
 *
 * Server component shell around the (client) ResetForm. Reads the token from the URL
 * (`?token=...`) and lets the user set a new password. The token is validated + consumed
 * server-side (single-use, short-lived). With no email provider, a real user never
 * receives a token link today — this page is provider-ready and is exercised by the
 * verify script. noindex. Existing storefront classes only — no new design/CSS.
 */

import type { Metadata } from 'next'
import ResetForm from '../_components/ResetForm'

export const metadata: Metadata = {
  title: 'Новий пароль — AURELIA',
  robots: { index: false, follow: false },
}

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  return (
    <div className="au-container au-checkout">
      <h1 className="au-co-title">Новий пароль</h1>
      <div className="au-co-section">
        <ResetForm token={(token ?? '').trim()} />
      </div>
    </div>
  )
}
