"use client";

import { Button } from "@/components/ui/button";
import { PracticeSessions } from "@/types/event";
import AddAttendance from "./AddAttendance";
import EditAttendance from "./EditAttendance";

type Props = {
  event: {
    title: string;
    start: Date;
    end: Date;
    resource: PracticeSessions;
  } | null;
  onClose: () => void;
};

export default function ViewPractice({ event, onClose }: Props) {
  if (!event) return null;

  const session = event.resource;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="bg-white p-6 rounded-xl max-w-md w-full pointer-events-auto shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-rose-500 font-semibold text-lg">
              🎀 {session.title}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="flex flex-col gap-3 text-sm">
            <p><strong>📍 Location:</strong> {session.location || "N/A"}</p>
            <p>
              <strong>📅 Date:</strong>{" "}
              {new Date(session.date).toLocaleString()}
            </p>
            <p><strong>📝 Notes:</strong> {session.notes || "None"}</p>
          </div>

          <div className="mt-4">
            <AddAttendance practiceId={event.resource.id} />
            <EditAttendance practiceId={event.resource.id}/>
          </div>
        </div>
      </div>
    </>
  );
}