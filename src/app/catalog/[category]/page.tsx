export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const categoryName = decodeURIComponent(category).replaceAll("-", " ");

  return (
    <main className="page">
      <p className="eyebrow">Category placeholder</p>
      <h1>{categoryName}</h1>
      <p>
        This route is reserved for a future category page. Product listing,
        filtering, and sorting are not implemented in this skeleton.
      </p>
    </main>
  );
}
