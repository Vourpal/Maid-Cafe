"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Music, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type {
  ProficiencyEntry,
  ProficiencyLevel,
  ProficiencyMatrix,
  RoutineReadiness,
} from "@/types/admin";
import { EmptyState, SectionCard, StatCard, getInitials } from "./shared";

/**
 * Clicking a cell walks through the levels and then back to no record at all.
 * "No record" is meaningfully different from "learning": it means nobody has
 * assessed this person on this routine yet.
 */
const CYCLE: (ProficiencyLevel | null)[] = [
  null,
  "learning",
  "can_perform",
  "lead",
];

const LEVEL_STYLES: Record<ProficiencyLevel, string> = {
  learning: "bg-amber-100 text-amber-700 hover:bg-amber-200",
  can_perform: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200",
  lead: "bg-purple-100 text-purple-700 hover:bg-purple-200",
};

const LEVEL_SHORT: Record<ProficiencyLevel, string> = {
  learning: "L",
  can_perform: "✓",
  lead: "★",
};

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  learning: "Learning",
  can_perform: "Can perform",
  lead: "Lead",
};

function nextLevel(current: ProficiencyLevel | null): ProficiencyLevel | null {
  const index = CYCLE.indexOf(current ?? null);
  return CYCLE[(index + 1) % CYCLE.length];
}

