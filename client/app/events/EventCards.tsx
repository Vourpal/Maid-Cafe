"use client";
import { useState } from "react";
import { Event } from "@/types/event";
import EventFilters from "./EventFilters";
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
  const [loading, setLoading] = useState(false);
// should filter be here or in page.tsx?
  return (
    <div>
      <div>
        <EventFilters/>
        {events.map((event) => (
          <div key={event.id}>
            <h1>{event.title}</h1>
            <div>
              Will be located at {event.location} with a max of{" "}
              {event.max_attendees} participants... final date to sign up is{" "}
              {event.end_datetime}
            </div>
            <div>Description: {event.description}</div>
            <span>I&apos;m a silly little page {page}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
