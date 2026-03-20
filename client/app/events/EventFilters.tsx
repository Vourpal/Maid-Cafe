"use client";
import { useRouter } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";

type EventFiltersProps = {
  showMine: boolean;
  setShowMine: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function EventFilters({
  showMine,
  setShowMine,
}: EventFiltersProps) {
  const { user } = useUserAuthentication();
  const router = useRouter();

  const [searchTerm, setSearchTerm] = useState("");

  function handleLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    router.push(`/events?location=${value}&page=1`);
  }

  function handleMineToggle() {
    setShowMine((prev) => !prev);
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push(`/events?search_term=${searchTerm}`);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm, router]);

return (
  <div className="flex flex-wrap gap-4 items-end mb-6">
    <Field>
      <FieldLabel>Location</FieldLabel>
      <select
        onChange={handleLocationChange}
        className="border border-rose-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-rose-300"
      >
        <option value="">All</option>
        <option value="tampa">Tampa</option>
        <option value="orlando">Orlando</option>
      </select>
    </Field>

    <Field>
      <FieldLabel>Search</FieldLabel>
      <Input
        type="text"
        placeholder="Search events..."
        onChange={(e) => setSearchTerm(e.target.value)}
        className="border-rose-200 focus:ring-rose-300 w-48"
      />
    </Field>

    {user && (
      <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pb-1">
        <input
          type="checkbox"
          checked={showMine}
          onChange={handleMineToggle}
          className="accent-rose-500"
        />
        Show my events
      </label>
    )}
  </div>
);
}