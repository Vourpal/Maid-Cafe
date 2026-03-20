"use client";
import { useRouter } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import { useEffect, useState } from "react";

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
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      {/* Location filter */}
      <select onChange={handleLocationChange}>
        <option value="">All</option>
        <option value="tampa">Tampa</option>
        <option value="orlando">Orlando</option>
      </select>
      <label>Search Bar</label>{" "}
      <input type="text" onChange={(e) => setSearchTerm(e.target.value)} />
      {/* Show only my events */}
      {user && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input
            type="checkbox"
            checked={showMine}
            onChange={handleMineToggle}
          />
          Show my events
        </label>
      )}
    </div>
  );
}
