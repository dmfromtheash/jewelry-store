import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        {site.name} is a portfolio e-commerce skeleton. Real payments, auth,
        database, and admin tools are not implemented.
      </div>
    </footer>
  );
}
