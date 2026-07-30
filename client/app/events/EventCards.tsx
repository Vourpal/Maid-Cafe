"use client";
import { useState, useEffect } from "react";
import { Event } from "@/types/event";
import EventFilters from "./EventFilters";
import { useUserAuthentication } from "../UserAuthentication";
import AddEvent from "./AddEvent";
import EditAttendance from "./EditAttendance";
import EditEvents from "./EditEvent";
import SignUpModal from "./SignUpModal";
import { Button } from "@/components/ui/button";
import { authHeadersNoContent, downloadCsv } from "@/lib/api";
import EventInfo from "./EventInfo";
import EventRoster from "./EventRoster";
import EventAssignments from "./EventAssignments";
import EventMenuManager from "./EventMenuManager";
import { MapPin, Users, CalendarDays, Download } from "lucide-react";
import { toast } from "sonner";

type EventCardProps = {
  initialEvents: Event[];
  initialPage: number;
  initialFutureOnly: boolean;
};

type AttendanceRecord = {
  id: number;
  event_id: number;
};

function getStatusBorderColor(status: string) {
  switch (status) {
    case "published":
      return "border-l-green-500";
    case "cancelled":
      return "border-l-red-500";
    case "draft":
      return "border-l-amber-400";
    default:
      return "border-l-gray-300";
  }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "published":
      return "bg-green-50 text-green-700 border-green-200";
    case "cancelled":
      return "bg-red-50 text-red-700 border-red-200";
    case "draft":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-gray-50 text-gray-600 border-gray-200";
  }
}

function DateBadge({ dateStr }: { dateStr: string }) {
  const d = new Date(dateStr);
  const month = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const day = d.getDate();
  return (
    <div className="flex flex-col items-center justify-center bg-rose-50 border border-rose-100 rounded-xl w-14 h-14 shrink-0 text-center">
      <span className="text-[10px] font-bold text-rose-400 tracking-widest leading-none">
        {month}
      </span>
      <span className="text-2xl font-bold text-rose-600 leading-tight">
        {day}
      </span>
    </div>
  );
}

export default function EventCards({
  initialEvents,
  initialPage,
  initialFutureOnly,
}: EventCardProps) {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([]);
  const [showMine, setShowMine] = useState(false);
  const [showFutureOnly, setShowFutureOnly] = useState(initialFutureOnly);
  const [rosterEventId, setRosterEventId] = useState<number | null>(null);
  const [shiftsEventId, setShiftsEventId] = useState<number | null>(null);
  const [menuEventId, setMenuEventId] = useState<number | null>(null);
  const { user, loading } = useUserAuthentication();

  // showMine is still client-side (it only hides events the user isn't attending,
  // no effect on pagination count so it's fine to filter locally)
  const displayedEvents = showMine
    ? initialEvents.filter((e) => attendances.some((a) => a.event_id === e.id))
    : initialEvents;

  useEffect(() => {
    if (!user) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/attendances/me`, {
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
      },
    );

    setAttendances(attendances.filter((a) => a.event_id !== eventId));
  }

  async function handleExportRoster(event: Event) {
    try {
      await downloadCsv(
        `/exports/events/${event.id}/roster.csv`,
        `roster-${event.id}.csv`,
      );
      toast.success("Roster downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    }
  }

  if (loading) return null;

  return (
    <div className="px-4 py-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Events</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            Browse and sign up for upcoming café events
          </p>
        </div>
        {user?.admin && <AddEvent />}
      </div>

      {/* Filters */}
      <div className="mb-6">
        <EventFilters
          showMine={showMine}
          setShowMine={setShowMine}
          showFutureOnly={showFutureOnly}
          setShowFutureOnly={setShowFutureOnly}
        />
      </div>

      {/* Event list */}
      {displayedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-5xl mb-4">🎀</p>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            No events found
          </h2>
          <p className="text-gray-400 text-sm">
            Try adjusting your search or check back later.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {displayedEvents.map((event) => {
            const isAttending = attendances.some(
              (a) => a.event_id === event.id,
            );
            const currentAttendance = attendances.find(
              (a) => a.event_id === event.id,
            );

            return (
              <div
                key={event.id}
                className={`bg-white rounded-xl border border-l-4 border-gray-100 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-0 overflow-hidden ${getStatusBorderColor(event.status)}`}
              >
                {/* Main content */}
                <div className="flex items-start gap-4 p-4 flex-1 min-w-0">
                  <DateBadge dateStr={event.end_datetime} />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-800 leading-tight">
                        {event.title}
                      </h2>
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full border capitalize shrink-0 ${getStatusBadgeClass(event.status)}`}
                      >
                        {event.status}
                      </span>
                    </div>

                    {event.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {event.location}
                        </span>
                      )}
                      {event.max_attendees && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {event.max_attendees} spots
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {new Date(event.end_datetime).toLocaleDateString(
                          "en-US",
                          {
                            weekday: "short",
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {user &&
                        (isAttending ? (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs rounded-full"
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

                      {user?.admin && (
                        <>
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
                          <EventInfo eventIdProp={event.id} />
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-300 text-rose-500 hover:bg-rose-50 h-7 text-xs rounded-full"
                            onClick={() => setRosterEventId(event.id)}
                          >
                            Manage Roster
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-300 text-rose-500 hover:bg-rose-50 h-7 text-xs rounded-full"
                            onClick={() => setShiftsEventId(event.id)}
                          >
                            Shifts
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-rose-300 text-rose-500 hover:bg-rose-50 h-7 text-xs rounded-full"
                            onClick={() => setMenuEventId(event.id)}
                          >
                            Menu
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-gray-200 text-gray-500 hover:bg-gray-50 h-7 text-xs rounded-full"
                            onClick={() => handleExportRoster(event)}
                          >
                            <Download className="w-3 h-3 mr-1" />
                            CSV
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rosterEventId !== null && (
        <EventRoster
          eventId={rosterEventId}
          onClose={() => setRosterEventId(null)}
        />
      )}

      {shiftsEventId !== null && (
        <EventAssignments
          eventId={shiftsEventId}
          onClose={() => setShiftsEventId(null)}
        />
      )}

      {menuEventId !== null && (
        <EventMenuManager
          eventId={menuEventId}
          onClose={() => setMenuEventId(null)}
        />
      )}
    </div>
  );
}
