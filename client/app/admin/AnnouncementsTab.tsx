"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Megaphone, Pencil, Pin, PinOff, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type {
  Announcement,
  AnnouncementListResponse,
  AnnouncementPriority,
} from "@/types/admin";
import type { Event as EventType } from "@/types/event";
import {
  EmptyState,
  Field,
  SectionCard,
  StatCard,
  formatDateTime,
  inputClass,
  relativeTime,
} from "./shared";

const PRIORITIES: AnnouncementPriority[] = ["normal", "important", "urgent"];

const PRIORITY_STYLES: Record<AnnouncementPriority, string> = {
  normal: "bg-gray-100 text-gray-600",
  important: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

type Form = {
  title: string;
  body: string;
  priority: AnnouncementPriority;
  pinned: boolean;
  published: boolean;
  expiresAt: string;
  eventId: string;
};

const emptyForm: Form = {
  title: "",
  body: "",
  priority: "normal",
  pinned: false,
  published: true,
  expiresAt: "",
  eventId: "",
};

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

function isExpired(entry: Announcement): boolean {
  return entry.expires_at !== null && new Date(entry.expires_at) <= new Date();
}

/**
 * Announcement management.
 *
 * The list here asks for drafts and expired entries too, which only works
 * because the caller is an admin — the server ignores those switches for
 * everybody else, so a member cannot read a draft by guessing the parameter.
 */
export default function AnnouncementsTab() {
  const [data, setData] = useState<AnnouncementListResponse | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);

  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await apiFetch<AnnouncementListResponse>(
          "/announcements?include_unpublished=true&include_expired=true&quantity=100",
        ),
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load announcements",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<{ events: EventType[] }>("/events?quantity=100&future_only=true")
      .then((res) => setEvents(res.events))
      .catch(() => setEvents([]));
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setCreating(true);
  }

  function openEdit(entry: Announcement) {
    setForm({
      title: entry.title,
      body: entry.body,
      priority: entry.priority,
      pinned: entry.pinned,
      published: entry.published,
      expiresAt: toInputValue(entry.expires_at),
      eventId: entry.event_id !== null ? String(entry.event_id) : "",
    });
    setEditing(entry);
  }

  async function save() {
    if (!form.title.trim() || !form.body.trim()) {
      toast.error("Title and body are both required");
      return;
    }

    const payload = {
      title: form.title.trim(),
      body: form.body.trim(),
      priority: form.priority,
      pinned: form.pinned,
      published: form.published,
      // Null clears the expiry, making a notice permanent again.
      expires_at: form.expiresAt || null,
      event_id: form.eventId === "" ? null : Number(form.eventId),
    };

    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/announcements/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Announcement updated");
      } else {
        await apiFetch("/announcements", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success(
          payload.published ? "Announcement posted" : "Draft saved",
        );
      }
      setCreating(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function patch(entry: Announcement, body: Record<string, unknown>, message: string) {
    setBusy(true);
    try {
      await apiFetch(`/announcements/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      toast.success(message);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusy(false);
    }
  }

  async function remove(entry: Announcement) {
    setBusy(true);
    try {
      await apiFetch(`/announcements/${entry.id}`, { method: "DELETE" });
      toast.success(`Deleted "${entry.title}"`);
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  const entries = data?.announcements ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Live on the home page"
          value={stats?.live ?? 0}
          tone="emerald"
        />
        <StatCard label="Pinned" value={stats?.pinned ?? 0} tone="purple" />
        <StatCard label="Drafts" value={stats?.drafts ?? 0} tone="gray" />
        <StatCard label="Expired" value={stats?.expired ?? 0} tone="gray" />
      </div>

      <SectionCard
        title="Announcements"
        count={loading ? undefined : entries.length}
        action={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New announcement
          </button>
        }
      >
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <EmptyState message="Nothing posted yet. Announcements show up on the member home page." />
        ) : (
          <div className="divide-y divide-rose-50">
            {entries.map((entry) => {
              const expired = isExpired(entry);

              return (
                <div key={entry.id} className="px-5 py-4">
                  {/* Four actions cannot share a line with the text on a phone,
                      so they drop underneath. */}
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                        <Megaphone className="w-4 h-4 text-rose-500" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-800">{entry.title}</p>
                          {entry.pinned && (
                            <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                              <Pin className="w-3 h-3" />
                              Pinned
                            </span>
                          )}
                          {entry.priority !== "normal" && (
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full capitalize ${PRIORITY_STYLES[entry.priority]}`}
                            >
                              {entry.priority}
                            </span>
                          )}
                          {!entry.published && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Draft
                            </span>
                          )}
                          {expired && (
                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Expired
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">
                          {entry.body}
                        </p>

                        <p className="text-xs text-gray-400 mt-1.5">
                          {entry.author_label ?? "Unknown author"} ·{" "}
                          {relativeTime(entry.created_at)}
                          {entry.event_title && ` · ${entry.event_title}`}
                          {entry.expires_at &&
                          ` · ${expired ? "expired" : "expires"} ${formatDateTime(entry.expires_at)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1 shrink-0 pl-11 sm:pl-0 sm:ml-auto">
                      <button
                        onClick={() =>
                          patch(
                            entry,
                            { pinned: !entry.pinned },
                            entry.pinned ? "Unpinned" : "Pinned to the top",
                          )
                        }
                        disabled={busy}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600 disabled:opacity-60"
                        title={entry.pinned ? "Unpin" : "Pin to the top"}
                      >
                        {entry.pinned ? (
                          <PinOff className="w-3.5 h-3.5" />
                        ) : (
                          <Pin className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() =>
                          patch(
                            entry,
                            { published: !entry.published },
                            entry.published ? "Hidden from members" : "Published",
                          )
                        }
                        disabled={busy}
                        className="text-xs border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition text-gray-500"
                      >
                        {entry.published ? "Unpublish" : "Publish"}
                      </button>
                      <button
                        onClick={() => openEdit(entry)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(entry.id)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {pendingDelete === entry.id && (
                    <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                      <p className="text-sm text-red-800">
                        Delete &quot;{entry.title}&quot;? Unpublishing hides it
                        without losing the text.
                      </p>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => remove(entry)}
                          disabled={busy}
                          className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                        >
                          Delete
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
              );
            })}
          </div>
        )}
      </SectionCard>

      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? "Edit announcement" : "New announcement"}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          <Field label="Title">
            <input
              className={inputClass}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              autoFocus
            />
          </Field>

          <Field label="Body">
            <textarea
              className={inputClass}
              rows={5}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Line breaks are kept as written."
            />
          </Field>

          {/* datetime-local needs the full width on a phone. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                className={`${inputClass} capitalize`}
                value={form.priority}
                onChange={(e) =>
                  setForm({
                    ...form,
                    priority: e.target.value as AnnouncementPriority,
                  })
                }
              >
                {PRIORITIES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Expires">
              <input
                type="datetime-local"
                className={inputClass}
                value={form.expiresAt}
                onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Related event">
            <select
              className={inputClass}
              value={form.eventId}
              onChange={(e) => setForm({ ...form, eventId: e.target.value })}
            >
              <option value="">None</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-600 inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                className="accent-rose-500"
              />
              Pin to the top of the feed
            </label>
            <label className="text-sm text-gray-600 inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
                className="accent-rose-500"
              />
              Publish now (uncheck to keep it as a draft)
            </label>
          </div>

          <p className="text-xs text-gray-400">
            Leave the expiry empty for a notice that stays up until you remove it.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={busy}
              className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
            >
              {editing ? "Save changes" : form.published ? "Post" : "Save draft"}
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
