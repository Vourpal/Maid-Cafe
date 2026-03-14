import EventCards from "./EventCards";

export default async function Event({ searchParams }) {
  const params = await searchParams;

  const page = params.page ?? 1;
  const quantity = params.quantity ?? 10;
  const min_capacity = params.min_capacity ?? null;

  const url = new URL("http://127.0.0.1:5000/events");
  url.searchParams.set("page", page);
  url.searchParams.set("quantity", quantity);

  if (min_capacity) {
    url.searchParams.set("min_capacity", min_capacity);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  const data = await res.json();

  return (
    <div>
      <p>yippee this is where we will test the events i guess?</p>
      <EventCards initialEvents={data.data.events} initialPage={page} />
    </div>
  );
}