"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders } from "@/lib/api";
import Modal from "../components/Modal";
import { Plus } from "lucide-react";

const selectClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

export default function AddEvent() {
  const router = useRouter();
  const { user } = useUserAuthentication();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [maxAttendees, setMaxAttendees] = useState<number | "">("");
  const [status, setStatus] = useState("draft");

  function resetForm() {
    setTitle(""); setDescription(""); setStartDate("");
    setEndDate(""); setLocation(""); setMaxAttendees(""); setStatus("draft");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/events`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          title,
          description,
          start_datetime: startDate + "T00:00:00",
          end_datetime: endDate + "T00:00:00",
          location,
          max_attendees: maxAttendees || null,
          created_by: user.id,
          status,
        }),
      });

      if (!res.ok) throw new Error();
      toast.success("Event created!");
      resetForm();
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to create event.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-rose-500 hover:bg-rose-600 text-white rounded-full gap-1.5"
      >
        <Plus className="w-4 h-4" />
        Add Event
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="🎀 Create Event">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input
              type="text"
              placeholder="Event title"
              value={title}
              maxLength={100}
              onChange={(e) => setTitle(e.target.value)}
              className="border-gray-200 focus:ring-rose-300 rounded-lg"
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
                required
              />
            </Field>
            <Field>
              <FieldLabel>End Date</FieldLabel>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
                required
              />
            </Field>
          </div>

          <Field>
            <FieldLabel>Location</FieldLabel>
            <Input
              type="text"
              placeholder="Where is it?"
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
                placeholder="Spots available"
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
              {loading ? "Creating..." : "Create Event"}
            </Button>
            <Button type="button" variant="outline" className="flex-1 rounded-lg" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
