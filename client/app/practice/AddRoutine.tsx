"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";

import { toast } from "sonner";

import { authHeaders, authHeadersNoContent } from "@/lib/api";

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

  const [allRoutines, setAllRoutines] = useState<Routine[]>([]);

  const [selectedRoutineId, setSelectedRoutineId] = useState("");

  const [createNew, setCreateNew] = useState(false);

  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/routines`, {
      method: "GET",
      headers: authHeadersNoContent(),
    })
      .then((res) => res.json())
      .then((data) => setAllRoutines(data.data || []))
      .catch((err) => console.error("Failed to fetch routines:", err));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      let body: { routine_id?: number; name?: string; notes?: string } = {};

      // EXISTING ROUTINE
      if (!createNew) {
        body.routine_id = Number(selectedRoutineId);
      }

      // NEW ROUTINE
      else {
        body = {
          name,
          notes,
        };
      }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/routines`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        throw new Error("Failed to add routine");
      }

      const data = await res.json();

      let addedRoutine: Routine;

      // EXISTING
      if (!createNew) {
        const existing = allRoutines.find(
          (r) => r.id === Number(selectedRoutineId),
        );

        if (!existing) {
          throw new Error("Routine not found");
        }

        addedRoutine = existing;
      }

      // NEW
      else {
        addedRoutine = {
          id: data.data.id,
          name,
          notes,
        };

        setAllRoutines((prev) => [...prev, addedRoutine]);
      }

      setRoutines((prev) => {
        const exists = prev.some((r) => r.id === addedRoutine.id);

        if (exists) {
          return prev;
        }

        return [...prev, addedRoutine];
      });

      toast.success("Routine added!");

      setOpen(false);

      setSelectedRoutineId("");
      setCreateNew(false);

      setName("");
      setNotes("");
    } catch (err) {
      console.error(err);

      toast.error("Failed to add routine");
    }
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        variant="outline"
        className="border-rose-300 text-rose-600 hover:bg-rose-50 h-7 text-xs rounded-full"
      >
        Add
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-rose-500 font-semibold text-lg">
                  🎯 Add Routine
                </h2>

                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {!createNew ? (
                  <>
                    <Field>
                      <FieldLabel>Select Existing Routine</FieldLabel>

                      <select
                        value={selectedRoutineId}
                        onChange={(e) => setSelectedRoutineId(e.target.value)}
                        className="border border-rose-200 rounded-md px-3 py-2 text-sm w-full"
                        required
                      >
                        <option value="">Select a routine</option>

                        {allRoutines.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </Field>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateNew(true)}
                    >
                      + Create New Routine
                    </Button>
                  </>
                ) : (
                  <>
                    <Field>
                      <FieldLabel>Name</FieldLabel>

                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                      />
                    </Field>

                    <Field>
                      <FieldLabel>Notes</FieldLabel>

                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="border border-rose-200 rounded-md px-3 py-2 text-sm w-full"
                      />
                    </Field>

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCreateNew(false)}
                    >
                      Back To Existing Routines
                    </Button>
                  </>
                )}

                <div className="flex gap-2 mt-2">
                  <Button
                    type="submit"
                    className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                  >
                    Add Routine
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </>
  );
}
