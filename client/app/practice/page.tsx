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
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"month" | "week" | "day" | "agenda" | "work_week">("month");
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

  const calendarEvents: CalendarEvent[] = sessions.map((session) => ({
    title: session.title,
    start: new Date(session.date),
    end: new Date(session.date),
    resource: session,
  }));

  if (!user || !user.admin) return null;

  return (
    <div>
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
        style={{ height: 500 }}
      />

      <ViewPractice
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      <AddPractice setSessions={setSessions} />
    </div>
  );
}
