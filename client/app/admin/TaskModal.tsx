"use client";

import { useState } from "react";
import { toast } from "sonner";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type { StaffMember, Task } from "@/types/admin";
import type { Event } from "@/types/event";
import { Field, inputClass } from "./shared";

type Props = {
  /** Omitted when creating. */
  task?: Task | null;
  staff: StaffMember[];
  events: Event[];
  onClose: () => void;
  onSaved: () => void;
};

/** datetime-local needs "YYYY-MM-DDTHH:mm" in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TaskModal({
  task,
  staff,
  events,
  onClose,
  onSaved,
}: Props) {
  const isEdit = Boolean(task);

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assignedTo, setAssignedTo] = useState<string>(
    task?.assigned_to ? String(task.assigned_to) : "",
  );
  const [eventId, setEventId] = useState<string>(
    task?.event_id ? String(task.event_id) : "",
  );
  const [dueDate, setDueDate] = useState(toLocalInput(task?.due_date ?? null));
  const [completed, setCompleted] = useState(task?.completed ?? false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    // Explicit nulls matter here: they are how the API clears an assignee,
    // event link or due date rather than leaving it untouched.
    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      assigned_to: assignedTo ? Number(assignedTo) : null,
      event_id: eventId ? Number(eventId) : null,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      completed,
    };

    setSaving(true);
    try {
      await apiFetch(isEdit ? `/tasks/${task!.id}` : "/tasks", {
        method: isEdit ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      toast.success(isEdit ? "Task updated" : "Task created");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? "Edit task" : "New task"}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <Field label="Title">
          <input
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Print menus for the spring event"
          />
        </Field>

        <Field label="Description">
          <textarea
            className={`${inputClass} min-h-[80px] resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional detail"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Assign to">
            <select
              className={inputClass}
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
            >
              <option value="">Unassigned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due date">
            <input
              type="datetime-local"
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Link to event">
          <select
            className={inputClass}
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
          >
            <option value="">Not tied to an event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </Field>

        {isEdit && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={completed}
              onChange={(e) => setCompleted(e.target.checked)}
              className="accent-rose-500"
            />
            <span className="text-sm text-gray-700">Mark as complete</span>
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
          >
            {saving ? "Saving..." : isEdit ? "Save changes" : "Create task"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
