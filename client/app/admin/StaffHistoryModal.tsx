"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type { PracticeHistory, StaffMember } from "@/types/admin";
import { ExportButton, RateBadge, formatDate, percent } from "./shared";

/** One member's practice attendance record over time. */
export default function StaffHistoryModal({
  member,
  onClose,
}: {
  member: StaffMember;
  onClose: () => void;
}) {
  const [data, setData] = useState<PracticeHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<PracticeHistory>(`/users/${member.id}/practice-history`)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [member.id]);

  return (
    <Modal
      open
      onClose={onClose}
      title={`Practice history — ${member.first_name} ${member.last_name}`}
      maxWidth="max-w-2xl"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : error || !data ? (
        <p className="text-sm text-red-500">{error ?? "Could not load history"}</p>
      ) : (
        <div className="space-y-5">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-rose-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Rate</p>
              <p className="text-lg font-bold text-rose-600">
                {percent(data.summary.attendance_rate)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Attended</p>
              <p className="text-lg font-bold text-gray-800">
                {data.summary.attended}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Absent</p>
              <p className="text-lg font-bold text-gray-800">{data.summary.absent}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Late</p>
              <p className="text-lg font-bold text-gray-800">{data.summary.late}</p>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Recorded on {data.summary.recorded} of {data.summary.sessions_held}{" "}
            session{data.summary.sessions_held === 1 ? "" : "s"} held. Upcoming
            sessions are excluded so they do not count as absences.
          </p>

          {/* Session-by-session */}
          {data.history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              No practice records yet.
            </p>
          ) : (
            <div className="border border-rose-100 rounded-xl divide-y divide-rose-50 max-h-80 overflow-y-auto">
              {data.history.map((entry) => (
                <div
                  key={entry.id}
                  className="px-4 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {entry.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(entry.date)}
                      {entry.location && ` · ${entry.location}`}
                      {entry.notes && ` · ${entry.notes}`}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {entry.late && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                        Late
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        entry.attended
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {entry.attended ? "Attended" : "Absent"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <RateBadge rate={data.summary.attendance_rate} />
            <ExportButton
              path="/exports/reports/practice-attendance.csv"
              filename="practice-attendance-report.csv"
              label="Export full report"
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
