import Link from "next/link";

export default function HomePage() {
  return (
    <main className="page">
      <p className="eyebrow">Project skeleton / demo in progress</p>
      <h1>Minimal foundation for a jewelry storefront.</h1>
      <p>
        This is the first technical app skeleton for a future bijouterie
        e-commerce demo. Catalog, wishlist, cart, and checkout behavior will be
        added later in separate, reviewed stages.
      </p>
      <div className="actions">
        <Link className="button" href="/catalog">
          Catalog
        </Link>
        <Link className="button" href="/wishlist">
          Wishlist
        </Link>
        <Link className="button" href="/cart">
          Cart
        </Link>
      </div>
    </main>
  );
}
