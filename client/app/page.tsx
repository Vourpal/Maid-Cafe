"use client";

import Link from "next/link";
import { useUserAuthentication } from "./UserAuthentication";
import { useEffect, useState } from "react";
import { ArrowRight, Sparkles, CalendarDays, Dumbbell, MapPin, Clock } from "lucide-react";

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
