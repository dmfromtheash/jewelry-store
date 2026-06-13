import type { Metadata } from 'next'
import '../src/styles/globals.css'
import Header from '../src/components/layout/Header'
import Footer from '../src/components/layout/Footer'
import AuthModalProvider from '../src/components/auth/AuthModalProvider'
import CartProvider from '../src/components/cart/CartProvider'

export const metadata: Metadata = {
  title: 'AURELIA — Bijouterie Without Limits',
  description: 'Интернет-магазин бижутерии, украшений и аксессуаров AURELIA',
  keywords: ['бижутерия', 'украшения', 'кольца', 'серьги', 'браслеты', 'aurelia'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ru">
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
        <AuthModalProvider>
          <CartProvider>
            <Header />
            <main className="au-main">{children}</main>
            <Footer />
          </CartProvider>
        </AuthModalProvider>
      </body>
    </html>
  )
}
