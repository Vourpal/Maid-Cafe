import EventCards from "./EventCards";
import EventPagination from "./Pagination";

export default async function Event({ searchParams }) {
  const params = await searchParams;

  const page = params.page ?? 1;
  const quantity = params.quantity ?? 10;
  const min_capacity = params.min_capacity ?? null;
  const search = params.search_term ?? null;

  const url = new URL(`${process.env.NEXT_PUBLIC_API_URL}/events`);
  url.searchParams.set("page", page);
  url.searchParams.set("quantity", quantity);
  if (search) {
    url.searchParams.set("search_term", search);
  }

  if (min_capacity) {
    url.searchParams.set("min_capacity", min_capacity);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  return (
    <div>
      <p>yippee this is where we will test the events i guess?</p>
      <EventCards initialEvents={data.data?.events ?? []} initialPage={page} />
      <EventPagination
        currentPage={Number(page)}
        total={data.data?.total ?? 0}
        quantity={Number(quantity)}
      />
    </div>
  );
}
