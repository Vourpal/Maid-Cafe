"use client";

import { Button } from "@/components/ui/button";
import { authHeaders, authHeadersNoContent } from "@/lib/api";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

type Attendance = {
  id: number;
  first_name: string;
  last_name: string;
};

type AttendanceData = {
  user_id: number;
};

type User = {
  id: number;
  first_name: string;
  last_name: string;
};

type Props = {
  practiceId: number;
  onDone?: () => void;
};

export default function AddAttendance({ practiceId, onDone }: Props) {
  const { user } = useUserAuthentication();
  const [open, setOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

 async function handleOpen() {
  setOpen(true);

  const [usersRes, attendanceRes] = await Promise.all([
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: "GET",
      headers: authHeadersNoContent(),
    }),
    fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
      {
        method: "GET",
        headers: authHeaders(),
      }
    ),
  ]);

  const usersData = await usersRes.json();
  const attendanceData = await attendanceRes.json();

  const existingIds = new Set(
    attendanceData.data.map((a: AttendanceData) => a.user_id)
  );

  const filteredUsers = usersData.data.filter(
    (u: User) => !existingIds.has(u.id)
  );

  setAttendance(filteredUsers);
}
  function removeAttendee(id: number) {
    setAttendance((prev) => prev.filter((u) => u.id !== id));
  }

  async function handleSubmit() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${practiceId}/attendance`,
        {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            attendees: attendance.map((a) => a.id),
          }),
        }
      );

      if (!res.ok) throw new Error("Failed to submit attendance");

      setOpen(false);
      onDone?.();
    } catch (err) {
      console.error(err);
    }
  }

  if (!user || !user.admin) return null;

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
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setOpen(false)}
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto">

              <div className="flex justify-between mb-4">
                <h2>🎀 Attendance</h2>
                <button onClick={() => setOpen(false)}>✕</button>
              </div>

              <div className="flex flex-col gap-2">
                {attendance.map((u) => (
                  <div key={u.id} className="flex justify-between border p-2">
                    {u.first_name} {u.last_name}

                    <button onClick={() => removeAttendee(u.id)}>
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mt-4">
                <Button onClick={handleSubmit} className="flex-1">
                  Submit
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