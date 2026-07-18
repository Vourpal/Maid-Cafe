"use client";

import { useEffect, useState } from "react";
import { PracticeSessions, Attendance } from "@/types/event";
import AddAttendance from "./AddAttendance";
import EditAttendance from "./EditAttendance";
import AddRoutine from "./AddRoutine";
import EditRoutine from "./EditRoutine";
import { authHeaders } from "@/lib/api";
import { useUserAuthentication } from "../UserAuthentication";
import DeletePractice from "./DeletePractice";
import EditPractice from "./EditPractice";
import { MapPin, CalendarDays, FileText, X } from "lucide-react";

type Routine = {
  id: number;
  name: string;
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
  setSessions: React.Dispatch<React.SetStateAction<PracticeSessions[]>>;
};

export default function ViewPractice({ event, onClose, setSessions }: Props) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useUserAuthentication();

  const session = event?.resource;

  useEffect(() => {
    if (!session) return;

    setRoutines([]);
    setAttendance([]);
    setLoading(true);

    async function fetchData() {
      try {
        const [routinesRes, attendanceRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session!.id}/routines`,
            { headers: authHeaders() },
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/practice-sessions/${session!.id}/attendance`,
            { headers: authHeaders() },
          ),
        ]);

        const routinesData = await routinesRes.json();
        const attendanceData = await attendanceRes.json();

        setRoutines(routinesData?.data ?? []);
        setAttendance(attendanceData?.data ?? []);
      } catch (err) {
        console.error("Failed to fetch practice data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [session]);

  // Close on Escape
  useEffect(() => {
    if (!event) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [event, onClose]);

  if (!event) return null;

  const s = event.resource;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-2xl w-full max-w-3xl pointer-events-auto shadow-xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-rose-50 shrink-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-gray-800 text-lg leading-tight truncate">
                  {s.title}
                </h2>
                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-400">
                  {s.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {s.location}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    {new Date(s.date).toLocaleString("en-US", {
                      weekday: "short", month: "long",
                      day: "numeric", hour: "numeric", minute: "2-digit",
                    })}
                  </span>
                  {s.notes && (
                    <span className="flex items-center gap-1">
                      <FileText className="w-3 h-3 shrink-0" />
                      {s.notes}
                    </span>
                  )}
                </div>
              </div>

              {/* Admin actions + close */}
              <div className="flex items-center gap-2 shrink-0">
                {user?.admin && (
                  <>
                    <EditPractice session={s} setSessions={setSessions} />
                    <DeletePractice session={s} setSessions={setSessions} onDeleted={onClose} />
                  </>
                )}
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-6">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-4 border-rose-200 border-t-rose-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {/* ATTENDANCE */}
                <div className="border border-rose-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-rose-700">
                      👥 Attendance
                      {attendance.length > 0 && (
                        <span className="ml-1.5 text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-normal">
                          {attendance.length}
                        </span>
                      )}
                    </h3>
                    {user?.admin && (
                      <div className="flex gap-1.5">
                        <AddAttendance
                          practiceId={s.id}
                          onDone={(newAttendees) => {
                            setAttendance((prev) => [
                              ...prev,
                              ...(Array.isArray(newAttendees) ? newAttendees : []),
                            ]);
                          }}
                        />
                        <EditAttendance
                          practiceId={s.id}
                          attendance={attendance}
                          onDone={(updated) => setAttendance(updated)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                    {attendance.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No attendance recorded
                      </p>
                    ) : (
                      attendance.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between text-sm border border-rose-50 rounded-lg px-3 py-2"
                        >
                          <span className="font-medium text-gray-800">
                            {a.first_name} {a.last_name}
                          </span>
                          <div className="flex gap-1.5 text-xs">
                            <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                              a.attended
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-600"
                            }`}>
                              {a.attended ? "Present" : "Absent"}
                            </span>
                            {a.late && (
                              <span className="px-1.5 py-0.5 rounded-full font-medium bg-amber-50 text-amber-700">
                                Late
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ROUTINES */}
                <div className="border border-rose-100 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-rose-700">
                      🎯 Routines
                      {routines.length > 0 && (
                        <span className="ml-1.5 text-xs bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-normal">
                          {routines.length}
                        </span>
                      )}
                    </h3>
                    {user?.admin && (
                      <div className="flex gap-1.5">
                        <AddRoutine
                          practiceId={s.id}
                          setRoutines={(updateFn) => setRoutines(updateFn)}
                        />
                        <EditRoutine
                          practiceId={s.id}
                          routines={routines}
                          onDone={(updated) => setRoutines(updated)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                    {routines.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">
                        No routines for this session
                      </p>
                    ) : (
                      routines.map((r) => (
                        <div
                          key={r.id}
                          className="border border-rose-50 rounded-lg px-3 py-2"
                        >
                          <p className="text-sm font-medium text-gray-800">{r.name}</p>
                          {r.notes && (
                            <p className="text-xs text-gray-500 mt-0.5">{r.notes}</p>
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
      </div>
    </>
  );
}
