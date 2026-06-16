/**
 * AURELIA — Analytics capture gateway (Этап 23B)
 *
 * Same-origin POST endpoint for client-originated analytics events. It is the
 * ONLY client→server analytics path and delegates to the server-only
 * recordClientEvent(), which enforces the taxonomy allowlist + payload
 * sanitization. The route adds transport-level guards: same-origin only, JSON
 * only, small body cap. It never logs payloads and never leaks internals.
 *
 * Responses: 204 (accepted) · 400 (unknown event / bad request) · 413 (too big).
 * Failures fail safe (no internal details).
 */

import type { NextRequest } from 'next/server'
import { recordClientEvent } from '../../../src/lib/analytics/record'

// Prisma needs the Node.js runtime (not edge).
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 2048

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Same-origin guard (best-effort): if an Origin is present, it must match host.
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin) {
      try {
        if (new URL(origin).host !== host) return new Response(null, { status: 400 })
      } catch {
        return new Response(null, { status: 400 })
      }
    }

    if (!req.headers.get('content-type')?.includes('application/json')) {
      return new Response(null, { status: 400 })
    }

    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 })

    let body: unknown
    try {
      body = JSON.parse(text)
    } catch {
      return new Response(null, { status: 400 })
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return new Response(null, { status: 400 })
    }

    const { event, payload, pagePath } = body as Record<string, unknown>

    const accepted = await recordClientEvent(
      typeof event === 'string' ? event : '',
      payload,
      typeof pagePath === 'string' ? pagePath : null,
    )

    // Unknown/disallowed event names are rejected; valid ones are accepted.
    return new Response(null, { status: accepted ? 204 : 400 })
  } catch {
    // Never expose internals. Treat as a no-op.
    return new Response(null, { status: 400 })
  }
}
