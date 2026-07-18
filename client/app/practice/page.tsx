"use client";

import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { authHeadersNoContent } from "@/lib/api";
import { useState, useEffect } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import AddPractice from "./AddPractice";
import ViewPractice from "./ViewPractice";
import { PracticeSessions } from "@/types/event";
import { MapPin, Clock } from "lucide-react";

type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  resource: PracticeSessions;
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

export default function Practice() {
  const [sessions, setSessions] = useState<PracticeSessions[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null,
  );
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<
    "month" | "week" | "day" | "agenda" | "work_week"
  >("month");

  const { user } = useUserAuthentication();

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/practice-sessions`, {
      method: "GET",
      headers: authHeadersNoContent(),
    })
      .then((res) => res.json())
      .then((data) => setSessions(data.data))
      .catch((err) => console.error("Failed to fetch practice sessions:", err));
  }, []);

  const calendarEvents: CalendarEvent[] = sessions
    .map((session) => {
      const start = new Date(session.date);
      if (isNaN(start.getTime())) {
        console.error("Invalid date:", session.date);
        return null;
      }
      const end = new Date(start.getTime() + 60 * 60 * 1000);
      return { title: session.title, start, end, resource: session };
    })
    .filter(Boolean) as CalendarEvent[];

  // Upcoming sessions sorted by date
  const upcoming = sessions
    .filter((s) => new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 5);

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Practice Schedule</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            View and manage practice sessions
          </p>
        </div>
        {user.admin && <AddPractice setSessions={setSessions} />}
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          <div className="rbc-rose-theme p-4">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              date={date}
              view={view}
              onNavigate={(newDate) => setDate(newDate)}
              onView={(newView) => setView(newView)}
              onSelectEvent={(event) => setSelectedEvent(event)}
              style={{ height: 520 }}
            />
          </div>
        </div>

        {/* Upcoming panel */}
        <div className="w-full lg:w-72 shrink-0 space-y-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide px-1">
            Upcoming Sessions
          </h2>

          {upcoming.length === 0 ? (
            <div className="bg-white rounded-xl border border-rose-100 p-6 text-center text-gray-400 text-sm">
              No upcoming sessions
            </div>
          ) : (
            upcoming.map((session) => {
              const d = new Date(session.date);
              const month = d
                .toLocaleString("en-US", { month: "short" })
                .toUpperCase();
              const day = d.getDate();
              return (
                <div
                  key={session.id}
                  className="bg-white rounded-xl border border-rose-100 shadow-sm p-4 flex gap-3 cursor-pointer hover:border-rose-300 hover:shadow-md transition-all"
                  onClick={() => {
                    const ev = calendarEvents.find(
                      (e) => e.resource.id === session.id,
                    );
                    if (ev) setSelectedEvent(ev);
                  }}
                >
                  {/* Date badge */}
                  <div className="flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-xl w-12 h-12 shrink-0 text-center">
                    <span className="text-[9px] font-bold text-rose-400 tracking-widest leading-none">
                      {month}
                    </span>
                    <span className="text-xl font-bold text-rose-600 leading-tight">
                      {day}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {session.title}
                    </p>
                    {session.location && (
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {session.location}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      {d.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <ViewPractice
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        setSessions={setSessions}
      />
    </div>
  );
}
