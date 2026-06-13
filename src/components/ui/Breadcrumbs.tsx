import { Fragment } from 'react'
import Link from 'next/link'

/**
 * AURELIA — Breadcrumbs (server component)
 * Source: docs/design/aurelia-prototype/aurelia.css (.au-crumbs)
 *
 * Items with `href` render as links; the last item (no href) is the
 * current page. Internal hrefs use next/link.
 */

export interface Crumb {
  label: string
  href?: string
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="au-crumbs" aria-label="Хлебные крошки">
      {items.map((item, i) => (
        <Fragment key={`${item.label}-${i}`}>
          {i > 0 && <span className="sep">/</span>}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="current">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  )
}
