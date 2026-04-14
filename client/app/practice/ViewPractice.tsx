"use client";

import { useEffect, useState } from "react";
import { PracticeSessions } from "@/types/event";
import AddAttendance from "./AddAttendance";
import EditAttendance from "./EditAttendance";
import AddRoutine from "./AddRoutine";
import EditRoutine from "./EditRoutine";
import { authHeaders } from "@/lib/api";

type Routine = {
  id: number;
  name: string;
  notes: string;
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

type Props = {
  event: {
    title: string;
    start: Date;
    end: Date;
    resource: PracticeSessions;
  } | null;
  onClose: () => void;
};

export default function ViewPractice({ event, onClose }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);

  const session = event?.resource;

  useEffect(() => {
    if (!session) return;

    // Clear stale data immediately so old session never flashes
    setRoutines([]);
    setAttendance([]);
    setLoading(true);

    const fetchData = async () => {
      try {
        const [routinesRes, attendanceRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session.id}/routines`,
            { headers: authHeaders() }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session.id}/attendance`,
            { headers: authHeaders() }
          ),
        ]);

        const [routinesData, attendanceData] = await Promise.all([
          routinesRes.json(),
          attendanceRes.json(),
        ]);

        setRoutines(routinesData.data);
        setAttendance(attendanceData.data);
      } catch (err) {
        console.error("Failed to load practice data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session?.id]);

  if (!event) return null;

  const s = event.resource;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white p-6 rounded-xl max-w-5xl w-full pointer-events-auto shadow-lg max-h-[90vh] overflow-y-auto">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-rose-500 font-semibold text-lg">
              🎀 {s.title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Session Info */}
          <div className="flex flex-col gap-2 text-sm mb-4">
            <p><strong>📍 Location:</strong> {s.location || "N/A"}</p>
            <p><strong>📅 Date:</strong> {new Date(s.date).toLocaleString()}</p>
            <p><strong>📝 Notes:</strong> {s.notes || "None"}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
            </div>
          ) : (
            /* GRID */
            <div className="grid grid-cols-2 gap-4">

              {/* 👥 ATTENDANCE */}
              <div className="border border-rose-200 rounded-xl p-3 flex flex-col gap-3">
                <h3 className="text-rose-500 font-semibold">👥 Attendance</h3>

                <AddAttendance
                  practiceId={s.id}
                  onDone={(newAttendees) => setAttendance((prev) => [...prev, ...newAttendees])}
                />
                <EditAttendance
                  practiceId={s.id}
                  attendance={attendance}
                  onDone={(updated) => setAttendance(updated)}
                />

                <div className="flex flex-col gap-2 mt-2">
                  {attendance.length === 0 ? (
                    <p className="text-sm text-gray-400">No attendance recorded</p>
                  ) : (
                    attendance.map((a) => (
                      <div
                        key={a.id}
                        className="border border-rose-100 rounded-md p-2"
                      >
                        <div className="flex justify-between text-sm">
                          <div className="font-medium">
                            {a.first_name} {a.last_name}
                          </div>
                          <div className="text-xs flex gap-2">
                            <span className={a.attended ? "text-green-500" : "text-red-400"}>
                              {a.attended ? "Present" : "Absent"}
                            </span>
                            {a.late && <span className="text-yellow-500">Late</span>}
                          </div>
                        </div>
                        {a.notes && (
                          <div className="text-xs text-gray-500 mt-1">{a.notes}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 🎯 ROUTINES */}
              <div className="border border-rose-200 rounded-xl p-3 flex flex-col gap-3">
                <h3 className="text-rose-500 font-semibold">🎯 Routines</h3>

                <AddRoutine
                  practiceId={s.id}
                  setRoutines={setRoutines}
                />
                <EditRoutine
                  practiceId={s.id}
                  routines={routines}
                  onDone={(updated) => setRoutines(updated)}
                />

                <div className="flex flex-col gap-2 mt-2">
                  {routines.length === 0 ? (
                    <p className="text-sm text-gray-400">No routines for this practice</p>
                  ) : (
                    routines.map((r) => (
                      <div
                        key={r.id}
                        className="border border-rose-100 rounded-md p-2"
                      >
                        <div className="font-medium text-sm">{r.name}</div>
                        {r.notes && (
                          <div className="text-xs text-gray-500 mt-1">{r.notes}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  );
}
