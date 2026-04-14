"use client";

import { Button } from "@/components/ui/button";
import { authHeaders, authHeadersNoContent } from "@/lib/api";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

type Attendance = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
};

type Props = {
  practiceId: number; // pass from ViewPractice later
};

export default function AddAttendance({ practiceId }: Props) {
  const { user } = useUserAuthentication();
  const [open, setOpen] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  async function handleOpen() {
    setOpen(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: "GET",
      headers: authHeadersNoContent(),
    });

    const data = await res.json();

    // everyone starts as "present"
    setAttendance(data.data);
  }

  function removeAttendee(id: number) {
    setAttendance((prev) => prev.filter((user) => user.id !== id));
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
        },
      );

      if (!res.ok) {
        throw new Error("Failed to submit attendance");
      }

      const data = await res.json();
      console.log("Attendance submitted:", data);

      setOpen(false);
    } catch (err) {
      console.error("Error submitting attendance:", err);
    }
  }
  if (!user || !user.admin) return;

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
                  🎀 Attendance
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Attendee list */}
              <div className="flex flex-col gap-2">
                {attendance.map((user) => (
                  <div
                    key={user.id}
                    className="flex items-center justify-between border border-rose-200 rounded-md px-3 py-2"
                  >
                    <span>
                      {user.first_name} {user.last_name}
                    </span>

                    <button
                      onClick={() => removeAttendee(user.id)}
                      className="text-red-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleSubmit}
                  className="bg-rose-500 hover:bg-rose-600 text-white flex-1"
                >
                  Submit Attendance
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
