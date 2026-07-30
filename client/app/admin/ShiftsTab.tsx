"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  BriefcaseBusiness,
  Check,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import EventAssignments from "../events/EventAssignments";
import type { EventShiftSummary, Position } from "@/types/admin";
import {
  EmptyState,
  ExportButton,
  SectionCard,
  StatCard,
  formatDateTime,
  inputClass,
} from "./shared";

/**
 * Shift management.
 *
 * Two halves: the position catalog (the job list itself, editable so it can
 * follow the venue rather than a migration) and per-event coverage, which is the
 * way in to the assignment editor.
 */
export default function ShiftsTab() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [coverage, setCoverage] = useState<EventShiftSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Position | null>(null);
  const [shiftsEventId, setShiftsEventId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [positionList, coverageList] = await Promise.all([
        apiFetch<Position[]>("/positions?include_inactive=true"),
        apiFetch<EventShiftSummary[]>("/assignments/coverage"),
      ]);
      setPositions(positionList);
      setCoverage(coverageList);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate() {
    if (!newName.trim()) {
      toast.error("Name is required");
      return;
    }

    setBusy(true);
    try {
      await apiFetch("/positions", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim() || null,
        }),
      });
      toast.success("Position added");
      setNewName("");
      setNewDescription("");
      setCreating(false);
      load();
    } catch (err) {
      // Duplicate names come back as a 409 with a readable message.
      toast.error(err instanceof Error ? err.message : "Failed to add position");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(position: Position) {
    setEditingId(position.id);
    setEditName(position.name);
    setEditDescription(position.description ?? "");
  }

  async function handleUpdate(position: Position) {
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/positions/${position.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });
      setEditingId(null);
      toast.success("Position updated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update position");
    } finally {
      setBusy(false);
    }
  }

  /** Archiving keeps historical assignments readable; deleting cannot. */
  async function toggleActive(position: Position) {
    setBusy(true);
    try {
      await apiFetch(`/positions/${position.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !position.active }),
      });
      toast.success(position.active ? "Position archived" : "Position restored");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update position");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(position: Position) {
    setBusy(true);
    try {
      await apiFetch(`/positions/${position.id}`, { method: "DELETE" });
      setPositions((prev) => prev.filter((p) => p.id !== position.id));
      setPendingDelete(null);
      toast.success(`Deleted "${position.name}"`);
    } catch (err) {
      // POSITION_IN_USE explains why archiving is the right move instead.
      toast.error(err instanceof Error ? err.message : "Failed to delete position");
    } finally {
      setBusy(false);
    }
  }

  const visible = showArchived ? positions : positions.filter((p) => p.active);
  const understaffed = coverage.filter(
    (event) => event.signups > 0 && event.people_unassigned > 0,
  ).length;
  const unstaffed = coverage.filter((event) => event.assignments === 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Positions"
          value={positions.filter((p) => p.active).length}
          hint={`${positions.length - positions.filter((p) => p.active).length} archived`}
        />
        <StatCard label="Upcoming events" value={coverage.length} tone="purple" />
        <StatCard
          label="No shifts yet"
          value={unstaffed}
          hint="Nobody assigned"
          tone={unstaffed > 0 ? "amber" : "emerald"}
        />
        <StatCard
          label="Partly staffed"
          value={understaffed}
          hint="Signed up without a job"
          tone={understaffed > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* Per-event coverage */}
      <SectionCard
        title="Event coverage"
        count={loading ? undefined : coverage.length}
      >
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : coverage.length === 0 ? (
          <EmptyState message="No upcoming events to staff." />
        ) : (
          <div className="divide-y divide-rose-50">
            {coverage.map((event) => (
              <div
                key={event.event_id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                    <BriefcaseBusiness className="w-4 h-4 text-rose-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(event.start_datetime)}
                      {event.location && ` · ${event.location}`}
                    </p>
                    <p className="text-xs mt-0.5">
                      {event.assignments === 0 ? (
                        <span className="text-amber-600">No shifts assigned</span>
                      ) : (
                        <span className="text-gray-500">
                          {event.assignments} shift
                          {event.assignments === 1 ? "" : "s"} ·{" "}
                          {event.positions_filled} position
                          {event.positions_filled === 1 ? "" : "s"} covered
                        </span>
                      )}
                      {event.people_unassigned > 0 && (
                        <span className="text-amber-600">
                          {" "}
                          · {event.people_unassigned} signed up without a job
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 pl-11 sm:pl-0">
                  <button
                    onClick={() => setShiftsEventId(event.event_id)}
                    className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
                  >
                    Manage shifts
                  </button>
                  <ExportButton
                    path={`/exports/events/${event.event_id}/shifts.csv`}
                    filename={`shifts-${event.event_id}.csv`}
                    label="CSV"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Position catalog */}
      <SectionCard
        title="Position catalog"
        count={loading ? undefined : visible.length}
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="text-xs text-gray-500 inline-flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="accent-rose-500"
              />
              Show archived
            </label>
            <button
              onClick={() => setCreating((c) => !c)}
              className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New position
            </button>
          </div>
        }
      >
        {creating && (
          <div className="px-5 py-4 bg-rose-50/50 border-b border-rose-100 space-y-2">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Position name (e.g. Barista)"
              autoFocus
            />
            <input
              className={inputClass}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="What the job involves (optional)"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={busy}
                className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
              >
                Add position
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setNewDescription("");
                }}
                className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-white transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState message="No positions yet. Add the jobs your events need." />
        ) : (
          <div className="divide-y divide-rose-50">
            {visible.map((position) => (
              <div key={position.id} className="px-5 py-3">
                {editingId === position.id ? (
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <input
                      className={inputClass}
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      placeholder="Description (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(position)}
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
                      >
                        <Check className="w-3 h-3" />
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                      >
                        <X className="w-3 h-3" />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {position.name}
                        {!position.active && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">
                            Archived
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {position.description ?? "No description"}
                        {` · used in ${position.usage_count} assignment${position.usage_count === 1 ? "" : "s"}`}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(position)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(position)}
                        disabled={busy}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600 disabled:opacity-60"
                        title={position.active ? "Archive" : "Restore"}
                      >
                        {position.active ? (
                          <Archive className="w-3.5 h-3.5" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => setPendingDelete(position)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {pendingDelete?.id === position.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-800">
                      {position.usage_count === 0
                        ? `Delete "${position.name}"?`
                        : `"${position.name}" is used by ${position.usage_count} assignment${position.usage_count === 1 ? "" : "s"} and cannot be deleted. Archive it instead to keep past schedules readable.`}
                    </p>
                    <div className="flex gap-2 mt-2">
                      {position.usage_count === 0 ? (
                        <button
                          onClick={() => handleDelete(position)}
                          disabled={busy}
                          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                        >
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setPendingDelete(null);
                            toggleActive(position);
                          }}
                          disabled={busy}
                          className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-60 transition"
                        >
                          Archive instead
                        </button>
                      )}
                      <button
                        onClick={() => setPendingDelete(null)}
                        className="text-xs text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {shiftsEventId !== null && (
        <EventAssignments
          eventId={shiftsEventId}
          onClose={() => {
            setShiftsEventId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
