"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Car, Check, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type {
  EventRoster as EventRosterData,
  RosterEntry,
  StaffListResponse,
  StaffMember,
} from "@/types/admin";

const STATUSES = ["going", "maybe", "not going"];
const ROLES = ["Driver", "Passenger"];

const inputClass =
  "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

/**
 * Admin roster editor.
 *
 * Members can only manage their own RSVP; this gives admins the ability to fix
 * a wrong sign-up, reassign a driver, add somebody who relayed their RSVP
 * off-platform, or clear a no-show.
 */
export default function EventRoster({
  eventId,
  onClose,
}: {
  eventId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventRosterData | null>(null);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editSeats, setEditSeats] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [addUserId, setAddUserId] = useState("");
  const [addStatus, setAddStatus] = useState("going");
  const [addRole, setAddRole] = useState("");
  const [addSeats, setAddSeats] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<EventRosterData>(`/events/${eventId}/attendances`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!adding || staff.length > 0) return;
    apiFetch<StaffListResponse>("/users?quantity=1000&sort=name")
      .then((res) => setStaff(res.users))
      .catch(() => toast.error("Could not load staff list"));
  }, [adding, staff.length]);

  function startEdit(entry: RosterEntry) {
    setEditingId(entry.id);
    setEditStatus(entry.status);
    setEditRole(entry.role ?? "");
    setEditSeats(entry.seats_available !== null ? String(entry.seats_available) : "");
    setEditNotes(entry.notes ?? "");
  }

  async function saveEdit(entry: RosterEntry) {
    // Only send changed fields. Nulls are meaningful: they clear a carpool role
    // or seat count rather than leaving it as-is.
    const payload: Record<string, unknown> = {};
    if (editStatus !== entry.status) payload.status = editStatus;
    if ((editRole || null) !== entry.role) payload.role = editRole || null;
    if (editNotes !== (entry.notes ?? "")) payload.notes = editNotes || null;

    const seats = editSeats === "" ? null : Number(editSeats);
    if (seats !== entry.seats_available) payload.seats_available = seats;

    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/attendances/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(`Updated ${entry.first_name}'s RSVP`);
      setEditingId(null);
      load();
    } catch (err) {
      // Carpool guards (no seats left, seats below passenger count) surface here.
      toast.error(err instanceof Error ? err.message : "Failed to update RSVP");
    } finally {
      setBusy(false);
    }
  }

  async function removeEntry(entry: RosterEntry) {
    setBusy(true);
    try {
      await apiFetch(`/attendances/${entry.id}`, { method: "DELETE" });
      toast.success(`Removed ${entry.first_name} ${entry.last_name}`);
      setConfirmRemove(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setBusy(false);
    }
  }

  async function addEntry() {
    if (!addUserId) {
      toast.error("Pick a staff member");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/events/${eventId}/attendances`, {
        method: "POST",
        body: JSON.stringify({
          user_id: Number(addUserId),
          status: addStatus,
          role: addRole || null,
          seats_available: addSeats === "" ? null : Number(addSeats),
        }),
      });
      toast.success("Added to roster");
      setAdding(false);
      setAddUserId("");
      setAddRole("");
      setAddSeats("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add");
    } finally {
      setBusy(false);
    }
  }

  const alreadyOnRoster = new Set(data?.attendances.map((a) => a.user_id) ?? []);
  const addable = staff.filter((m) => !alreadyOnRoster.has(m.id));

  return (
    <Modal
      open
      onClose={onClose}
      title={data ? `Roster — ${data.event.title}` : "Roster"}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : !data ? (
        <p className="text-sm text-red-500">Could not load roster.</p>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap gap-3 text-xs bg-rose-50 rounded-xl px-4 py-3 text-gray-600">
            <span className="inline-flex items-center gap-1">
              <Users className="w-3.5 h-3.5" />
              {data.summary.going} going
              {data.event.max_attendees ? ` / ${data.event.max_attendees}` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <Car className="w-3.5 h-3.5" />
              {data.summary.passengers}/{data.summary.seats_offered} carpool seats
              used
            </span>
            {data.summary.spots_left !== null && data.summary.spots_left <= 0 && (
              <span className="text-red-600 font-medium">At capacity</span>
            )}
          </div>

          {/* Add member */}
          {adding ? (
            <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-3 space-y-2">
              <select
                className={inputClass}
                value={addUserId}
                onChange={(e) => setAddUserId(e.target.value)}
              >
                <option value="">Select a staff member…</option>
                {addable.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-3 gap-2">
                <select
                  className={inputClass}
                  value={addStatus}
                  onChange={(e) => setAddStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  className={inputClass}
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                >
                  <option value="">No carpool role</option>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={addSeats}
                  onChange={(e) => setAddSeats(e.target.value)}
                  placeholder="Seats"
                  disabled={addRole !== "Driver"}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addEntry}
                  disabled={busy}
                  className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
                >
                  Add to roster
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-white transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-xs border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add member
            </button>
          )}

          {/* Roster */}
          {data.attendances.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nobody has signed up yet.
            </p>
          ) : (
            <div className="border border-rose-100 rounded-xl divide-y divide-rose-50 max-h-96 overflow-y-auto">
              {data.attendances.map((entry) => (
                <div key={entry.id} className="px-4 py-2.5">
                  {editingId === entry.id ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-800">
                        {entry.first_name} {entry.last_name}
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          className={inputClass}
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <select
                          className={inputClass}
                          value={editRole}
                          onChange={(e) => setEditRole(e.target.value)}
                        >
                          <option value="">No carpool role</option>
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min={0}
                          className={inputClass}
                          value={editSeats}
                          onChange={(e) => setEditSeats(e.target.value)}
                          placeholder="Seats"
                          disabled={editRole !== "Driver"}
                        />
                      </div>
                      <input
                        className={inputClass}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Notes"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(entry)}
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
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {entry.first_name} {entry.last_name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {entry.status}
                          {entry.role && ` · ${entry.role}`}
                          {entry.seats_available !== null &&
                            ` · ${entry.seats_available} seats`}
                          {entry.notes && ` · ${entry.notes}`}
                        </p>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(entry)}
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                          title="Edit RSVP"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {confirmRemove === entry.id ? (
                          <button
                            onClick={() => removeEntry(entry)}
                            disabled={busy}
                            className="text-xs bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                          >
                            Confirm
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(entry.id)}
                            className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                            title="Remove from event"
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
      )}
    </Modal>
  );
}
