"use client";
import { useState, useEffect } from "react";
import { Event } from "@/types/event";
import EventFilters from "./EventFilters";
import { useUserAuthentication } from "../UserAuthentication";
import AddEvent from "./AddEvent";
import EditAttendance from "./EditAttendance";
import EditEvents from "./EditEvent";
import SignUpModal from "./SignUpModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { authHeadersNoContent } from "@/lib/api";
import EventInfo from "./EventInfo";

type EventCardProps = {
  initialEvents: Event[];
  initialPage: number;
};

type AttendanceRecord = {
  id: number;
  event_id: number;
};

function getStatusColor(status: string) {
  switch (status) {
    case "published":
      return "default";
    case "cancelled":
      return "destructive";
    case "draft":
      return "secondary";
    default:
      return "secondary";
  }
}

export default function EventCards({
  initialEvents,
  initialPage,
}: EventCardProps) {
  const [page, setPage] = useState(initialPage);
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [showMine, setShowMine] = useState(false);
  const { user, loading } = useUserAuthentication();

  const displayedEvents = showMine
    ? initialEvents.filter((e) => attendances.some((a) => a.event_id === e.id))
    : initialEvents;

  useEffect(() => {
    if (!user) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendances/me`, {
      // credentials: "include",
      headers: authHeadersNoContent(),
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

  async function handleLeave(eventId: number) {
    const attendance = attendances.find((a) => a.event_id === eventId);
    if (!attendance) return;

    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/attendances/${attendance.id}`,
      {
        method: "DELETE",
        headers: authHeadersNoContent(),
        // credentials: "include",
      },
    );

    setAttendances(attendances.filter((a) => a.event_id !== eventId));
  }

  if (loading) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <EventFilters showMine={showMine} setShowMine={setShowMine} />
        {user && user.admin && <AddEvent />}
      </div>

      {displayedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-5xl mb-4">🎀</p>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No events found
          </h2>
          <p className="text-gray-400 text-sm">
            Try adjusting your search or check back later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {displayedEvents.map((event) => {
            const isAttending = attendances.some(
              (a) => a.event_id === event.id,
            );
            const currentAttendance = attendances.find(
              (a) => a.event_id === event.id,
            );

            return (
              <Card key={event.id}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <CardTitle>{event.title}</CardTitle>
                  <Badge variant={getStatusColor(event.status)}>
                    {event.status}
                  </Badge>
                </CardHeader>

                <CardContent className="flex flex-col gap-3">
                  <div className="text-sm text-muted-foreground">
                    {event.location && <span>📍 {event.location} · </span>}
                    {event.max_attendees && (
                      <span>👥 {event.max_attendees} spots · </span>
                    )}
                    <span>
                      📅 {new Date(event.end_datetime).toLocaleDateString()}
                    </span>
                  </div>

                  {event.description && (
                    <p className="text-sm">{event.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mt-2">
                    {user &&
                      (isAttending ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleLeave(event.id)}
                        >
                          Leave Event
                        </Button>
                      ) : (
                        <SignUpModal
                          eventId={event.id}
                          onSuccess={(newAttendance) =>
                            setAttendances([...attendances, newAttendance])
                          }
                        />
                      ))}

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
                        statusProps={event.status}
                      />
                    )}
                    {user && user.admin && <EventInfo eventIdProp={event.id} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
