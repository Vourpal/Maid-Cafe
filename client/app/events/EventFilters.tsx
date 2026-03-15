"use client";
import { useRouter } from "next/navigation";

export default function EventFilters() {
  const router = useRouter();

  function handleChange(e) {
    const value = e.target.value;
    router.push(`/events?location=${value}&page=1`);
  }

  return (
    <select onChange={handleChange}>
      <option value="">All</option>
      <option value="tampa">Tampa</option>
      <option value="orlando">Orlando</option>
    </select>
  );
}