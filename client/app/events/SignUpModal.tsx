"use client";
import { useState, useEffect } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner";
import { authHeaders, authHeadersNoContent } from "@/lib/api";
import Modal from "../components/Modal";
import { Car, Users } from "lucide-react";

type SignUpModalProps = {
  eventId: number;
  onSuccess: (newAttendance: { id: number; event_id: number }) => void;
};

type CarpoolStatus = {
  total_seats: number;
  passengers: number;
  seats_left: number;
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
  const [carpool, setCarpool] = useState<CarpoolStatus | null>(null);
  const [carpoolLoading, setCarpoolLoading] = useState(false);

  // Fetch current seat availability whenever the modal opens
  useEffect(() => {
    if (!open || !user) return;

    setCarpoolLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendances/carpool/${eventId}`, {
      headers: authHeadersNoContent(),
    })
      .then((r) => r.json())
      .then((data) => setCarpool(data.data ?? null))
      .catch(() => setCarpool(null))
      .finally(() => setCarpoolLoading(false));
  }, [open, eventId, user]);

  const noSeatsLeft = carpool !== null && carpool.seats_left <= 0;

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    // Client-side guard — backend enforces this too, but no point sending the request
    if (role === "Passenger" && noSeatsLeft) {
      toast.error("No passenger seats available.");
      return;
    }

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

      const data = await res.json();

      if (!res.ok) {
        // Surface the specific backend error message
        const msg = data?.error?.message ?? "Failed to sign up.";
        toast.error(msg);
        return;
      }

      onSuccess({ id: data.data.id, event_id: eventId });
      toast.success("Successfully signed up!");
      setOpen(false);
    } catch {
      toast.error("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleOpen() {
    // Reset form state each time the modal opens
    setStatus("going");
    setRole("None");
    setSeatsAvailable(null);
    setOpen(true);
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-rose-300 text-rose-500 hover:bg-rose-50 h-7 text-xs rounded-full"
        onClick={handleOpen}
      >
        Sign Up
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="🎀 Sign Up for Event">
        <form onSubmit={handleSignUp} className="flex flex-col gap-4">

          {/* Carpool availability summary */}
          {!carpoolLoading && carpool !== null && (
            <div className={`rounded-xl px-4 py-3 text-sm flex items-center gap-3 ${
              carpool.total_seats === 0
                ? "bg-gray-50 border border-gray-200 text-gray-500"
                : noSeatsLeft
                  ? "bg-red-50 border border-red-200 text-red-700"
                  : "bg-green-50 border border-green-200 text-green-700"
            }`}>
              <Car className="w-4 h-4 shrink-0" />
              <div>
                {carpool.total_seats === 0 ? (
                  <span>No drivers have signed up yet.</span>
                ) : noSeatsLeft ? (
                  <span>
                    <strong>No seats left</strong> — {carpool.passengers} passenger{carpool.passengers !== 1 ? "s" : ""} filling {carpool.total_seats} seat{carpool.total_seats !== 1 ? "s" : ""}.
                  </span>
                ) : (
                  <span>
                    <strong>{carpool.seats_left}</strong> seat{carpool.seats_left !== 1 ? "s" : ""} available
                    <span className="text-green-600 font-normal ml-1">
                      ({carpool.passengers}/{carpool.total_seats} taken)
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}

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
              <option value="Passenger" disabled={noSeatsLeft}>
                Passenger{noSeatsLeft ? " (full)" : ""}
              </option>
            </select>
            {role === "Passenger" && noSeatsLeft && (
              <p className="text-xs text-red-500 mt-1">
                There are no available seats. Sign up as a different role or check back later.
              </p>
            )}
          </Field>

          {role === "Driver" && (
            <Field>
              <FieldLabel>Available seats</FieldLabel>
              <Input
                type="number"
                placeholder="How many passengers can you take?"
                value={seatsAvailable ?? ""}
                min={1}
                max={10}
                onChange={(e) => setSeatsAvailable(Number(e.target.value))}
                className="border-gray-200 focus:ring-rose-300 rounded-lg"
                required
              />
            </Field>
          )}

          <div className="flex gap-2 pt-1">
            <Button
              type="submit"
              disabled={loading || (role === "Passenger" && noSeatsLeft)}
              className="bg-rose-500 hover:bg-rose-600 text-white flex-1 rounded-lg disabled:opacity-50"
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
