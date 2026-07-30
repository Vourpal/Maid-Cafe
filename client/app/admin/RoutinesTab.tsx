"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Music, Pencil, Plus, Trash2, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { Routine } from "@/types/admin";
import {
  EmptyState,
  SectionCard,
  StatCard,
  formatDate,
  inputClass,
} from "./shared";

export default function RoutinesTab() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [pendingDelete, setPendingDelete] = useState<Routine | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoutines(await apiFetch<Routine[]>("/routines"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load routines");
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
      await apiFetch("/routines", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          notes: newNotes.trim() || null,
        }),
      });
      toast.success("Routine added");
      setNewName("");
      setNewNotes("");
      setCreating(false);
      load();
    } catch (err) {
      // Duplicate names come back as a 409 with a readable message.
      toast.error(err instanceof Error ? err.message : "Failed to add routine");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(routine: Routine) {
    setEditingId(routine.id);
    setEditName(routine.name);
    setEditNotes(routine.notes ?? "");
  }

  async function handleUpdate(routine: Routine) {
    if (!editName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/routines/${routine.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editName.trim(),
          notes: editNotes.trim() || null,
        }),
      });
      setRoutines((prev) =>
        prev.map((r) =>
          r.id === routine.id
            ? { ...r, name: editName.trim(), notes: editNotes.trim() || null }
            : r,
        ),
      );
      setEditingId(null);
      toast.success("Routine updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update routine");
    } finally {
      setBusy(false);
    }
  }

  /**
   * Deleting a routine that is still attached to sessions detaches it from all
   * of them, so that case requires an explicit force confirmation.
   */
  async function handleDelete(routine: Routine, force: boolean) {
    setBusy(true);
    try {
      await apiFetch(`/routines/${routine.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      setRoutines((prev) => prev.filter((r) => r.id !== routine.id));
      setPendingDelete(null);
      toast.success(`Deleted "${routine.name}"`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete routine");
    } finally {
      setBusy(false);
    }
  }

  const unused = routines.filter((r) => r.usage_count === 0).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Routines" value={routines.length} />
        <StatCard
          label="Never used"
          value={unused}
          hint="Safe to delete"
          tone="gray"
        />
        <StatCard
          label="In rotation"
          value={routines.length - unused}
          tone="purple"
        />
      </div>

      <SectionCard
        title="Routine catalog"
        count={loading ? undefined : routines.length}
        action={
          <button
            onClick={() => setCreating((c) => !c)}
            className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New routine
          </button>
        }
      >
        {creating && (
          <div className="px-5 py-4 bg-rose-50/50 border-b border-rose-100 space-y-2">
            <input
              className={inputClass}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Routine name"
              autoFocus
            />
            <input
              className={inputClass}
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Notes (optional)"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreate}
                disabled={busy}
                className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
              >
                Add routine
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                  setNewNotes("");
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
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <EmptyState message="No routines in the catalog yet." />
        ) : (
          <div className="divide-y divide-rose-50">
            {routines.map((routine) => (
              <div key={routine.id} className="px-5 py-3">
                {editingId === routine.id ? (
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      autoFocus
                    />
                    <input
                      className={inputClass}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="Notes (optional)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(routine)}
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
                    <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-purple-500" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {routine.name}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {routine.usage_count === 0
                          ? "Not used in any session"
                          : `Used in ${routine.usage_count} session${routine.usage_count === 1 ? "" : "s"} · last ${formatDate(routine.last_used)}`}
                        {routine.notes && ` · ${routine.notes}`}
                      </p>
                    </div>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => startEdit(routine)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Rename"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(routine)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline delete confirmation, wording depends on usage */}
                {pendingDelete?.id === routine.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-800">
                      {routine.usage_count === 0
                        ? `Delete "${routine.name}"?`
                        : `"${routine.name}" is attached to ${routine.usage_count} practice session${routine.usage_count === 1 ? "" : "s"}. Deleting it removes it from all of them.`}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() =>
                          handleDelete(routine, routine.usage_count > 0)
                        }
                        disabled={busy}
                        className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                      >
                        {routine.usage_count === 0
                          ? "Delete"
                          : "Delete and detach"}
                      </button>
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
    </div>
  );
}
