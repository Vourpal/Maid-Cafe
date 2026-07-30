"use client";

import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Sparkles,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardList,
  Dumbbell,
  MapPin,
  Megaphone,
  Pin,
  Clock,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import type {
  Announcement,
  AnnouncementListResponse,
  Assignment,
  Task,
} from "@/types/admin";

const PRIORITY_STYLES: Record<string, string> = {
  normal: "border-rose-100",
  important: "border-amber-200 bg-amber-50/40",
  urgent: "border-red-200 bg-red-50/40",
};

/** Shift window, or "All day" when the assignment has no times. */
function shiftWindow(assignment: Assignment): string {
  if (!assignment.starts_at || !assignment.ends_at) return "All day";
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  return `${time(assignment.starts_at)} – ${time(assignment.ends_at)}`;
}

type UpcomingEvent = {
  id: number;
  title: string;
  end_datetime: string;
  location: string | null;
  status: string;
};

type UpcomingSession = {
  id: number;
  title: string;
  date: string;
  location: string | null;
};

export default function Home() {
  const { user, loading } = useUserAuthentication();
  const [nextEvent, setNextEvent] = useState<UpcomingEvent | null>(null);
  const [nextSession, setNextSession] = useState<UpcomingSession | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [myShifts, setMyShifts] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  // Fetch the single soonest upcoming event (public endpoint)
  useEffect(() => {
    const now = new Date().toISOString().split("T")[0];
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/events?page=1&quantity=9999`, {
      cache: "no-store",
    })
      .then((r) => r.json())
      .then((data) => {
        const events: UpcomingEvent[] = data?.data?.events ?? [];
        const future = events
          .filter((e) => new Date(e.end_datetime) >= new Date() && e.status !== "cancelled")
          .sort((a, b) => new Date(a.end_datetime).getTime() - new Date(b.end_datetime).getTime());
        setNextEvent(future[0] ?? null);
      })
      .catch(() => {});
  }, []);

  // Fetch next practice session (auth required)
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/practice-sessions`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        const sessions: UpcomingSession[] = data?.data ?? [];
        const future = sessions
          .filter((s) => new Date(s.date) >= new Date())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        setNextSession(future[0] ?? null);
      })
      .catch(() => {});
  }, [user]);

  // Tasks assigned to this member. Open ones only — the point is what is left
  // to do, not a history.
  useEffect(() => {
    if (!user) return;
    apiFetch<Task[]>("/tasks/me?completed=false")
      .then(setMyTasks)
      .catch(() => setMyTasks([]));
  }, [user]);

  // Shifts this member has been given, upcoming events only.
  useEffect(() => {
    if (!user) return;
    apiFetch<Assignment[]>("/assignments/me")
      .then(setMyShifts)
      .catch(() => setMyShifts([]));
  }, [user]);

  // The feed only ever contains published, unexpired entries — the server
  // handles that, so there is nothing to filter here.
  useEffect(() => {
    if (!user) return;
    apiFetch<AnnouncementListResponse>("/announcements?quantity=10")
      .then((res) => setAnnouncements(res.announcements))
      .catch(() => setAnnouncements([]));
  }, [user]);

  async function completeTask(task: Task) {
    setMyTasks((prev) => prev.filter((t) => t.id !== task.id));
    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: true }),
      });
      toast.success(`Marked "${task.title}" complete`);
    } catch (err) {
      setMyTasks((prev) => [...prev, task]);
      toast.error(err instanceof Error ? err.message : "Could not update task");
    }
  }

  return (
    <div className="px-4 py-8 max-w-4xl mx-auto space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-400 via-rose-500 to-rose-600 p-8 text-white shadow-lg">
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 text-rose-100 text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Maid Café Staff Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">
            {user ? `Hey, ${user.first_name}` : "🎀 Maid Café"}
          </h1>
          <p className="text-rose-100 text-base max-w-xl">
            {user
              ? `Welcome back${user.type ? `, ${user.type.charAt(0).toUpperCase() + user.type.slice(1)}` : ""}. Here's what's coming up.`
              : "Your cozy hub for events, practices, and staff coordination."}
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/events"
              className="inline-flex items-center gap-2 bg-white text-rose-600 font-semibold px-5 py-2.5 rounded-full hover:bg-rose-50 transition text-sm shadow"
            >
              Browse Events
              <ArrowRight className="w-4 h-4" />
            </Link>
            {!user && !loading && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-rose-700 text-white font-semibold px-5 py-2.5 rounded-full hover:bg-rose-800 transition text-sm"
              >
                Staff Login
              </Link>
            )}
          </div>
        </div>

        <div className="absolute -right-8 -top-8 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -right-4 -bottom-12 w-64 h-64 rounded-full bg-white/5" />
      </div>

      {/* Announcements — pinned first, expired ones never arrive */}
      {user && !loading && announcements.length > 0 && (
        <div className="space-y-3">
          {announcements.map((entry) => (
            <div
              key={entry.id}
              className={`bg-white rounded-2xl border shadow-sm p-5 ${
                PRIORITY_STYLES[entry.priority] ?? PRIORITY_STYLES.normal
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                  <Megaphone className="w-4 h-4 text-rose-500" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-gray-800">{entry.title}</h2>
                    {entry.pinned && (
                      <span className="text-xs bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Pin className="w-3 h-3" />
                        Pinned
                      </span>
                    )}
                    {entry.priority !== "normal" && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                          entry.priority === "urgent"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {entry.priority}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mt-1.5 whitespace-pre-line">
                    {entry.body}
                  </p>

                  <p className="text-xs text-gray-400 mt-2">
                    {entry.author_label ?? "Staff"}
                    {entry.created_at &&
                      ` · ${new Date(entry.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}`}
                    {entry.event_title && ` · ${entry.event_title}`}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logged-in: upcoming snapshots */}
      {user && !loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Next event */}
          <Link href="/events" className="group block">
            <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5 hover:shadow-md hover:border-rose-300 transition-all h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4 text-rose-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Next Event
                </span>
              </div>

              {nextEvent ? (
                <>
                  <p className="font-semibold text-gray-800 group-hover:text-rose-600 transition-colors leading-tight">
                    {nextEvent.title}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {new Date(nextEvent.end_datetime).toLocaleDateString("en-US", {
                        weekday: "short", month: "long", day: "numeric",
                      })}
                    </p>
                    {nextEvent.location && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {nextEvent.location}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No upcoming events</p>
              )}
            </div>
          </Link>

          {/* Next practice */}
          <Link href="/practice" className="group block">
            <div className="bg-white rounded-2xl border border-purple-100 shadow-sm p-5 hover:shadow-md hover:border-purple-300 transition-all h-full">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
                  <Dumbbell className="w-4 h-4 text-purple-500" />
                </div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Next Practice
                </span>
              </div>

              {nextSession ? (
                <>
                  <p className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors leading-tight">
                    {nextSession.title}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-gray-400">
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {new Date(nextSession.date).toLocaleString("en-US", {
                        weekday: "short", month: "long",
                        day: "numeric", hour: "numeric", minute: "2-digit",
                      })}
                    </p>
                    {nextSession.location && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {nextSession.location}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-400">No upcoming practice sessions</p>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Your shifts — the job side of an event, next to the RSVP side */}
      {user && !loading && myShifts.length > 0 && (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-rose-50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
              <BriefcaseBusiness className="w-4 h-4 text-rose-500" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Your shifts
            </span>
            <span className="ml-auto text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-medium">
              {myShifts.length}
            </span>
          </div>

          <div className="divide-y divide-rose-50">
            {myShifts.map((shift) => (
              <div key={shift.id} className="px-5 py-3">
                <p className="text-sm font-medium text-gray-800">
                  {shift.position_name}
                  <span className="ml-2 text-xs font-normal text-gray-400">
                    {shift.event_title}
                  </span>
                </p>
                <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <CalendarDays className="w-3 h-3 shrink-0" />
                    {shift.event_start &&
                      new Date(shift.event_start).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "long",
                        day: "numeric",
                      })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 shrink-0" />
                    {shiftWindow(shift)}
                  </span>
                  {shift.event_location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {shift.event_location}
                    </span>
                  )}
                </div>
                {shift.notes && (
                  <p className="text-xs text-gray-400 mt-1">{shift.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My tasks */}
      {user && !loading && myTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-50 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <ClipboardList className="w-4 h-4 text-amber-500" />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Your tasks
            </span>
            <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              {myTasks.length}
            </span>
          </div>

          <div className="divide-y divide-amber-50">
            {myTasks.map((task) => {
              const overdue =
                task.due_date && new Date(task.due_date) < new Date();

              return (
                <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                  <button
                    onClick={() => completeTask(task)}
                    className="mt-0.5 w-5 h-5 rounded-md border border-gray-300 hover:border-amber-500 hover:bg-amber-50 flex items-center justify-center shrink-0 transition"
                    title="Mark complete"
                  >
                    <Check className="w-3 h-3 text-transparent hover:text-amber-500" />
                  </button>

                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {task.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1 text-xs">
                      {task.due_date && (
                        <span
                          className={
                            overdue ? "text-red-600 font-medium" : "text-gray-400"
                          }
                        >
                          Due{" "}
                          {new Date(task.due_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                          {overdue && " · overdue"}
                        </span>
                      )}
                      {task.event_title && (
                        <span className="text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                          {task.event_title}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Guest info */}
      {!user && !loading && (
        <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center shadow-sm">
          <p className="text-4xl mb-3">🎀</p>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Staff Portal</h2>
          <p className="text-gray-500 text-sm max-w-sm mx-auto mb-5">
            This portal is for Maid Café staff members. Log in to access practice
            schedules, resources, and event sign-ups.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/login"
              className="bg-rose-500 text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-rose-600 transition"
            >
              Login
            </Link>
            <Link
              href="/login/newUser"
              className="border border-rose-300 text-rose-500 px-5 py-2.5 rounded-full text-sm font-medium hover:bg-rose-50 transition"
            >
              Register with invite
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
