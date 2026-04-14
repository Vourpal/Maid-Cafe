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
  setRoutines: React.Dispatch<React.SetStateAction<Routine[]>>;
};

export default function AddRoutine({ practiceId, setRoutines }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  async function handleSubmit() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/routines`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ name, notes }),
        }
      );

      if (!res.ok) throw new Error("Failed to add routine");

      const data = await res.json();

      const newRoutine: Routine = data.data;

      setOpen(false);
      setName("");
      setNotes("");

      // ✅ instantly update UI without refetch
      setRoutines((prev) => [...prev, newRoutine]);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <Button
        onClick={() => setOpen(true)}
        className="bg-rose-500 hover:bg-rose-600 text-white w-full"
      >
        Add Routine
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
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg">
              <h2 className="text-rose-500 font-semibold mb-4">
                🎀 Add Routine
              </h2>

              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Routine name"
                className="border border-rose-200 w-full mb-2 p-2 rounded"
              />

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                className="border border-rose-200 w-full p-2 rounded"
              />

              <div className="flex gap-2 mt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  Add
                </Button>
                <Button variant="outline" onClick={() => setOpen(false)}>
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