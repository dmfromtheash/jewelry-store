'use client'

import { useEffect, useId, useRef, useState } from 'react'

/**
 * AURELIA — InfoHint (client) — Этап 84A
 *
 * A tiny, reusable "i" information hint for customer-facing controls. It shows a
 * short tooltip only AFTER a hover/focus delay (~800ms by default) so it never
 * fires accidentally on pass-through, and it stays subtle and out of the way.
 *
 * Design / accessibility notes:
 *  - Plain CSS only (au-hint* in src/styles/hint.css) — no Tailwind, no CSS
 *    Modules, no external tooltip dependency.
 *  - The "i" is a real <button> so it is keyboard-focusable; the tooltip is
 *    referenced via aria-describedby (always set) so screen readers can read the
 *    description text whether or not it is visually shown.
 *  - The tooltip has pointer-events:none, so it can never block clicking the
 *    control it sits next to.
 *  - Escape closes it; blur / mouse-leave hide it; tap (click) toggles it
 *    immediately for touch devices (no hover there).
 *  - `place` picks a conservative CSS position (top|right|bottom|left). In dense
 *    areas (header/nav) prefer "bottom"/side placement so the tip does not cover
 *    neighbouring controls. max-width is capped so it does not overflow narrow
 *    viewports.
 */

type HintPlace = 'top' | 'right' | 'bottom' | 'left'

export default function InfoHint({
  text,
  label = 'Підказка',
  place = 'top',
  delay = 800,
  className,
}: {
  /** The short hint shown in the tooltip. Keep it one short sentence. */
  text: string
  /** Accessible name for the "i" button (what the control is about). */
  label?: string
  place?: HintPlace
  /** Hover/focus open delay in ms. */
  delay?: number
  className?: string
}) {
  const tipId = useId()
  const [open, setOpen] = useState(false)
  const timer = useRef<number | null>(null)

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
  }
  const scheduleOpen = () => {
    clearTimer()
    timer.current = window.setTimeout(() => setOpen(true), delay)
  }
  const close = () => {
    clearTimer()
    setOpen(false)
  }

  // Always clean up a pending timer on unmount.
  useEffect(() => clearTimer, [])

  return (
    <span
      className={`au-hint${className ? ` ${className}` : ''}`}
      onMouseEnter={scheduleOpen}
      onMouseLeave={close}
    >
      <button
        type="button"
        className="au-hint-btn"
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={open}
        onFocus={scheduleOpen}
        onBlur={close}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close()
        }}
      >
        <span aria-hidden="true">i</span>
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="au-hint-tip"
        data-place={place}
        data-open={open ? 'true' : 'false'}
      >
        {text}
      </span>
    </span>
  )
}
