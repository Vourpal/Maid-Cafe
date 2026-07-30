"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Car, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { Dashboard } from "@/types/admin";
import {
  EmptyState,
  RateBadge,
  SectionCard,
  StatCard,
  formatDateTime,
  percent,
  relativeTime,
} from "./shared";

export default function OverviewTab() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Dashboard>("/admin/dashboard")
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white rounded-2xl border border-red-100 p-8 text-center">
        <p className="text-sm text-red-500">{error ?? "Could not load dashboard"}</p>
      </div>
    );
  }

  const { staff, events, practice, tasks, invites, attention } = data;

  return (
    <div className="space-y-5">
      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Staff"
          value={staff.total}
          hint={`${staff.maids} maids · ${staff.butlers} butlers · ${staff.admins} admin`}
        />
        <StatCard
          label="Upcoming events"
          value={events.upcoming}
          hint={`${events.total} total · ${events.draft} draft`}
          tone="purple"
        />
        <StatCard
          label="Practice turnout"
          value={percent(practice.attendance_rate)}
          hint={`${practice.held} sessions held · ${practice.upcoming} upcoming`}
          tone="emerald"
        />
        <StatCard
          label="Open tasks"
          value={tasks.open}
          hint={`${tasks.overdue} overdue · ${tasks.unassigned} unassigned`}
          tone={tasks.overdue > 0 ? "amber" : "gray"}
        />
      </div>

      {/* Things that need a decision */}
      {(attention.overdue_tasks.length > 0 ||
        attention.unassigned_tasks.length > 0 ||
        staff.no_availability > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h2 className="font-semibold text-amber-800 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            Needs attention
          </h2>
          <ul className="space-y-1.5 text-sm text-amber-900">
            {attention.overdue_tasks.map((task) => (
              <li key={`overdue-${task.id}`}>
                <span className="font-medium">{task.title}</span> is overdue
                {task.assignee
                  ? ` — ${task.assignee.first_name} ${task.assignee.last_name}`
                  : " and unassigned"}{" "}
                <span className="text-amber-600">({relativeTime(task.due_date)})</span>
              </li>
            ))}
            {attention.unassigned_tasks.map((task) => (
              <li key={`unassigned-${task.id}`}>
                <span className="font-medium">{task.title}</span> has no assignee
              </li>
            ))}
            {staff.no_availability > 0 && (
              <li>
                {staff.no_availability} staff member
                {staff.no_availability === 1 ? " has" : "s have"} not filled in
                availability
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming events with sign-up counts */}
        <SectionCard title="Upcoming events" count={data.upcoming_events.length}>
          {data.upcoming_events.length === 0 ? (
            <EmptyState message="No upcoming events." />
          ) : (
            <div className="divide-y divide-rose-50">
              {data.upcoming_events.map((event) => (
                <div key={event.id} className="px-5 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        <CalendarDays className="w-3 h-3 inline mr-1" />
                        {formatDateTime(event.start_datetime)}
                        {event.location && ` · ${event.location}`}
                      </p>
                    </div>
                    {event.status !== "published" && (
                      <span className="text-[10px] uppercase font-semibold text-gray-400 shrink-0">
                        {event.status}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span className={event.over_capacity ? "text-red-600 font-medium" : ""}>
                      <Users className="w-3 h-3 inline mr-1" />
                      {event.going} going
                      {event.max_attendees ? ` / ${event.max_attendees}` : ""}
                      {event.over_capacity && " (over capacity)"}
                    </span>
                    <span>
                      <Car className="w-3 h-3 inline mr-1" />
                      {event.drivers} driver{event.drivers === 1 ? "" : "s"} ·{" "}
                      {event.passengers}/{event.seats_offered} seats used
                    </span>
                    {event.seats_offered > 0 && event.seats_left === 0 && (
                      <span className="text-amber-600 font-medium">Carpool full</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Recent practice turnout */}
        <SectionCard title="Recent practice turnout">
          {data.recent_sessions.length === 0 ? (
            <EmptyState message="No practice sessions have been held yet." />
          ) : (
            <div className="divide-y divide-rose-50">
              {data.recent_sessions.map((session) => (
                <div
                  key={session.id}
                  className="px-5 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDateTime(session.date)} · {session.attended}/
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Next practice + invite summary */}
        <SectionCard title="At a glance">
          <div className="px-5 py-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Next practice</span>
              <span className="text-gray-800 font-medium text-right">
                {data.next_practice
                  ? `${data.next_practice.title} · ${formatDateTime(data.next_practice.date)}`
                  : "None scheduled"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Active invite codes</span>
              <span className="text-gray-800 font-medium">{invites.active}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Resource links</span>
              <span className="text-gray-800 font-medium">{data.links.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Inactive accounts</span>
              <span className="text-gray-800 font-medium">{staff.inactive}</span>
            </div>
          </div>
        </SectionCard>

        {/* Recent activity, straight from the audit log */}
        <SectionCard
          title="Recent activity"
          action={
            <Link
              href="/admin?tab=audit"
              className="text-xs text-rose-600 hover:underline"
            >
              View all
            </Link>
          }
        >
          {data.recent_activity.length === 0 ? (
            <EmptyState message="Nothing logged yet." />
          ) : (
            <div className="divide-y divide-rose-50">
              {data.recent_activity.map((entry) => (
                <div key={entry.id} className="px-5 py-2.5">
                  <p className="text-sm text-gray-700">{entry.summary}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {entry.actor_label ?? "System"} · {relativeTime(entry.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
