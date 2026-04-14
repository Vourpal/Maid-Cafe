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
  routines: Routine[];
  onDone: (updated: Routine[]) => void;
};

export default function EditRoutine({
  practiceId,
  routines,
  onDone,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [localRoutines, setLocalRoutines] = useState<Routine[]>([]);

  function handleOpen() {
    setLocalRoutines(routines.map((r) => ({ ...r })));
    setOpen(true);
  }

async function handleSave() {
  setLoading(true);

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/routines/bulk`,
      {
        method: "PATCH",
        headers: {
          ...authHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          routines: localRoutines,
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(err);
    }

    const data = await res.json();

    onDone(data?.data);
    setOpen(false);
  } catch (err) {
    console.error("Failed to save routines:", err);
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
        Edit Routines
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
                  🎀 Edit Routines
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>

              {/* EDIT FIELDS */}
              <div className="flex flex-col gap-3">
                {localRoutines.map((r) => (
                  <div
                    key={r.id}
                    className="border border-rose-200 rounded-md p-3"
                  >
                    <input
                      value={r.name}
                      onChange={(e) =>
                        setLocalRoutines((prev) =>
                          prev.map((x) =>
                            x.id === r.id
                              ? { ...x, name: e.target.value }
                              : x
                          )
                        )
                      }
                      className="border border-rose-200 w-full p-2 rounded mb-2"
                    />

                    <textarea
                      value={r.notes || ""}
                      onChange={(e) =>
                        setLocalRoutines((prev) =>
                          prev.map((x) =>
                            x.id === r.id
                              ? { ...x, notes: e.target.value }
                              : x
                          )
                        )
                      }
                      className="border border-rose-200 w-full p-2 rounded"
                    />
                  </div>
                ))}
              </div>

              {/* ACTIONS */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSave}
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