export default function ProficiencyTab() {
  const [data, setData] = useState<ProficiencyMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await apiFetch<ProficiencyMatrix>(
          `/proficiency/matrix${includeInactive ? "?include_inactive=true" : ""}`,
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load the proficiency grid",
      );
    } finally {
      setLoading(false);
    }
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  // Lookup keyed by user+routine so a cell render is O(1) rather than a scan.
  const levels = useMemo(() => {
    const map = new Map<string, ProficiencyLevel>();
    for (const entry of data?.entries ?? []) {
      map.set(`${entry.user_id}:${entry.routine_id}`, entry.level);
    }
    return map;
  }, [data]);

  const readinessByRoutine = useMemo(() => {
    const map = new Map<number, RoutineReadiness>();
    for (const row of data?.readiness ?? []) {
      map.set(row.routine_id, row);
    }
    return map;
  }, [data]);

  async function cycleCell(userId: number, routineId: number) {
    const key = `${userId}:${routineId}`;
    const current = levels.get(key) ?? null;
    const target = nextLevel(current);

    setSavingCell(key);
    try {
      if (target === null) {
        await apiFetch(`/routines/${routineId}/proficiency/${userId}`, {
          method: "DELETE",
        });
      } else {
        await apiFetch(`/routines/${routineId}/proficiency`, {
          method: "POST",
          body: JSON.stringify({ user_id: userId, level: target }),
        });
      }

      // Patch locally rather than reloading the whole grid on every click.
      setData((prev) => {
        if (!prev) return prev;

        const entries: ProficiencyEntry[] = prev.entries.filter(
          (entry) => !(entry.user_id === userId && entry.routine_id === routineId),
        );

        if (target !== null) {
          entries.push({
            user_id: userId,
            routine_id: routineId,
            level: target,
            notes: null,
            updated_at: new Date().toISOString(),
          });
        }

        // Readiness only counts active members, so recompute it from the
        // entries we now hold rather than guessing a delta.
        const activeIds = new Set(
          prev.members.filter((m) => m.active).map((m) => m.id),
        );

        const readiness = prev.readiness.map((row) => {
          if (row.routine_id !== routineId) return row;

          const forRoutine = entries.filter((e) => e.routine_id === routineId);
          const ready = forRoutine.filter(
            (e) =>
              (e.level === "can_perform" || e.level === "lead") &&
              activeIds.has(e.user_id),
          ).length;

          return {
            ...row,
            learning: forRoutine.filter((e) => e.level === "learning").length,
            can_perform: forRoutine.filter((e) => e.level === "can_perform").length,
            lead: forRoutine.filter((e) => e.level === "lead").length,
            ready,
            short_by: row.member_count ? Math.max(row.member_count - ready, 0) : null,
            performable: row.member_count ? ready >= row.member_count : ready > 0,
          };
        });

        return { ...prev, entries, readiness };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save that change");
    } finally {
      setSavingCell(null);
    }
  }

  const routines = data?.routines ?? [];
  const members = data?.members ?? [];
  const shortRoutines = (data?.readiness ?? []).filter(
    (row) => row.short_by !== null && row.short_by > 0,
  );
  const unperformable = (data?.readiness ?? []).filter((row) => !row.performable);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Routines" value={routines.length} tone="purple" />
        <StatCard label="Members" value={members.length} />
        <StatCard
          label="Nobody ready"
          value={unperformable.length}
          hint="No one can perform it"
          tone={unperformable.length > 0 ? "amber" : "emerald"}
        />
        <StatCard
          label="Short of numbers"
          value={shortRoutines.length}
          hint="Fewer ready than the formation needs"
          tone={shortRoutines.length > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* Readiness — the answer to "can we actually put this on stage" */}
      <SectionCard title="Readiness" count={loading ? undefined : routines.length}>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <EmptyState message="No routines in the catalog yet." />
        ) : (
          <div className="divide-y divide-rose-50">
            {(data?.readiness ?? []).map((row) => (
              <div key={row.routine_id} className="px-5 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                  <Music className="w-4 h-4 text-purple-500" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{row.name}</p>
                  <p className="text-xs text-gray-400">
                    {row.ready} can perform
                    {row.member_count !== null && ` of ${row.member_count} needed`}
                    {row.lead > 0 && ` · ${row.lead} lead`}
                    {row.learning > 0 && ` · ${row.learning} learning`}
                  </p>
                </div>

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                    row.performable
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {row.performable
                    ? "Ready"
                    : row.short_by
                      ? `${row.short_by} short`
                      : "Not ready"}
                </span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* The grid */}
      <SectionCard
        title="Who knows what"
        action={
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1.5">
            <label className="text-xs text-gray-500 inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeInactive}
                onChange={(e) => setIncludeInactive(e.target.checked)}
                className="accent-rose-500"
              />
              Include inactive
            </label>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-500">
              {(Object.keys(LEVEL_LABELS) as ProficiencyLevel[]).map((level) => (
                <span key={level} className="inline-flex items-center gap-1">
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-semibold ${LEVEL_STYLES[level]}`}
                  >
                    {LEVEL_SHORT[level]}
                  </span>
                  {LEVEL_LABELS[level]}
                </span>
              ))}
            </div>
          </div>
        }
      >
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : members.length === 0 || routines.length === 0 ? (
          <EmptyState message="Add members and routines to build the grid." />
        ) : (
          <>
            <p className="px-5 pt-4 text-xs text-gray-400">
              Click a cell to move it through learning → can perform → lead →
              cleared.
            </p>
            <div className="overflow-x-auto p-5">
              <table className="text-sm border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide pb-2 pr-4">
                      Member
                    </th>
                    {routines.map((routine) => (
                      <th
                        key={routine.id}
                        className="px-1 pb-2 align-bottom"
                        title={routine.name}
                      >
                        <div className="h-28 flex items-end justify-center">
                          <span className="text-xs text-gray-500 whitespace-nowrap [writing-mode:vertical-rl] rotate-180">
                            {routine.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.id} className="group">
                      <td className="sticky left-0 bg-white z-10 pr-4 py-1 whitespace-nowrap">
                        <span className="inline-flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-rose-100 text-rose-600 text-[10px] font-semibold flex items-center justify-center">
                            {getInitials(member.first_name, member.last_name)}
                          </span>
                          <span
                            className={`text-sm ${member.active ? "text-gray-700" : "text-gray-400 line-through"}`}
                          >
                            {member.first_name} {member.last_name}
                          </span>
                        </span>
                      </td>

                      {routines.map((routine) => {
                        const key = `${member.id}:${routine.id}`;
                        const level = levels.get(key) ?? null;

                        return (
                          <td key={routine.id} className="px-1 py-1 text-center">
                            <button
                              onClick={() => cycleCell(member.id, routine.id)}
                              disabled={savingCell === key}
                              title={`${member.first_name} · ${routine.name}${
                                level ? ` · ${LEVEL_LABELS[level]}` : ""
                              }`}
                              className={`w-7 h-7 rounded text-[11px] font-semibold transition disabled:opacity-50 ${
                                level
                                  ? LEVEL_STYLES[level]
                                  : "bg-gray-50 text-gray-300 hover:bg-gray-100"
                              }`}
                            >
                              {level ? LEVEL_SHORT[level] : "–"}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </SectionCard>

      {!loading && members.length > 0 && (
        <p className="text-xs text-gray-400 inline-flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" />
          Readiness only counts active members, so somebody who has left the
          troupe cannot make a routine look coverable.
        </p>
      )}
    </div>
  );
}
