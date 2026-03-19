"use client";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";

type EditEventProps = {
  eventIdProp: number;
  titleProp: string;
  descriptionProp: string | null;
  startDateProp: string;
  endDateProp: string;
  locationProp: string | null;
  maxAttendeesProp: number | null;
};

export default function EditEvents({
  titleProp,
  eventIdProp,
  descriptionProp,
  startDateProp,
  endDateProp,
  locationProp,
  maxAttendeesProp,
}: EditEventProps) {
  const router = useRouter();
  const [form, setForm] = useState(false);

  const { user } = useUserAuthentication();

  const [title, setTitle] = useState(titleProp);
  const [description, setDescription] = useState(descriptionProp ?? "");

  const start = new Date(startDateProp);
  const end = new Date(endDateProp);
  const [startDate, setStartDate] = useState(start.toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(end.toISOString().split("T")[0]);

  const [location, setLocation] = useState(locationProp ?? "");
  const [maxAttendees, setMaxAttendees] = useState<number | "">(
    maxAttendeesProp ?? "",
  );

  const [deleteEvent, setDeleteEvent] = useState(false);

  async function handleDelete() {
    try {
      const res = await fetch(`http://localhost:5000/events/${eventIdProp}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to delete event");

      setDeleteEvent(false);
      setForm(false);
      router.refresh();
    } catch (err) {
      console.error("Error deleting event:", err);
      setDeleteEvent(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    try {
      const res = await fetch(`http://localhost:5000/events/${eventIdProp}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          start_datetime: startDate + "T00:00:00",
          end_datetime: endDate + "T00:00:00",
          location,
          max_attendees: maxAttendees,
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
      <button onClick={() => setForm(true)}>Edit Event ADMIN ONLY</button>

      {form && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setForm(false)}
          />

          {/* Modal wrapper */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            {/* Modal box */}
            <div className="bg-white p-6 rounded max-w-md w-full pointer-events-auto">
              <button onClick={() => setForm(false)}>✕</button>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  value={title}
                  maxLength={100}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border p-2 rounded"
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
                />

                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="border p-2 rounded"
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
                  className="border p-2 rounded"
                />

                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded"
                >
                  Submit Event
                </button>
                {/* DELETE EVENT SECTION */}
                {!deleteEvent ? (
                  <button
                    type="button"
                    onClick={() => setDeleteEvent(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded"
                  >
                    Delete Event
                  </button>
                ) : (
                  <div className="flex flex-col gap-2 mt-4">
                    <p className="font-semibold text-red-700">
                      Are you sure you want to delete this event?
                    </p>

                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="px-4 py-2 bg-red-600 text-white rounded"
                      >
                        Yes, Delete
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteEvent(false)}
                        className="px-4 py-2 bg-gray-300 rounded"
                      >
                        No
                      </button>
                    </div>
                  </div>
                )}
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
