import type { Metadata } from 'next'
import '../src/styles/globals.css'
import Header from '../src/components/layout/Header'
import Footer from '../src/components/layout/Footer'
import AuthModalProvider from '../src/components/auth/AuthModalProvider'
import CartProvider from '../src/components/cart/CartProvider'
import FavoritesProvider from '../src/components/favorites/FavoritesProvider'
import CatalogProvider from '../src/lib/catalog/CatalogProvider'
import { getCatalogSnapshotForClient } from '../src/lib/catalog/server'

// Base URL used to resolve relative canonical/Open Graph URLs (Этап 62A SEO). Reads
// the public site URL when configured (not a secret), else a local-demo default. Guarded
// so a malformed value can never break the build.
function resolveMetadataBase(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:5000'
  try {
    return new URL(raw)
  } catch {
    return undefined
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: 'AURELIA — Bijouterie Without Limits',
  description: 'Інтернет-магазин біжутерії, прикрас та аксесуарів AURELIA',
  keywords: ['біжутерія', 'прикраси', 'каблучки', 'сережки', 'браслети', 'aurelia'],
}

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
