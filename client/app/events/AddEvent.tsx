"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";

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
        }),
      });

      if (!res.ok) throw new Error("Failed to create event");

      setForm(false); // close modal on success
      router.refresh();
    } catch (err) {
      console.error("Error creating event:", err);
    }
  }

  return (
    <div>
      <button onClick={() => setForm(true)} className="px-4 py-2 bg-green-600 text-white rounded">Add Event</button >

      {form && (
        <>
          {/* backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setForm(false)}
          />

          {/* modal */}
          <div className="fixed inset-0 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded max-w-md w-full">
              <button onClick={() => setForm(false)}>✕</button>
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border p-2 rounded"
                  required
                />

                <textarea
                  placeholder="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={255}
                  className="border p-2 rounded"
                />

                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border p-2 rounded"
                  required
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border p-2 rounded"
                  required
                />

                <input
                  type="text"
                  placeholder="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="border p-2 rounded"
                />

                <input
                  type="number"
                  placeholder="Max Attendees"
                  value={maxAttendees}
                  min={1}
                  onChange={(e) =>
                    setMaxAttendees(
                      e.target.value === "" ? "" : Number(e.target.value),
                    )
                  }
                  required
                  className="border p-2 rounded"
                />

                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Submit Event
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
