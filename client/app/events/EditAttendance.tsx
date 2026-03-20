"use client"
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { toast } from "sonner"

type EditAttendanceProps = {
  attendanceId: number;
};

export default function EditAttendance({ attendanceId }: EditAttendanceProps) {
  const { user } = useUserAuthentication();
  const router = useRouter();

  const [status, setStatus] = useState<string>("going");
  const [seatsAvailable, setSeatsAvailable] = useState<number | null>(null);
  const [role, setRole] = useState<string>("None");
  const [form, setForm] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/attendances/${attendanceId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            seats_available: seatsAvailable,
            role,
          }),
        },
      );
      if (!res.ok) throw new Error("Failed to update attendance");

      setForm(false);
      router.refresh();
    } catch (err) {
      console.error("Error updating attendance", err);
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
        Edit Attendance
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
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">🎀 Edit Attendance</h2>
                <button
                  onClick={() => setForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="going">Going</option>
                    <option value="maybe">Maybe</option>
                    <option value="not going">Not Going</option>
                  </select>
                </Field>

                <Field>
                  <FieldLabel>Role</FieldLabel>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="border border-rose-200 rounded-md px-3 py-2 text-sm text-gray-700 bg-white w-full focus:outline-none focus:ring-2 focus:ring-rose-300"
                  >
                    <option value="None">None</option>
                    <option value="Driver">Driver</option>
                    <option value="Passenger">Passenger</option>
                  </select>
                </Field>

                {role === "Driver" && (
                  <Field>
                    <FieldLabel>Available Seats</FieldLabel>
                    <Input
                      type="number"
                      placeholder="How many seats?"
                      value={seatsAvailable ?? ""}
                      min={1}
                      max={10}
                      onChange={(e) => setSeatsAvailable(Number(e.target.value))}
                      className="border-rose-200 focus:ring-rose-300"
                    />
                  </Field>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                    onClick={() => toast.success("Edited the attendance successfully!")}
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
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}