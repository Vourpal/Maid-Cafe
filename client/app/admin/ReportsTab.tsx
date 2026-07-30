"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { EventReportRow, PracticeReport } from "@/types/admin";
import {
  EmptyState,
  ExportButton,
  RateBadge,
  SectionCard,
  StatCard,
  TypeBadge,
  formatDate,
  percent,
} from "./shared";

type View = "practice" | "events";

export default function ReportsTab() {
  const [view, setView] = useState<View>("practice");

  const [practice, setPractice] = useState<PracticeReport | null>(null);
  const [eventRows, setEventRows] = useState<EventReportRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);

    const request =
      view === "practice"
        ? apiFetch<PracticeReport>(
            "/admin/reports/practice-attendance?sort=attendance_rate",
          ).then(setPractice)
        : apiFetch<{ members: EventReportRow[] }>(
            "/admin/reports/event-attendance",
          ).then((data) => setEventRows(data.members));

    request
      .catch((err) =>
        toast.error(err instanceof Error ? err.message : "Failed to load report"),
      )
      .finally(() => setLoading(false));
  }, [view]);

  return (
    <div className="space-y-5">
      {/* View switch */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {(["practice", "events"] as View[]).map((option) => (
          <button
            key={option}
            onClick={() => setView(option)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              view === option
                ? "bg-white text-rose-600 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {option === "practice" ? "Practice attendance" : "Event participation"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : view === "practice" ? (
        <PracticeReportView report={practice} />
      ) : (
        <EventReportView rows={eventRows} />
      )}
    </div>
  );
}

function PracticeReportView({ report }: { report: PracticeReport | null }) {
  if (!report) return <EmptyState message="No report data." />;

  const withRecords = report.members.filter((m) => m.recorded > 0);
  const average =
    withRecords.length > 0
      ? Math.round(
          (withRecords.reduce((sum, m) => sum + (m.attendance_rate ?? 0), 0) /
            withRecords.length) *
            10,
        ) / 10
      : null;

  const atRisk = withRecords.filter(
    (m) => (m.attendance_rate ?? 100) < 60,
  ).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Sessions held" value={report.sessions_held} />
        <StatCard label="Average rate" value={percent(average)} tone="emerald" />
        <StatCard
          label="Below 60%"
          value={atRisk}
          tone={atRisk > 0 ? "amber" : "gray"}
        />
        <StatCard
          label="No records"
          value={report.members.length - withRecords.length}
          tone="gray"
        />
      </div>

      <SectionCard
        title="Per-member reliability"
        count={report.members.length}
        action={
          <ExportButton
            path="/exports/reports/practice-attendance.csv"
            filename="practice-attendance-report.csv"
          />
        }
      >
        {report.members.length === 0 ? (
          <EmptyState message="No staff to report on." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-rose-50/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Member</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Attended</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Absent</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Late</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Rate</th>
                  <th className="text-left px-3 py-2.5 font-semibold">Last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {report.members.map((member) => (
                  <tr key={member.user_id} className="hover:bg-rose-50/30">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            member.active ? "text-gray-800" : "text-gray-400"
                          }
                        >
                          {member.first_name} {member.last_name}
                        </span>
                        <TypeBadge type={member.type} />
                        {!member.active && (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">
                            Inactive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-700">
                      {member.attended}
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-700">
                      {member.absent}
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-700">
                      {member.late}
                    </td>
                    <td className="text-center px-3 py-2.5">
                      <RateBadge rate={member.attendance_rate} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 text-xs">
                      {formatDate(member.last_attended)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      <SectionCard title="Turnout by session" count={report.sessions.length}>
        {report.sessions.length === 0 ? (
          <EmptyState message="No sessions have been held yet." />
        ) : (
          <div className="divide-y divide-rose-50">
            {report.sessions.map((session) => (
              <div
                key={session.id}
                className="px-5 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {session.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(session.date)} · {session.attended}/
                    {session.recorded} attended
                    {session.late > 0 && ` · ${session.late} late`}
                  </p>
                </div>
                <RateBadge rate={session.attendance_rate} />
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </>
  );
}

function EventReportView({ rows }: { rows: EventReportRow[] | null }) {
  if (!rows) return <EmptyState message="No report data." />;

  const totalRsvps = rows.reduce((sum, r) => sum + r.rsvps, 0);
  const drivers = rows.filter((r) => r.driving > 0).length;

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total RSVPs" value={totalRsvps} />
        <StatCard
          label="Going"
          value={rows.reduce((sum, r) => sum + r.going, 0)}
          tone="emerald"
        />
        <StatCard
          label="Declined"
          value={rows.reduce((sum, r) => sum + r.declined, 0)}
          tone="gray"
        />
        <StatCard label="People who drive" value={drivers} tone="purple" />
      </div>

      <SectionCard
        title="Per-member participation"
        count={rows.length}
        action={
          <ExportButton
            path="/exports/reports/event-attendance.csv"
            filename="event-attendance-report.csv"
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState message="No staff to report on." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-rose-50/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-5 py-2.5 font-semibold">Member</th>
                  <th className="text-center px-3 py-2.5 font-semibold">RSVPs</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Going</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Maybe</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Declined</th>
                  <th className="text-center px-3 py-2.5 font-semibold">Drove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rose-50">
                {rows.map((member) => (
                  <tr key={member.user_id} className="hover:bg-rose-50/30">
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-800">
                          {member.first_name} {member.last_name}
                        </span>
                        <TypeBadge type={member.type} />
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-700">
                      {member.rsvps}
                    </td>
                    <td className="text-center px-3 py-2.5 text-emerald-600 font-medium">
                      {member.going}
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-500">
                      {member.maybe}
                    </td>
                    <td className="text-center px-3 py-2.5 text-gray-500">
                      {member.declined}
                    </td>
                    <td className="text-center px-3 py-2.5 text-purple-600">
                      {member.driving}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </>
  );
}
