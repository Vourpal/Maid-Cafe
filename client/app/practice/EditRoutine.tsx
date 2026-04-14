"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authHeaders } from "@/lib/api";

type Routine = {
  id: number;
  name: string;
  notes: string;
};

type Props = {
  practiceId: number;
  onDone?: () => void;
};

export default function EditRoutine({ practiceId, onDone }: Props) {
  const [open, setOpen] = useState(false);
  const [routines, setRoutines] = useState<Routine[]>([]);

  async function fetchRoutines() {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/routines`,
      {
        method: "GET",
        headers: authHeaders(),
      }
    );

    const data = await res.json();
    setRoutines(data.data);
  }

  async function handleSave() {
    try {
      await Promise.all(
        routines.map((r) =>
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/routines/${r.id}`, {
            method: "PATCH",
            headers: authHeaders(),
            body: JSON.stringify({
              name: r.name,
              notes: r.notes,
            }),
          })
        )
      );

      setOpen(false);
      onDone?.();
    } catch (err) {
      console.error("Failed to save routines:", err);
    }
  }

  async function handleDelete(routineId: number) {
    try {
      if (!confirm("Delete this routine?")) return;

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/routines/${routineId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      if (!res.ok) throw new Error("Failed to delete routine");

      setRoutines((prev) => prev.filter((r) => r.id !== routineId));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  }

  function updateRoutine(id: number, field: "name" | "notes", value: string) {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  return (
    <div>
      <Button
        onClick={() => {
          setOpen(true);
          fetchRoutines();
        }}
        className="bg-rose-500 hover:bg-rose-600 text-white w-full"
      >
        Edit Routines
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg max-h-[90vh] flex flex-col">

              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  🎀 Edit Routines
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-1">
                {routines.length === 0 && (
                  <p className="text-sm text-gray-400">
                    No routines added yet
                  </p>
                )}

                {routines.map((r) => (
                  <div
                    key={r.id}
                    className="border border-rose-200 rounded-lg p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        value={r.name}
                        onChange={(e) =>
                          updateRoutine(r.id, "name", e.target.value)
                        }
                        className="w-full border border-rose-200 rounded-md px-2 py-1 text-sm"
                      />

                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>

                    <textarea
                      value={r.notes || ""}
                      onChange={(e) =>
                        updateRoutine(r.id, "notes", e.target.value)
                      }
                      className="border border-rose-200 rounded-md px-2 py-1 text-sm"
                    />
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4 pt-2 border-t border-rose-100">
                <Button
                  onClick={handleSave}
                  className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                >
                  Save Changes
                </Button>

                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
                  className="flex-1"
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