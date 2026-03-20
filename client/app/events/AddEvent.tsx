"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

export default function AddEvent() {
  const router = useRouter();
  const [form, setForm] = useState(false);
  const { user } = useUserAuthentication();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState<number | "">("");
  const [status, setStatus] = useState("draft");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("http://localhost:5000/events", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          start_datetime: startDate + "T00:00:00",
          end_datetime: endDate + "T00:00:00",
          location,
          max_attendees: maxAttendees,
          created_by: user.id,
          status,
        }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      setForm(false);
      router.refresh();
    } catch (err) {
      console.error("Error creating event:", err);
    }
  }

  return (
    <div>
      <Button
        onClick={() => setForm(true)}
        className="bg-rose-500 hover:bg-rose-600 text-white rounded-full"
      >
        + Add Event
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
                <h2 className="text-rose-500 font-semibold text-lg">🎀 Add Event</h2>
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
                    type="text"
                    placeholder="Event title"
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    placeholder="What's this event about?"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={255}
                    rows={3}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>End Date</FieldLabel>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Location</FieldLabel>
                  <Input
                    type="text"
                    placeholder="Where is it?"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>Max Attendees</FieldLabel>
                  <Input
                    type="number"
                    placeholder="How many spots?"
                    value={maxAttendees}
                    min={1}
                    onChange={(e) =>
                      setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="border-rose-200 focus:ring-rose-300"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </Field>

                <div className="flex gap-2 mt-2">
                  <Button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                  >
                    Create Event
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