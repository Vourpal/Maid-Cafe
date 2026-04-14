"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/api";

type Props = {
  practiceId: number;
};

type Attendance = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  attended: boolean;
  late: boolean;
  notes: string;
};

export default function EditAttendance({ practiceId }: Props) {
  const [open, setOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  async function fetchAttendance() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
      {
        method: "GET",
        headers: authHeaders(),
      }
    );

    const data = await res.json();
    setAttendance(data.data);
  }

  async function handleSubmit() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            updates: attendance.map((a) => ({
              id: a.id,
              attended: a.attended,
              late: a.late,
              notes: a.notes,
            })),
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to update attendance");

      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  }

  function toggleField(id: number, field: "attended" | "late") {
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, [field]: !a[field] } : a
      )
    );
  }

  function updateNotes(id: number, value: string) {
    setAttendance((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, notes: value } : a
      )
    );
  }

  return (
    <div>
      <Button
        onClick={() => {
          setOpen(true);
          fetchAttendance();
        }}
        className="bg-rose-500 hover:bg-rose-600 text-white w-full"
      >
        Edit Attendance
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  🎀 Edit Attendance
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {attendance.map((a) => (
                  <div
                    key={a.id}
                    className="border border-rose-200 rounded-md p-3 flex flex-col gap-2"
                  >
                    <div className="font-medium">
                      {a.first_name} {a.last_name}
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant={a.attended ? "default" : "outline"}
                        onClick={() => toggleField(a.id, "attended")}
                      >
                        Attended
                      </Button>

                      <Button
                        variant={a.late ? "default" : "outline"}
                        onClick={() => toggleField(a.id, "late")}
                      >
                        Late
                      </Button>
                    </div>

                    <textarea
                      value={a.notes || ""}
                      onChange={(e) =>
                        updateNotes(a.id, e.target.value)
                      }
                      placeholder="Notes..."
                      className="border border-rose-200 rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                >
                  Save Changes
                </Button>

                <Button
                  variant="outline"
                  className="border-rose-200 text-gray-600 flex-1"
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}