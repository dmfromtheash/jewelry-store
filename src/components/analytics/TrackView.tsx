'use client'

/**
 * AURELIA — TrackView (client) — Этап 23B
 *
 * Minimal, render-nothing tracker for view events on otherwise static/server
 * pages (product_view, category_view). Fires once per mount and again if the
 * payload changes (e.g. client navigation between product slugs). No UI, no
 * layout impact, no blocking — just a best-effort beacon.
 */

import { useEffect } from 'react'
import { sendAnalyticsEvent } from '../../lib/analytics/client'

export default function TrackView({
  event,
  payload,
}: {
  event: string
  payload?: Record<string, string | number | boolean | null>
}) {
  // Stable dependency key so a slug change re-fires, but identical renders don't.
  const key = JSON.stringify(payload ?? {})
  useEffect(() => {
    sendAnalyticsEvent(event, payload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, key])

  return null
}
