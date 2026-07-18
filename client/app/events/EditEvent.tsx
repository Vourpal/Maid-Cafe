"use client";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders, authHeadersNoContent } from "@/lib/api";
import Modal from "../components/Modal";

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

const selectClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

export default function EditEvents({
  titleProp, eventIdProp, descriptionProp,
  startDateProp, endDateProp, locationProp,
  maxAttendeesProp, statusProps,
}: EditEventProps) {
  const router = useRouter();
  const { user } = useUserAuthentication();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [title, setTitle] = useState(titleProp);
  const [description, setDescription] = useState(descriptionProp ?? "");
  const [startDate, setStartDate] = useState(new Date(startDateProp).toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState(new Date(endDateProp).toISOString().split("T")[0]);
  const [location, setLocation] = useState(locationProp ?? "");
  const [maxAttendees, setMaxAttendees] = useState<number | "">(maxAttendeesProp ?? "");
  const [status, setStatus] = useState(statusProps);

  async function handleDelete() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventIdProp}`, {
        method: "DELETE",
        headers: authHeadersNoContent(),
      });
      if (!res.ok) throw new Error();
      toast.success("Event deleted.");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to delete event.");
      setConfirmDelete(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events/${eventIdProp}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          title, description,
          start_datetime: startDate + "T00:00:00",
          end_datetime: endDate + "T00:00:00",
          location,
          max_attendees: maxAttendees || null,
          status,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Event updated!");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to update event.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-rose-300 text-rose-500 hover:bg-rose-50 h-7 text-xs rounded-full"
        onClick={() => setOpen(true)}
      >
        Edit
      </Button>

      <Modal open={open} onClose={() => { setOpen(false); setConfirmDelete(false); }} title="Edit Event">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              type="text"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              className="border-gray-200 focus:ring-rose-300 rounded-lg"
            />
          </Field>

          <Field>
            <FieldLabel>Description</FieldLabel>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={255}
              rows={3}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Start Date</FieldLabel>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
              />
            </Field>
            <Field>
              <FieldLabel>End Date</FieldLabel>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Location</FieldLabel>
            <Input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border-gray-200 focus:ring-rose-300 rounded-lg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel>Max Attendees</FieldLabel>
              <Input
                type="number"
                value={maxAttendees}
                min={1}
                onChange={(e) => setMaxAttendees(e.target.value === "" ? "" : Number(e.target.value))}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
              />
            </Field>
            <Field>
              <FieldLabel>Status</FieldLabel>
              <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </Field>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={loading}
              className="bg-rose-500 hover:bg-rose-600 text-white flex-1 rounded-lg"
            >
              {loading ? "Saving..." : "Save Changes"}
            </Button>
            <Button type="button" variant="outline" className="flex-1 rounded-lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>

          {/* Delete zone */}
          <div className="border-t border-gray-100 pt-4 mt-1">
            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-red-400 hover:text-red-600 transition-colors"
              >
                Delete this event…
              </button>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-red-700">
                  This will permanently delete the event and all its attendances. Continue?
                </p>
                <div className="flex gap-2">
                  <Button type="button" variant="destructive" className="flex-1 rounded-lg" onClick={handleDelete}>
                    Yes, delete
                  </Button>
                  <Button type="button" variant="outline" className="flex-1 rounded-lg" onClick={() => setConfirmDelete(false)}>
                    No, keep it
                  </Button>
                </div>
              </div>
            )}
          </div>
        </form>
      </Modal>
    </>
  );
}
