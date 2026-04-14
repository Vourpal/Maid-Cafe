"use client";

import { Button } from "@/components/ui/button";
import { authHeaders, authHeadersNoContent } from "@/lib/api";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

type Attendance = {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  attended: boolean;
  late: boolean;
  notes: string;
};

type User = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
};

type Props = {
  practiceId: number;
  onDone: (newAttendees: Attendance[]) => void;
};

export default function AddAttendance({ practiceId, onDone }: Props) {
  const { user } = useUserAuthentication();
  const [open, setOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  // Tracks which users are selected (checked) — starts with all selected
  const [selected, setSelected] = useState<Set<number>>(new Set());

  async function handleOpen() {
    try {
      const [usersRes, attendanceRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          method: "GET",
          headers: authHeadersNoContent(),
        }),
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
          { method: "GET", headers: authHeaders() }
        ),
      ]);

      const [usersData, attendanceData] = await Promise.all([
        usersRes.json(),
        attendanceRes.json(),
      ]);

      const alreadyAttending = new Set(
        attendanceData.data.map((a: Attendance) => a.user_id)
      );

      const filtered: User[] = usersData.data.filter(
        (u: User) => !alreadyAttending.has(u.id)
      );

      setAvailableUsers(filtered);
      // Default: all available users selected
      setSelected(new Set(filtered.map((u) => u.id)));
      setOpen(true);
    } catch (err) {
      console.error("Failed to load attendance modal:", err);
    }
  }

  function toggleUser(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleSubmit() {
    const attendeeIds = [...selected];
    if (attendeeIds.length === 0) {
      setOpen(false);
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ attendees: attendeeIds }),
        }
      );

      if (!res.ok) throw new Error("Failed to submit attendance");

      const data = await res.json();

      // Pass the newly created attendance records back up
      onDone(data.data);
      setOpen(false);
    } catch (err) {
      console.error(err);
    }
  }

  if (!user?.admin) return null;

  return (
    <div>
      <Button
        onClick={handleOpen}
        className="bg-rose-500 hover:bg-rose-600 text-white w-full"
      >
        Add Attendance
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
                  🎀 Add Attendance
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {availableUsers.length === 0 ? (
                  <p className="text-sm text-gray-400">No available users to add</p>
                ) : (
                  availableUsers.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center justify-between border border-rose-200 rounded-md px-3 py-2 cursor-pointer hover:bg-rose-50"
                    >
                      <span>
                        {u.first_name} {u.last_name}
                      </span>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleUser(u.id)}
                        className="accent-rose-500"
                      />
                    </label>
                  ))
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                >
                  Submit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpen(false)}
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
