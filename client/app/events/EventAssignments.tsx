"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  BriefcaseBusiness,
  Check,
  Clock,
  Pencil,
  Plus,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import { ExportButton } from "../admin/shared";
import type {
  Assignment,
  EventAssignments as EventAssignmentsData,
  EventRoster as EventRosterData,
} from "@/types/admin";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

/** ISO string → the value a datetime-local input expects. */
function toInputValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

function clock(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function shiftLabel(starts: string | null, ends: string | null): string {
  if (!starts || !ends) return "All day";
  return `${clock(starts)} – ${clock(ends)}`;
}

function hoursLabel(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

type FormState = {
  userId: string;
  positionId: string;
  startsAt: string;
  endsAt: string;
  notes: string;
};

const emptyForm: FormState = {
  userId: "",
  positionId: "",
  startsAt: "",
  endsAt: "",
  notes: "",
};

/**
 * Shift assignment editor.
 *
 * Sits beside the roster editor: the roster decides who is coming, this decides
 * what they are doing. One person may hold several positions at the same event,
 * so the list is grouped by position and each row carries its own time window.
 *
 * Only people with an RSVP for the event can be assigned — the server enforces
 * it, and the member dropdown is built from the roster so the rule is visible
 * rather than a surprise error.
 */
export default function EventAssignments({
  eventId,
  onClose,
}: {
  eventId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventAssignmentsData | null>(null);
  const [roster, setRoster] = useState<EventRosterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm);

  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The roster drives the member dropdown, so both come in together.
      const [assignments, rosterData] = await Promise.all([
        apiFetch<EventAssignmentsData>(`/events/${eventId}/assignments`),
        apiFetch<EventRosterData>(`/events/${eventId}/attendances`),
      ]);
      setData(assignments);
      setRoster(rosterData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load shifts");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd(positionId?: number) {
    setForm({
      ...emptyForm,
      positionId: positionId ? String(positionId) : "",
      // Default a new shift to the event window; blanking both means "all day".
      startsAt: toInputValue(data?.event.start_datetime ?? null),
      endsAt: toInputValue(data?.event.end_datetime ?? null),
    });
    setAdding(true);
  }

  async function handleCreate() {
    if (!form.userId || !form.positionId) {
      toast.error("Pick a member and a position");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/events/${eventId}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          user_id: Number(form.userId),
          position_id: Number(form.positionId),
          starts_at: form.startsAt || null,
          ends_at: form.endsAt || null,
          notes: form.notes.trim() || null,
        }),
      });
      toast.success("Shift assigned");
      setAdding(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      // NOT_SIGNED_UP and the shift-window guard both surface here.
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry: Assignment) {
    setEditingId(entry.id);
    setEditForm({
      userId: String(entry.user_id),
      positionId: String(entry.position_id),
      startsAt: toInputValue(entry.starts_at),
      endsAt: toInputValue(entry.ends_at),
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit(entry: Assignment) {
    // Send only what moved. Nulls are meaningful: clearing both times turns a
    // timed shift back into a whole-event assignment.
    const payload: Record<string, unknown> = {};

    if (Number(editForm.userId) !== entry.user_id) {
      payload.user_id = Number(editForm.userId);
    }
    if (Number(editForm.positionId) !== entry.position_id) {
      payload.position_id = Number(editForm.positionId);
    }
    if (editForm.startsAt !== toInputValue(entry.starts_at)) {
      payload.starts_at = editForm.startsAt || null;
    }
    if (editForm.endsAt !== toInputValue(entry.ends_at)) {
      payload.ends_at = editForm.endsAt || null;
    }
    if (editForm.notes !== (entry.notes ?? "")) {
      payload.notes = editForm.notes.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/assignments/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Shift updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update shift");
    } finally {
      setBusy(false);
    }
  }

  async function removeAssignment(entry: Assignment) {
    setBusy(true);
    try {
      await apiFetch(`/assignments/${entry.id}`, { method: "DELETE" });
      toast.success(`Removed ${entry.first_name} from ${entry.position_name}`);
      setConfirmRemove(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove shift");
    } finally {
      setBusy(false);
    }
  }

  // Only people who are actually coming can hold a job, which is also what the
  // server enforces on POST.
  const assignable = (roster?.attendances ?? []).filter(
    (entry) => entry.status !== "not going" && entry.status !== "not_going",
  );

  // Shifts on positions the coverage list does not cover, i.e. archived ones.
  const activePositionIds = new Set(
    (data?.coverage ?? []).map((c) => c.position_id),
  );
  const archivedGroups = Object.entries(
    (data?.assignments ?? [])
      .filter((a) => !activePositionIds.has(a.position_id))
      .reduce<Record<string, Assignment[]>>((acc, entry) => {
        (acc[entry.position_name] ??= []).push(entry);
        return acc;
      }, {}),
  );

  function renderForm(
    state: FormState,
    setState: (next: FormState) => void,
    onSave: () => void,
    onCancel: () => void,
    saveLabel: string,
  ) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <select
            className={inputClass}
            value={state.userId}
            onChange={(e) => setState({ ...state, userId: e.target.value })}
          >
            <option value="">Select a member…</option>
            {assignable.map((entry) => (
              <option key={entry.user_id} value={entry.user_id}>
                {entry.first_name} {entry.last_name}
              </option>
            ))}
          </select>

          <select
            className={inputClass}
            value={state.positionId}
            onChange={(e) => setState({ ...state, positionId: e.target.value })}
          >
            <option value="">Select a position…</option>
            {(data?.positions ?? []).map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </div>

        {/* datetime-local needs close to full width on a phone or it clips. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="text-[11px] text-gray-400">
            Shift start
            <input
              type="datetime-local"
              className={inputClass}
              value={state.startsAt}
              onChange={(e) => setState({ ...state, startsAt: e.target.value })}
            />
          </label>
          <label className="text-[11px] text-gray-400">
            Shift end
            <input
              type="datetime-local"
              className={inputClass}
              value={state.endsAt}
              onChange={(e) => setState({ ...state, endsAt: e.target.value })}
            />
          </label>
        </div>

        <p className="text-[11px] text-gray-400">
          Leave both times empty for a whole-event assignment.
        </p>

        <input
          className={inputClass}
          value={state.notes}
          onChange={(e) => setState({ ...state, notes: e.target.value })}
          placeholder="Notes (optional)"
        />

        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
          >
            <Check className="w-3 h-3" />
            {saveLabel}
          </button>
          <button
            onClick={onCancel}
            className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={data ? `Shifts — ${data.event.title}` : "Shifts"}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !data ? (
        <p className="text-sm text-red-500">Could not load shifts.</p>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs bg-rose-50 rounded-xl px-4 py-3 text-gray-600">
            <span className="inline-flex items-center gap-1">
              <BriefcaseBusiness className="w-3.5 h-3.5 shrink-0" />
              {data.summary.assignments} shift
              {data.summary.assignments === 1 ? "" : "s"} across{" "}
              {data.summary.positions_filled}/{data.summary.positions_total}{" "}
              positions
            </span>
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5 shrink-0" />
              {data.summary.people_assigned}/{data.summary.signups} of the roster
              has a job
            </span>
            <span className="sm:ml-auto">
              <ExportButton
                path={`/exports/events/${eventId}/shifts.csv`}
                filename={`shifts-${eventId}.csv`}
                label="Print schedule"
              />
            </span>
          </div>

          {/* Problems worth seeing before the day itself */}
          {(data.unfilled_positions.length > 0 ||
            data.gaps.length > 0 ||
            data.double_booked.length > 0 ||
            data.summary.unassigned_count > 0) && (
            <div className="border border-amber-200 bg-amber-50 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Coverage
              </p>

              {data.unfilled_positions.length > 0 && (
                <p className="text-xs text-amber-800">
                  <span className="font-medium">Nobody assigned:</span>{" "}
                  {data.unfilled_positions.map((c) => c.name).join(", ")}
                </p>
              )}

              {data.gaps.length > 0 && (
                <div className="text-xs text-amber-800 space-y-0.5">
                  <span className="font-medium">Gaps in cover:</span>
                  {data.gaps.map((gap, index) => (
                    <p key={`${gap.position_id}-${index}`} className="pl-3">
                      {gap.name}: {clock(gap.start)} – {clock(gap.end)} (
                      {hoursLabel(gap.minutes)})
                    </p>
                  ))}
                </div>
              )}

              {data.double_booked.map((clash, index) => (
                <p key={index} className="text-xs text-red-700">
                  <span className="font-medium">{clash.name}</span> is booked as{" "}
                  {clash.first.position_name} and {clash.second.position_name} at
                  the same time.
                </p>
              ))}

              {data.summary.unassigned_count > 0 && (
                <p className="text-xs text-amber-800">
                  <span className="font-medium">
                    {data.summary.unassigned_count} signed up with no job:
                  </span>{" "}
                  {data.unassigned_signups
                    .map((p) => `${p.first_name} ${p.last_name}`)
                    .join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Add */}
          {adding ? (
            <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-3">
              {renderForm(
                form,
                setForm,
                handleCreate,
                () => {
                  setAdding(false);
                  setForm(emptyForm);
                },
                "Assign shift",
              )}
            </div>
          ) : (
            <button
              onClick={() => openAdd()}
              className="inline-flex items-center gap-1.5 text-xs border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign a shift
            </button>
          )}

          {assignable.length === 0 && (
            <p className="text-xs text-gray-400">
              Nobody has signed up for this event yet. Add people to the roster
              first, then assign positions.
            </p>
          )}

          {/* Grouped by position, so the holes are obvious */}
          <div className="space-y-3">
            {data.coverage.map((position) => {
              const shifts = data.assignments.filter(
                (a) => a.position_id === position.position_id,
              );

              return (
                <div
                  key={position.position_id}
                  className="border border-rose-100 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {position.name}
                    </span>
                    {position.assignments === 0 ? (
                      <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Unfilled
                      </span>
                    ) : position.covered ? (
                      <span className="text-[11px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
                        {position.whole_event ? "All day" : "Covered"}
                      </span>
                    ) : (
                      <span className="text-[11px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        {position.gaps.length} gap
                        {position.gaps.length === 1 ? "" : "s"}
                      </span>
                    )}

                    <button
                      onClick={() => openAdd(position.position_id)}
                      className="ml-auto text-[11px] text-rose-500 hover:text-rose-600 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add
                    </button>
                  </div>

                  {shifts.length === 0 ? (
                    <p className="px-4 py-3 text-xs text-gray-400">
                      No one assigned to this position.
                    </p>
                  ) : (
                    <div className="divide-y divide-rose-50">
                      {shifts.map((entry) => (
                        <div key={entry.id} className="px-4 py-2.5">
                          {editingId === entry.id ? (
                            renderForm(
                              editForm,
                              setEditForm,
                              () => saveEdit(entry),
                              () => setEditingId(null),
                              "Save",
                            )
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">
                                  {entry.first_name} {entry.last_name}
                                </p>
                                <p className="text-xs text-gray-400 inline-flex items-center gap-1">
                                  <Clock className="w-3 h-3 shrink-0" />
                                  {shiftLabel(entry.starts_at, entry.ends_at)}
                                  {entry.notes && ` · ${entry.notes}`}
                                </p>
                              </div>

                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                                  title="Edit shift"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                {confirmRemove === entry.id ? (
                                  <button
                                    onClick={() => removeAssignment(entry)}
                                    disabled={busy}
                                    className="text-xs bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                                  >
                                    Confirm
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmRemove(entry.id)}
                                    className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                                    title="Remove shift"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/*
            Coverage only covers active positions. If a position was archived
            after being assigned, its shifts still exist and still need to show
            up somewhere, so they get their own group.
          */}
          {archivedGroups.length > 0 && (
            <div className="space-y-3">
              {archivedGroups.map(([name, shifts]) => (
                <div
                  key={name}
                  className="border border-gray-200 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-2 bg-gray-50 flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {name}
                    </span>
                    <span className="text-[11px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Archived position
                    </span>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {shifts.map((entry) => (
                      <div
                        key={entry.id}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {entry.first_name} {entry.last_name}
                          </p>
                          <p className="text-xs text-gray-400">
                            {shiftLabel(entry.starts_at, entry.ends_at)}
                          </p>
                        </div>
                        {confirmRemove === entry.id ? (
                          <button
                            onClick={() => removeAssignment(entry)}
                            disabled={busy}
                            className="text-xs bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition shrink-0"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(entry.id)}
                            className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600 shrink-0"
                            title="Remove shift"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.positions.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">
              No positions in the catalog yet. Add some in Admin → Shifts.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
