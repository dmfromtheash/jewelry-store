/**
 * AURELIA — Client analytics sender (Этап 23B)
 *
 * Tiny, dependency-free helper that POSTs a single analytics event to the
 * same-origin capture route (/api/analytics). Best-effort and non-blocking:
 * it never throws, never blocks the UI, and silently no-ops on the server.
 *
 * Privacy: only ever send taxonomy-safe payloads (slugs, ids, counts, coarse
 * price bands). NEVER pass phone/email/name/address/payment/card/token/secret —
 * the server route + recordEvent also strip forbidden keys as defense in depth,
 * but callers must not put PII here in the first place. The body carries only
 * { event, payload, pagePath } — the server derives the anonymous session,
 * device and referrer itself.
 */

const ENDPOINT = '/api/analytics'

export function sendAnalyticsEvent(
  event: string,
  payload?: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === 'undefined') return
  try {
    const body = JSON.stringify({
      event,
      payload,
      pagePath: window.location.pathname,
    })

    // Prefer sendBeacon (fire-and-forget, survives page transitions).
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon(ENDPOINT, blob)) return
    }

    // Fallback: keepalive fetch; swallow all errors.
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics must never break the UI.
  }
}
