"use client"
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { useRouter } from "next/navigation";

type EditAttendanceProps = {
  attendanceId: number;
};

export default function EditAttendance({ attendanceId }: EditAttendanceProps) {
  const { user } = useUserAuthentication();
  const router = useRouter();

  const [status, setStatus] = useState<string>();
  const [seatsAvailable, setSeatsAvailable] = useState<number | null>(null);
  const [role, setRole] = useState<string>();
  const [form, setForm] = useState<boolean>(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!user) return;

    try {
      const res = await fetch(
        `http://localhost:5000/attendances/${attendanceId}`,
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
      <button onClick={() => setForm(true)}>Edit Attendance</button>

      {form && (
        <>
          {/* backdrop */}
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
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="going">going</option>
                  <option value="maybe">maybe</option>
                  <option value="not going">not going</option>
                </select>

                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="None">None</option>
                  <option value="Driver">Driver</option>
                  <option value="Passenger">Passenger</option>
                </select>

                {role === "Driver" && (
                  <input
                    type="number"
                    placeholder="available seats"
                    value={seatsAvailable ?? ""}
                    min={1}
                    max={10}
                    onChange={(e) => setSeatsAvailable(Number(e.target.value))}
                  />
                )}

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
