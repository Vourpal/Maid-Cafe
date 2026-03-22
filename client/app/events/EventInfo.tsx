"use client";

import React, { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { authHeadersNoContent } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type InfoProps = {
  eventIdProp: number;
};

type Attendee = {
  first_name: string;
  last_name: string;
  status: string;
  role: string | null;
  seats_available: number | null;
};

type EventDetails = {
  title: string;
  driver_count: number;
  passenger_count: number;
  attendees: Attendee[];
};

function getStatusColor(status: string) {
  switch (status) {
    case "going":
      return "default";
    case "not going":
      return "destructive";
    case "maybe":
      return "secondary";
    default:
      return "secondary";
  }
}

export default function EventInfo({ eventIdProp }: InfoProps) {
  const { user } = useUserAuthentication();
  const [details, setDetails] = useState<EventDetails>();
  const [isOpen, setIsOpen] = useState(false);

  async function handleDetails() {
    if (!user) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/events/${eventIdProp}/admin_info`,
        {
          method: "GET",
          headers: authHeadersNoContent(),
        },
      );

      if (!res.ok) {
        toast.error("No details for this event yet!");
        return;
      }

      const data: { data: EventDetails } = await res.json();
      setDetails(data.data);
      setIsOpen(true);
    } catch (err) {
      console.error("Error finding info", err);
      toast.error("No details for this event yet!");
    }
  }

  const totalAttendees = details?.attendees.length ?? 0;

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="border-rose-300 text-rose-500 hover:bg-rose-50"
        onClick={handleDetails}
      >
        Event Details
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center"
          onClick={() => setIsOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-[500px] max-h-[80vh]"
          >
            <Card className="border-rose-200 shadow-lg">
              <CardHeader className="flex flex-row items-start justify-between">
                <CardTitle className="text-rose-500">
                  🎀 {details?.title} — Event Details
                </CardTitle>
                <button
                  className="text-gray-400 hover:text-gray-600 text-lg"
                  onClick={() => setIsOpen(false)}
                >
                  ✕
                </button>
              </CardHeader>

              <CardContent className="flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
                {/* Summary */}
                <div className="flex gap-3 flex-wrap text-sm text-muted-foreground bg-rose-50 rounded-lg px-4 py-3">
                  <span>👥 {totalAttendees} attendees</span>
                  <span>🚗 {details?.driver_count} drivers</span>
                  <span>🪑 {details?.passenger_count} seats offered</span>
                </div>

                {/* Attendee list */}
                <div className="flex flex-col gap-2">
                  {details?.attendees.map((attendee, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm border border-rose-100 rounded-md px-3 py-2 hover:bg-rose-50 transition"
                    >
                      <span className="font-medium text-gray-800">
                        {attendee.first_name} {attendee.last_name}
                      </span>
                      <div className="flex gap-2 items-center">
                        <Badge variant={getStatusColor(attendee.status)}>
                          {attendee.status}
                        </Badge>
                        {attendee.role && attendee.role !== "None" && (
                          <Badge
                            variant="outline"
                            className="border-rose-200 text-rose-500"
                          >
                            {attendee.role}
                          </Badge>
                        )}
                        {attendee.seats_available && (
                          <span className="text-muted-foreground text-xs">
                            🪑 {attendee.seats_available}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
