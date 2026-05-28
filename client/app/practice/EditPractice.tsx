"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders } from "@/lib/api";
import { PracticeSessions } from "@/types/event";

type Props = {
  session: PracticeSessions;
  setSessions: React.Dispatch<React.SetStateAction<PracticeSessions[]>>;
};

function toLocalISOWithOffset(datetimeLocal: string): string {
  const date = new Date(datetimeLocal);

  const offsetMinutes = date.getTimezoneOffset();
  const sign = offsetMinutes <= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);

  const hours = String(Math.floor(absOffset / 60)).padStart(2, "0");
  const mins = String(absOffset % 60).padStart(2, "0");

  return `${datetimeLocal.replace("T", " ")}:00${sign}${hours}:${mins}`;
}

function formatForInput(dateString: string) {
  const date = new Date(dateString);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const hours = String(date.getHours()).padStart(2, "0");
  const mins = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${mins}`;
}

export default function EditPractice({
  session,
  setSessions,
}: Props) {
  const [open, setOpen] = useState(false);

  const [title, setTitle] = useState(session.title);
  const [location, setLocation] = useState(session.location || "");
  const [date, setDate] = useState(formatForInput(session.date));
  const [notes, setNotes] = useState(session.notes || "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const formattedDate = toLocalISOWithOffset(date);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session.id}`,
        {
          method: "PUT",
          headers: authHeaders(),
          body: JSON.stringify({
            title,
            location,
            date: formattedDate,
            notes,
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update practice");
      }

      setSessions((prev) =>
        prev.map((p) =>
          p.id === session.id
            ? {
                ...p,
                title,
                location,
                date: formattedDate,
                notes,
              }
            : p
        )
      );

      toast.success("Practice updated!");
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update practice");
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline"
        className="border-rose-200"
      >
        Edit Practice
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  ✏️ Edit Practice
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-4"
              >
                <Field>
                  <FieldLabel>Title</FieldLabel>

                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Location</FieldLabel>

                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel>Date & Time</FieldLabel>

                  <Input
                    type="datetime-local"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Notes</FieldLabel>

                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm w-full"
                  />
                </Field>

                <div className="flex gap-2 mt-2">
                  <Button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                  >
                    Save Changes
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}