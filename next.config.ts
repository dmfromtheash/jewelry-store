import type { NextConfig } from 'next'

/**
 * Public-demo browser security headers (Этап 76A — closes 75A finding F1).
 *
 * A conservative, design-safe baseline applied to every response. It does NOT change any
 * markup, styling, or behaviour — it only instructs the browser to be stricter:
 *   - `Content-Security-Policy` with `frame-ancestors 'none'` (anti-clickjacking) + a
 *     same-origin default. Inline `<script type="application/ld+json">` (our honest
 *     structured data) and Next's inline bootstrap need `'unsafe-inline'` for now; the
 *     only allowed third-party is Google Fonts (CSS on fonts.googleapis.com, files on
 *     fonts.gstatic.com — already used by app/layout.tsx). NO analytics/pixel/payment/
 *     email/carrier domains are allowed.
 *   - `X-Frame-Options: DENY` alongside CSP `frame-ancestors` for older-browser parity.
 *   - `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`.
 *
 * HSTS is deliberately NOT emitted here: it is only safe once served over real production
 * HTTPS and would be harmful/sticky in local `http://` dev. It belongs at the hosting/proxy
 * layer at real launch — see docs/security/PUBLIC_DEMO_HARDENING_76A.md.
 *
 * In `next dev` we additionally allow `'unsafe-eval'` + the HMR websocket so the dev
 * experience (React Fast Refresh) is not broken; production gets the tighter policy. At
 * real launch the inline-script allowance should be replaced with a nonce/hash (documented).
 */
const isDev = process.env.NODE_ENV !== 'production'

function contentSecurityPolicy(): string {
  const scriptSrc = ["'self'", "'unsafe-inline'", ...(isDev ? ["'unsafe-eval'"] : [])]
  const connectSrc = ["'self'", ...(isDev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : [])]
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src ${scriptSrc.join(' ')}`,
    `connect-src ${connectSrc.join(' ')}`,
  ]
  return directives.join('; ')
}

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()',
  },
]

const nextConfig: NextConfig = {
  // Strict mode — помогает выявить проблемы в компонентах заранее
  reactStrictMode: true,

  // Apply the public-demo security headers to every route (Этап 76A).
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
}

export default nextConfig
