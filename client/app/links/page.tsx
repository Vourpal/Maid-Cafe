import { authHeadersNoContent } from "@/lib/api";

async function getLinks(category: string) {
  if (!category) return [];

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/links?category=${category}`,
      {
        headers: authHeadersNoContent(),
        cache: "no-store", // or "force-cache" if it can be cached
      }
    );

    if (!res.ok) throw new Error("Failed to fetch links");

    return res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
}

export default async function Links({
  searchParams,
}: {
  searchParams: { category?: string };
}) {
  const category = searchParams.category;

  const links = await getLinks(category ?? "");

  return (
    <div>
      {links.length === 0 ? (
        <p>No links</p>
      ) : (
        links.map((link: any) => (
          <div key={link.id}>{link.title}</div>
        ))
      )}
    </div>
  );
}