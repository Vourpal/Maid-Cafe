"use client";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

type EditEventProps = {
  eventIdProp: number;
  titleProp: string;
  descriptionProp: string | null;
  startDateProp: string;
  endDateProp: string;
  locationProp: string | null;
  maxAttendeesProp: number | null;
  statusProps: string;
};

export default function EditEvents({
  titleProp,
  eventIdProp,
  descriptionProp,
  startDateProp,
  endDateProp,
  locationProp,
  maxAttendeesProp,
  statusProps,
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
  const [maxAttendees, setMaxAttendees] = useState<number | "">(maxAttendeesProp ?? "");
  const [status, setStatus] = useState(statusProps);
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
          status,
        }),
      });
      if (!res.ok) throw new Error("Failed to update event");
      setForm(false);
      router.refresh();
    } catch (err) {
      console.error("Error updating event:", err);
    }
  }

  return (
    <div>
      <Button
        size="sm"
        variant="outline"
        className="border-rose-300 text-rose-500 hover:bg-rose-50"
        onClick={() => setForm(true)}
      >
        Edit Event
      </Button>

      {form && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setForm(false)}
          />

          {/* Modal wrapper */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg overflow-y-auto max-h-[90vh]">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">🎀 Edit Event</h2>
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
                    value={title}
                    maxLength={100}
                    onChange={(e) => setTitle(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={255}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
                    rows={3}
                  />
                </Field>

                <Field>
                  <FieldLabel>Start Date</FieldLabel>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>End Date</FieldLabel>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>Location</FieldLabel>
                  <Input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="border-rose-200 focus:ring-rose-300"
                  />
                </Field>

                <Field>
                  <FieldLabel>Max Attendees</FieldLabel>
                  <Input
                    type="number"
                    value={maxAttendees}
                    min={1}
                    onChange={(e) =>
                      setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))
                    }
                    className="border-rose-200 focus:ring-rose-300"
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
                    Save
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

                {/* DELETE SECTION */}
                {!deleteEvent ? (
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => setDeleteEvent(true)}
                    className="w-full"
                  >
                    Delete Event
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2 mt-2 border border-red-200 rounded-lg p-4 bg-red-50">
                    <p className="font-semibold text-red-700 text-sm">
                      Are you sure you want to delete this event?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        className="flex-1"
                        onClick={handleDelete}
                      >
                        Yes, Delete
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDeleteEvent(false)}
                      >
                        No
                      </Button>
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