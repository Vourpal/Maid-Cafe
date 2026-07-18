"use client";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders } from "@/lib/api";
import Modal from "../components/Modal";

type SignUpModalProps = {
  eventId: number;
  onSuccess: (newAttendance: { id: number; event_id: number }) => void;
};

const selectClass =
  "border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

export default function SignUpModal({ eventId, onSuccess }: SignUpModalProps) {
  const { user } = useUserAuthentication();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("going");
  const [role, setRole] = useState("None");
  const [seatsAvailable, setSeatsAvailable] = useState<number | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendances/me`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          event_id: eventId,
          status,
          role,
          seats_available: role === "Driver" ? seatsAvailable : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to sign up");

      const data = await res.json();
      onSuccess({ id: data.data.id, event_id: eventId });
      toast.success("Successfully signed up!");
      setOpen(false);
    } catch {
      toast.error("Failed to sign up. Try again.");
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
        Sign Up
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="🎀 Sign Up for Event">
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Attendance status</FieldLabel>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="going">Going</option>
              <option value="maybe">Maybe</option>
              <option value="not going">Not Going</option>
            </select>
          </Field>

          <Field>
            <FieldLabel>Transportation role</FieldLabel>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={selectClass}>
              <option value="None">None</option>
              <option value="Driver">Driver</option>
              <option value="Passenger">Passenger</option>
            </select>
          </Field>

          {role === "Driver" && (
            <Field>
              <FieldLabel>Available seats</FieldLabel>
              <Input
                type="number"
                placeholder="How many can you fit?"
                value={seatsAvailable ?? ""}
                min={1}
                max={10}
                onChange={(e) => setSeatsAvailable(Number(e.target.value))}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
              />
            </Field>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={loading}
              className="bg-rose-500 hover:bg-rose-600 text-white flex-1 rounded-lg"
            >
              {loading ? "Submitting..." : "Confirm Sign Up"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
