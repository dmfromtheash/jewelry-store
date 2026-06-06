import Link from "next/link";

import { primaryNav, site } from "@/lib/site";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/">
          {site.name}
        </Link>
        <nav aria-label="Main navigation" className="nav">
          {primaryNav.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
