"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserAuthentication } from "../UserAuthentication";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type EventFiltersProps = {
  showMine: boolean;
  setShowMine: React.Dispatch<React.SetStateAction<boolean>>;
  showFutureOnly: boolean;
  setShowFutureOnly: React.Dispatch<React.SetStateAction<boolean>>;
};

function Toggle({
  checked,
  onToggle,
  label,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
      <div
        onClick={onToggle}
        className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
          checked ? "bg-rose-500" : "bg-gray-200"
        }`}
      >
        <div
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </div>
      {label}
    </label>
  );
}

export default function EventFilters({
  showMine,
  setShowMine,
  showFutureOnly,
  setShowFutureOnly,
}: EventFiltersProps) {
  const { user } = useUserAuthentication();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");

  // Helper: build a new URL preserving existing params, then navigate
  function navigate(overrides: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    // Always reset to page 1 when a filter changes
    params.set("page", "1");
    for (const [key, val] of Object.entries(overrides)) {
      params.set(key, val);
    }
    router.push(`/events?${params.toString()}`);
  }

  // Debounced search — also resets to page 1 via navigate()
  useEffect(() => {
    const timer = setTimeout(() => {
      navigate({ search_term: searchTerm });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  function handleFutureToggle() {
    const next = !showFutureOnly;
    setShowFutureOnly(next);
    navigate({ future_only: String(next) });
  }

  return (
    <div className="flex flex-wrap gap-4 items-center mt-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search events..."
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300 w-52 transition"
        />
      </div>

      {/* Upcoming only — navigates server-side */}
      <Toggle
        checked={showFutureOnly}
        onToggle={handleFutureToggle}
        label="Upcoming only"
      />

      {/* My events — client-side filter, no pagination impact */}
      {user && (
        <Toggle
          checked={showMine}
          onToggle={() => setShowMine((p) => !p)}
          label="My events"
        />
      )}
    </div>
  );
}
