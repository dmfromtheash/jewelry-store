export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const productName = decodeURIComponent(slug).replaceAll("-", " ");

  return (
    <main className="page">
      <p className="eyebrow">PDP placeholder</p>
      <h1>{productName}</h1>
      <p>
        This route is reserved for a future product detail page. Real product
        data, variants, image galleries, reviews, and add-to-cart behavior are
        not implemented yet.
      </p>
    </main>
  );
}
