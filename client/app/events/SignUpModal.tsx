"use client";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

type SignUpModalProps = {
  eventId: number;
  onSuccess: (newAttendance: { id: number; event_id: number }) => void;
};

export default function SignUpModal({ eventId, onSuccess }: SignUpModalProps) {
  const { user } = useUserAuthentication();

  const [form, setForm] = useState(false);
  const [status, setStatus] = useState<string>("going");
  const [role, setRole] = useState<string>("None");
  const [seatsAvailable, setSeatsAvailable] = useState<number | null>(null);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch("http://localhost:5000/attendances/me", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          status,
          role,
          seats_available: role === "Driver" ? seatsAvailable : null,
        }),
      });

      if (!res.ok) throw new Error("Failed to sign up");

      const data = await res.json();

      // 🔥 Update EventCards immediately
      onSuccess({
        id: data.data.id,
        event_id: eventId,
      });

      setForm(false);
    } catch (err) {
      console.error("Error signing up:", err);
    }
  }

  return (
    <div>
      <button
        onClick={() => setForm(true)}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Sign Up
      </button>

      {form && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setForm(false)}
          />

          {/* Modal wrapper */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded max-w-md w-full pointer-events-auto">
              <button onClick={() => setForm(false)}>✕</button>

              <form onSubmit={handleSignUp} className="flex flex-col gap-4 mt-3">
                {/* STEP 1 — STATUS */}
                <div>
                  <p className="font-semibold">What is your status?</p>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="border p-2 rounded w-full"
                  >
                    <option value="going">Going</option>
                    <option value="maybe">Maybe</option>
                    <option value="not going">Not Going</option>
                  </select>
                </div>

                {/* STEP 2 — ROLE */}
                <div>
                  <p className="font-semibold">Are you a driver or a rider?</p>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="border p-2 rounded w-full"
                  >
                    <option value="None">None</option>
                    <option value="Driver">Driver</option>
                    <option value="Passenger">Passenger</option>
                  </select>
                </div>

                {/* STEP 3 — DRIVER SEATS */}
                {role === "Driver" && (
                  <div>
                    <p className="font-semibold">How many people can you fit?</p>
                    <input
                      type="number"
                      placeholder="Available seats"
                      value={seatsAvailable ?? ""}
                      min={1}
                      max={10}
                      onChange={(e) => setSeatsAvailable(Number(e.target.value))}
                      className="border p-2 rounded w-full"
                    />
                  </div>
                )}

                {/* ACTION BUTTONS */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded"
                  >
                    Submit
                  </button>

                  <button
                    type="button"
                    onClick={() => setForm(false)}
                    className="px-4 py-2 bg-gray-300 rounded"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}