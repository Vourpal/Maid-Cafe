"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Music,
  Pencil,
  Plus,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type { Routine, RoutineDifficulty } from "@/types/admin";
import {
  EmptyState,
  Field,
  SectionCard,
  StatCard,
  formatDate,
  inputClass,
} from "./shared";

const DIFFICULTIES: RoutineDifficulty[] = ["easy", "medium", "hard"];

const DIFFICULTY_STYLES: Record<RoutineDifficulty, string> = {
  easy: "bg-emerald-100 text-emerald-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

type Form = {
  name: string;
  notes: string;
  musicUrl: string;
  videoUrl: string;
  duration: string;
  bpm: string;
  formationNotes: string;
  difficulty: string;
  memberCount: string;
};

const emptyForm: Form = {
  name: "",
  notes: "",
  musicUrl: "",
  videoUrl: "",
  duration: "",
  bpm: "",
  formationNotes: "",
  difficulty: "",
  memberCount: "",
};

/** Seconds → "3:24". */
function formatDuration(seconds: number | null): string {
  if (seconds === null) return "";
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Accepts "3:24" or a plain number of seconds, so nobody has to think about
 * which one the field wants. Returns null for empty, undefined for junk.
 */
function parseDuration(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (!trimmed) return null;

  if (trimmed.includes(":")) {
    const [mins, secs] = trimmed.split(":");
    const minutes = Number(mins);
    const seconds = Number(secs);
    if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return undefined;
    return minutes * 60 + seconds;
  }

  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

export default function RoutinesTab() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Routine | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const [pendingDelete, setPendingDelete] = useState<Routine | null>(null);

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

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(routine: Routine) {
    setForm({
      name: routine.name,
      notes: routine.notes ?? "",
      musicUrl: routine.music_url ?? "",
      videoUrl: routine.video_url ?? "",
      duration: formatDuration(routine.duration_seconds),
      bpm: routine.bpm !== null ? String(routine.bpm) : "",
      formationNotes: routine.formation_notes ?? "",
      difficulty: routine.difficulty ?? "",
      memberCount:
        routine.member_count !== null ? String(routine.member_count) : "",
    });
    setEditing(routine);
  }

  function buildPayload() {
    const duration = parseDuration(form.duration);
    if (duration === undefined) {
      toast.error("Duration should look like 3:24, or a number of seconds");
      return null;
    }

    return {
      name: form.name.trim(),
      notes: form.notes.trim() || null,
      music_url: form.musicUrl.trim() || null,
      video_url: form.videoUrl.trim() || null,
      duration_seconds: duration,
      bpm: form.bpm === "" ? null : Number(form.bpm),
      formation_notes: form.formationNotes.trim() || null,
      difficulty: form.difficulty || null,
      member_count: form.memberCount === "" ? null : Number(form.memberCount),
    };
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/routines/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Routine updated");
      } else {
        await apiFetch("/routines", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Routine added");
      }
      setCreating(false);
      setEditing(null);
      load();
    } catch (err) {
      // Duplicate names come back as a 409 with a readable message.
      toast.error(err instanceof Error ? err.message : "Failed to save routine");
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
  const missingMusic = routines.filter((r) => !r.music_url).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Routines" value={routines.length} />
        <StatCard
          label="In rotation"
          value={routines.length - unused}
          tone="purple"
        />
        <StatCard
          label="Never used"
          value={unused}
          hint="Safe to delete"
          tone="gray"
        />
        <StatCard
          label="No music link"
          value={missingMusic}
          hint="Nothing to practise to"
          tone={missingMusic > 0 ? "amber" : "emerald"}
        />
      </div>

      <SectionCard
        title="Routine catalog"
        count={loading ? undefined : routines.length}
        action={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New routine
          </button>
        }
      >
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <EmptyState message="No routines in the catalog yet." />
        ) : (
          <div className="divide-y divide-rose-50">
            {routines.map((routine) => (
              <div key={routine.id} className="px-5 py-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center shrink-0">
                    <Music className="w-4 h-4 text-purple-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-800">{routine.name}</p>
                      {routine.difficulty && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full capitalize ${DIFFICULTY_STYLES[routine.difficulty]}`}
                        >
                          {routine.difficulty}
                        </span>
                      )}
                      {routine.ready_count !== undefined && (
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                            routine.member_count &&
                            routine.ready_count < routine.member_count
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          <Users className="w-3 h-3" />
                          {routine.ready_count} ready
                          {routine.member_count !== null &&
                            ` / ${routine.member_count}`}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 mt-0.5">
                      {routine.usage_count === 0
                        ? "Not used in any session"
                        : `Used in ${routine.usage_count} session${routine.usage_count === 1 ? "" : "s"} · last ${formatDate(routine.last_used ?? null)}`}
                      {routine.duration_seconds !== null &&
                        ` · ${formatDuration(routine.duration_seconds)}`}
                      {routine.bpm !== null && ` · ${routine.bpm} BPM`}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      {routine.music_url && (
                        <a
                          href={routine.music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Music className="w-3 h-3" />
                          Music
                        </a>
                      )}
                      {routine.video_url && (
                        <a
                          href={routine.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" />
                          Reference video
                        </a>
                      )}
                    </div>

                    {routine.formation_notes && (
                      <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                        {routine.formation_notes}
                      </p>
                    )}
                    {routine.notes && (
                      <p className="text-xs text-gray-400 mt-1">{routine.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => openEdit(routine)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                      title="Edit"
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

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New routine"}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </Field>

          <Field label="Music track">
            <input
              className={inputClass}
              value={form.musicUrl}
              onChange={(e) => setForm({ ...form, musicUrl: e.target.value })}
              placeholder="Link to the track you practise to"
            />
          </Field>

          <Field label="Reference video">
            <input
              className={inputClass}
              value={form.videoUrl}
              onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
              placeholder="Link to the choreography you are following"
            />
          </Field>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Duration">
              <input
                className={inputClass}
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                placeholder="3:24"
              />
            </Field>
            <Field label="BPM">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.bpm}
                onChange={(e) => setForm({ ...form, bpm: e.target.value })}
              />
            </Field>
            <Field label="Difficulty">
              <select
                className={`${inputClass} capitalize`}
                value={form.difficulty}
                onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              >
                <option value="">Unset</option>
                {DIFFICULTIES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Members needed">
            <input
              type="number"
              min={1}
              className={inputClass}
              value={form.memberCount}
              onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
              placeholder="How many people the formation needs"
            />
          </Field>

          <Field label="Formation / choreography notes">
            <textarea
              className={inputClass}
              rows={4}
              value={form.formationNotes}
              onChange={(e) =>
                setForm({ ...form, formationNotes: e.target.value })
              }
              placeholder="Positions, entrances, counts — line breaks are kept."
            />
          </Field>

          <Field label="General notes">
            <input
              className={inputClass}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <p className="text-xs text-gray-400">
            Members needed drives the readiness check on the Proficiency tab.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy}
              className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
            >
              {editing ? "Save changes" : "Add routine"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
