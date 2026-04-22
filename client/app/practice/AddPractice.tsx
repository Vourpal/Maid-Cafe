"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders } from "@/lib/api";
import { PracticeSessions } from "@/types/event";

type PracticeProps = {
  setSessions: React.Dispatch<React.SetStateAction<PracticeSessions[]>>;
};

export default function AddPractice({ setSessions }: PracticeProps) {
  const [form, setForm] = useState(false);
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      // ✅ Convert datetime-local → SQL format
      const formattedDate = date.replace("T", " ") + ":00";

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            title,
            location,
            date: formattedDate,
            notes,
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to create practice session");

      const data = await res.json();

      const createdSession: PracticeSessions = {
        id: data.data.id,
        title,
        location,
        date: formattedDate, // ✅ keep consistent with backend format
        notes,
      };

      setSessions((prev) => [...prev, createdSession]);
      toast.success("Practice session created!");

      setForm(false);
      setTitle("");
      setLocation("");
      setDate("");
      setNotes("");
    } catch (err) {
      console.error("Error creating practice session:", err);
      toast.error("Failed to create practice session");
    }
  }

  return (
    <div>
      <Button
        onClick={() => setForm(true)}
        className="bg-rose-500 hover:bg-rose-600 text-white rounded-full"
      >
        + Add Practice
      </Button>

      {form && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setForm(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  🎀 Add Practice Session
                </h2>
                <button
                  onClick={() => setForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                    type="datetime-local" // ✅ updated
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
                    Create Practice
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="border-rose-200 text-gray-600 flex-1"
                    onClick={() => setForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}