"use client";
import { useState } from "react";
import { Event } from "@/types/event";
import EventFilters from "./EventFilters";
import { useUserAuthentication } from "../UserAuthentication";
import Link from "next/link";
import AddEvent from "./AddEvent";
type EventCardProps = {
  initialEvents: Event[];
  initialPage: number;
};

// useSearchParams → read query params from the current URL (Next.js specific)

// URLSearchParams → create or manipulate query strings (standard browser API)
export default function EventCards({
  initialEvents,
  initialPage,
}: EventCardProps) {
  const [events, setEvents] = useState<Event[]>(initialEvents);
  const [page, setPage] = useState(initialPage);
  const { user, loading } = useUserAuthentication();

  // should filter be here or in page.tsx?
  if (loading) return null;
  return (
    <div>
      <div>
        {user && user.admin && <AddEvent />}
        <EventFilters />
        {events.map((event) => (
          <div key={event.id}>
            <h1>{event.title}</h1>
            <div>
              Will be located at {event.location} with a max of{" "}
              {event.max_attendees} participants... final date to sign up is{" "}
              {event.end_datetime}
            </div>
            <div>Description: {event.description}</div>
            {user && (event.created_by === user.id || user.admin) && <button>Edit</button>}
          </div>
        ))}
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
