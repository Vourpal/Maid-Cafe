"use client";
import { useState, useEffect } from "react";
import { Event } from "@/types/event";
import EventFilters from "./EventFilters";
import { useUserAuthentication } from "../UserAuthentication";
import AddEvent from "./AddEvent";
import EditAttendance from "./EditAttendance";
import EditEvents from "./EditEvent";

type EventCardProps = {
  initialEvents: Event[];
  initialPage: number;
};

type AttendanceRecord = {
  id: number;
  event_id: number;
};

export default function EventCards({
  initialEvents,
  initialPage,
}: EventCardProps) {
  const [page, setPage] = useState(initialPage);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [showMine, setShowMine] = useState(false);
  const { user, loading } = useUserAuthentication();
  console.log("attendances", attendances);
  const displayedEvents = showMine
    ? initialEvents.filter((e) => attendances.some((a) => a.event_id === e.id))
    : initialEvents;

  useEffect(() => {
    if (!user) return;
    fetch("http://localhost:5000/attendances/me", {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) =>
        setAttendances(
          data.data.map((a: AttendanceRecord) => ({
            id: a.id,
            event_id: a.event_id,
          })),
        ),
      )
      .catch(() => setAttendances([]));
  }, [user]);

  async function handleSignUp(eventId: number) {
    const res = await fetch("http://localhost:5000/attendances/me", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, status: "going" }),
    });

    const data = await res.json();
    setAttendances([...attendances, { id: data.data.id, event_id: eventId }]);
  }

  async function handleLeave(eventId: number) {
    const attendance = attendances.find((a) => a.event_id === eventId);
    if (!attendance) return;

    await fetch(`http://localhost:5000/attendances/${attendance.id}`, {
      method: "DELETE",
      credentials: "include",
    });

    setAttendances(attendances.filter((a) => a.event_id !== eventId));
  }

  if (loading) return null;
  console.log(attendances);

  return (
    <div>
      <div>
        {user && user.admin && <AddEvent />}
        <EventFilters showMine={showMine} setShowMine={setShowMine} />
        {displayedEvents.map((event) => {
          const isAttending = attendances.some((a) => a.event_id === event.id);

          const currentAttendance = attendances.find(
            (a) => a.event_id === event.id,
          );

          return (
            <div key={event.id}>
              <h1>{event.title}</h1>
              <div>
                Will be located at {event.location} with a max of{" "}
                {event.max_attendees} participants... final date to sign up is{" "}
                {event.end_datetime}
              </div>
              <div>Description: {event.description}</div>

              {user && (
                <button
                  onClick={() =>
                    isAttending ? handleLeave(event.id) : handleSignUp(event.id)
                  }
                >
                  {isAttending ? "Leave Event" : "Sign Up"}
                </button>
              )}

              {user && isAttending && currentAttendance && (
                <EditAttendance attendanceId={currentAttendance.id} />
              )}

              {user && user.admin && (
                <EditEvents
                  eventIdProp={event.id}
                  titleProp={event.title}
                  descriptionProp={event.description}
                  startDateProp={event.start_datetime}
                  endDateProp={event.end_datetime}
                  locationProp={event.location}
                  maxAttendeesProp={event.max_attendees}
                />
              )}

              {user && (event.created_by === user.id || user.admin) && (
                <button>Edit</button>
              )}
            </div>
          );
        })}
        <span>I&apos;m a silly little page {page}</span>
        {user ? (
          <p className="text-green-600">Hey stinky you are logged in</p>
        ) : (
          <p className="text-red-500">You are not logged in</p>
        )}
      </div>
    </div>
  );
}
