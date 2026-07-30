"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  History,
  Pencil,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, queryString } from "@/lib/api";
import type { StaffListResponse, StaffMember } from "@/types/admin";
import EditStaffModal from "./EditStaffModal";
import StaffHistoryModal from "./StaffHistoryModal";
import {
  DAYS,
  EmptyState,
  ExportButton,
  SectionCard,
  TypeBadge,
  getInitials,
  inputClass,
  normaliseDay,
  to12h,
} from "./shared";

const PAGE_SIZE = 15;

const SORTS = [
  { value: "name", label: "Name" },
  { value: "username", label: "Username" },
  { value: "type", label: "Role" },
  { value: "admin", label: "Admin" },
  { value: "active", label: "Status" },
];

export default function StaffTab({ currentUserId }: { currentUserId: number }) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [typeFilter, setTypeFilter] = useState("");

  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [viewingHistory, setViewingHistory] = useState<StaffMember | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);

  // Debounce typing so each keystroke does not hit the API.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString({
        page,
        quantity: PAGE_SIZE,
        search,
        sort,
        direction,
        type: typeFilter,
      });
      const data = await apiFetch<StaffListResponse>(`/users${qs}`);
      setStaff(data.users);
      setTotal(data.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load staff");
    } finally {
      setLoading(false);
    }
  }, [page, search, sort, direction, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function applyLocalUpdate(id: number, updates: Partial<StaffMember>) {
    setStaff((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    );
  }

  /** Inline admin toggle — the common case, without opening the editor. */
  async function toggleAdmin(member: StaffMember) {
    const next = !member.admin;
    try {
      await apiFetch(`/users/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ admin: next }),
      });
      applyLocalUpdate(member.id, { admin: next });
      toast.success(
        next
          ? `${member.first_name} is now an admin`
          : `Removed admin access from ${member.first_name}`,
      );
    } catch (err) {
      // Covers the last-admin and self-demotion guards from the API.
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  return (
    <>
      <SectionCard
        title="Staff Members"
        count={loading ? undefined : total}
        action={
          <ExportButton path="/exports/staff.csv" filename="staff.csv" />
        }
      >
        {/* Filters */}
        <div className="px-5 py-3 border-b border-rose-50 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search name, username or email"
              className={`${inputClass} pl-9`}
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} w-auto`}
          >
            <option value="">All roles</option>
            <option value="maid">Maids</option>
            <option value="butler">Butlers</option>
          </select>

          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} w-auto`}
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                Sort: {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setDirection((d) => (d === "asc" ? "desc" : "asc"))}
            className="text-xs border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 transition text-gray-600"
            title="Toggle sort direction"
          >
            {direction === "asc" ? "A → Z" : "Z → A"}
          </button>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : staff.length === 0 ? (
          <EmptyState
            message={
              search ? `No staff match "${search}".` : "No staff members found."
            }
          />
        ) : (
          <div className="divide-y divide-rose-50">
            {staff.map((member) => {
              const isExpanded = expanded === member.id;

              return (
                <div key={member.id} className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-9 h-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                        member.active
                          ? "bg-rose-100 text-rose-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {getInitials(member.first_name, member.last_name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p
                          className={`font-semibold truncate ${
                            member.active ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {member.first_name} {member.last_name}
                        </p>
                        {member.admin && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        )}
                        {!member.active && (
                          <span className="text-[10px] font-semibold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        @{member.username} · {member.email}
                      </p>
                    </div>

                    <TypeBadge type={member.type} />

                    {/* Row actions */}
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setExpanded(isExpanded ? null : member.id)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Availability"
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setViewingHistory(member)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Practice history"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleAdmin(member)}
                        disabled={member.id === currentUserId}
                        className={`p-1.5 rounded-lg border transition disabled:opacity-40 disabled:cursor-not-allowed ${
                          member.admin
                            ? "border-rose-200 text-rose-500 hover:bg-rose-50"
                            : "border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                        }`}
                        title={
                          member.id === currentUserId
                            ? "You cannot change your own admin access"
                            : member.admin
                              ? "Remove admin"
                              : "Make admin"
                        }
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditing(member)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Availability, collapsed by default so the list stays scannable */}
                  {isExpanded && (
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2">
                      {DAYS.map((day) => {
                        const d = normaliseDay(member.availability?.[day]);
                        const enabled = d.enabled && d.slots.length > 0;
                        return (
                          <div
                            key={day}
                            className={`rounded-lg border p-2 ${
                              enabled
                                ? "bg-rose-50 border-rose-200"
                                : "bg-gray-50 border-gray-200"
                            }`}
                          >
                            <p
                              className={`text-[10px] font-bold uppercase mb-1 ${
                                enabled ? "text-rose-600" : "text-gray-400"
                              }`}
                            >
                              {day}
                            </p>
                            {enabled ? (
                              <div className="space-y-1">
                                {d.slots.map((slot, i) => (
                                  <p key={i} className="text-[11px] text-gray-700">
                                    {to12h(slot.start)}–{to12h(slot.end)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="text-[11px] text-gray-400">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && total > PAGE_SIZE && (
          <div className="px-5 py-3 border-t border-rose-50 flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Page {page} of {totalPages} · {total} total
            </p>
            <div className="flex gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {editing && (
        <EditStaffModal
          member={editing}
          currentUserId={currentUserId}
          onClose={() => setEditing(null)}
          onSaved={(updates) => applyLocalUpdate(editing.id, updates)}
          onDeleted={(id) => {
            setStaff((prev) => prev.filter((m) => m.id !== id));
            setTotal((t) => Math.max(0, t - 1));
          }}
        />
      )}

      {viewingHistory && (
        <StaffHistoryModal
          member={viewingHistory}
          onClose={() => setViewingHistory(null)}
        />
      )}
    </>
  );
}
