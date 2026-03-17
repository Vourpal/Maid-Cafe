"use client";
import { useRouter } from "next/navigation";

type EventFiltersProps = {
  showMine: boolean;
  setShowMine: React.Dispatch<React.SetStateAction<boolean>>;
};

export default function EventFilters({
  showMine,
  setShowMine,
}: EventFiltersProps) {
  const router = useRouter();

  function handleLocationChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    router.push(`/events?location=${value}&page=1`);
  }

  function handleMineToggle() {
    setShowMine(prev => !prev);
  }

  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
      {/* Location filter */}
      <select onChange={handleLocationChange}>
        <option value="">All</option>
        <option value="tampa">Tampa</option>
        <option value="orlando">Orlando</option>
      </select>

      {/* Show only my events */}
      <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <input
          type="checkbox"
          checked={showMine}
          onChange={handleMineToggle}
        />
        Show my events
      </label>
    </div>
  );
}