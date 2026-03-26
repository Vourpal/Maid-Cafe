"use client";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Button } from "@/components/ui/button";
import { authHeadersNoContent } from "@/lib/api";
import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  resource?: unknown; // optional extra data
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales: { "en-US": enUS },
});

type Attendance = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  username: string;
};
export default function Attendance() {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [date, setDate] = useState(new Date());
  const { user } = useUserAuthentication();
  // prob get usercontext

  // will want to add another table for practice i guess? and also for attendance?

  async function handleAttendance() {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
      method: "GET",
      headers: authHeadersNoContent(),
    });
    const data = await res.json();
    setAttendance(data.data);
  }
  if (!user || !user.admin) return;
  return (
    <div>
      <Calendar
        localizer={localizer}
        events={[]} // array of CalendarEvent
        startAccessor="start" // which field is the start date
        endAccessor="end" // which field is the end date
        date={date}
        onNavigate={(newDate) => setDate(newDate)}
        style={{ height: 500 }} // required, needs explicit height
        //onSelectEvent={(event) => console.log(event)} // click handler
      />
      I am a cute Page Or whatever
      {attendance
        ? attendance.map((attender) => (
            <div key={attender.id}>{attender.first_name}</div>
          ))
        : null}
      <Button onClick={handleAttendance}>Click me</Button>
    </div>
  );
}
