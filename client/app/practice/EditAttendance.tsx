"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/api";
import { Attendance } from "@/types/event";

type Props = {
  practiceId: number;
  attendance: Attendance[];
  onDone: (updated: Attendance[]) => void;
};

export default function EditAttendance({
  practiceId,
  attendance,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [local, setLocal] = useState<Attendance[]>([]);

  function handleOpen() {
    setLocal(attendance.map((a) => ({ ...a })));
    setOpen(true);
  }

  function toggle(id: number, field: "attended" | "late") {
    setLocal((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, [field]: !a[field] } : a
      )
    );
  }

  function updateNotes(id: number, value: string) {
    setLocal((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, notes: value } : a
      )
    );
  }

  async function handleSubmit() {
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            updates: local.map((a) => ({
              id: a.id,
              attended: a.attended,
              late: a.late,
              notes: a.notes,
            })),
          }),
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update attendance");
      }

      const json = await res.json();

      // =========================
      // SERVER SOURCE OF TRUTH
      // =========================
      const updated: Attendance[] = Array.isArray(json.data)
        ? json.data
        : local; // fallback if backend doesn't return data

      onDone(updated);
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Button
        onClick={handleOpen}
        className="bg-rose-500 hover:bg-rose-600 text-white w-full"
      >
        Edit Attendance
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg max-h-[90vh] overflow-y-auto">

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  🎀 Edit Attendance
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {local.map((a) => (
                  <div
                    key={a.id}
                    className="border border-rose-200 rounded-md p-3"
                  >
                    <div className="font-medium mb-2">
                      {a.first_name} {a.last_name}
                    </div>

                    <div className="flex gap-2 mb-2">
                      <Button
                        variant={a.attended ? "default" : "outline"}
                        onClick={() => toggle(a.id, "attended")}
                      >
                        Attended
                      </Button>

                      <Button
                        variant={a.late ? "default" : "outline"}
                        onClick={() => toggle(a.id, "late")}
                      >
                        Late
                      </Button>
                    </div>

                    <textarea
                      value={a.notes || ""}
                      onChange={(e) =>
                        updateNotes(a.id, e.target.value)
                      }
                      className="border border-rose-200 w-full rounded-md p-2 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                >
                  {loading ? "Saving..." : "Save"}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                  className="border-rose-200 text-gray-600 flex-1"
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