import type { Metadata } from 'next'
import '../src/styles/globals.css'
import Header from '../src/components/layout/Header'
import Footer from '../src/components/layout/Footer'
import AuthModalProvider from '../src/components/auth/AuthModalProvider'
import CartProvider from '../src/components/cart/CartProvider'
import FavoritesProvider from '../src/components/favorites/FavoritesProvider'
import CatalogProvider from '../src/lib/catalog/CatalogProvider'
import { getCatalogSnapshotForClient } from '../src/lib/catalog/server'
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  metadataBaseUrl,
  serializeJsonLd,
} from '../src/lib/seo/site'

// Base URL used to resolve relative canonical/Open Graph URLs. Reads the public site URL when
// configured (not a secret), else a local/demo default — centralised in src/lib/seo/site.ts
// (Этап 72A) so the sitemap/robots/structured-data all agree on one origin.
export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: 'AURELIA — Bijouterie Without Limits',
  description: 'Інтернет-магазин біжутерії, прикрас та аксесуарів AURELIA',
  keywords: ['біжутерія', 'прикраси', 'каблучки', 'сережки', 'браслети', 'aurelia'],
}

// Site-wide structured data (Этап 72A): Organization + WebSite (with on-site SearchAction).
// Honest, generic fields only — no fabricated address/phone/payment/rating. Serialised via
// serializeJsonLd (Этап 76A) so `<` is escaped — safe inline ld+json (defence in depth).
const SITE_JSON_LD = [buildOrganizationJsonLd(), buildWebSiteJsonLd()]

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // DB-backed catalog snapshot, fetched on the server and handed to the client
  // CatalogProvider as plain data (no Prisma reaches the client bundle).
  const catalog = await getCatalogSnapshotForClient()

  return (
    <html lang="uk">
      <head>
        {/* Google Fonts: Manrope (UI) + Cormorant Garamond (display/logo) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:wght@500;600&display=swap"
          rel="stylesheet"
        />
        {SITE_JSON_LD.map((node, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(node) }}
          />
        ))}
      </head>
      <body>
        {/* Client-обёртки контекста: модалки входа/регистрации (AuthModalProvider)
            и корзина (CartProvider). Header/Footer остаются server-компонентами —
            интерактив живёт в маленьких client-кнопках внутри них. */}
        <CatalogProvider products={catalog}>
          <AuthModalProvider>
            <CartProvider>
              <FavoritesProvider>
                <Header />
                <main className="au-main">{children}</main>
                <Footer />
              </FavoritesProvider>
            </CartProvider>
          </AuthModalProvider>
        </CatalogProvider>
      </body>
    </html>
  )
}
