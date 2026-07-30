"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Music, Sparkles, Video } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { MyProficiency, ProficiencyLevel } from "@/types/admin";

const LEVEL_LABELS: Record<ProficiencyLevel, string> = {
  learning: "Learning",
  can_perform: "Can perform",
  lead: "Lead",
};

const LEVEL_STYLES: Record<ProficiencyLevel, string> = {
  learning: "bg-amber-100 text-amber-700",
  can_perform: "bg-emerald-100 text-emerald-700",
  lead: "bg-purple-100 text-purple-700",
};

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * A member's own proficiency list. Read-only — levels are set by an admin on the
 * Proficiency tab, so this is the "what am I expected to know" view.
 */
export default function MyRoutines() {
  const [routines, setRoutines] = useState<MyProficiency[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<MyProficiency[]>("/proficiency/me")
      .then(setRoutines)
      .catch((err) =>
        toast.error(
          err instanceof Error ? err.message : "Could not load your routines",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-rose-50 flex items-center gap-2">
        <div className="text-rose-500">
          <Sparkles className="w-4 h-4" />
        </div>
        <h2 className="font-semibold text-gray-700">Your Routines</h2>
        {!loading && routines.length > 0 && (
          <span className="ml-auto text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
            {routines.length}
          </span>
        )}
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <p className="text-sm text-gray-400">
            No routines assessed yet. Once someone records what you have learnt,
            it shows up here.
          </p>
        ) : (
          <ul className="divide-y divide-rose-50">
            {routines.map((routine) => {
              const duration = formatDuration(routine.duration_seconds);

              return (
                <li
                  key={routine.routine_id}
                  className="py-2.5 flex items-start gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">
                      {routine.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {duration && `${duration}`}
                      {routine.bpm !== null && `${duration ? " · " : ""}${routine.bpm} BPM`}
                      {routine.difficulty &&
                        `${duration || routine.bpm !== null ? " · " : ""}${routine.difficulty}`}
                    </p>

                    <div className="flex flex-wrap gap-3 mt-1 text-xs">
                      {routine.music_url && (
                        <a
                          href={routine.music_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Music className="w-3 h-3" />
                          Music
                        </a>
                      )}
                      {routine.video_url && (
                        <a
                          href={routine.video_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:underline inline-flex items-center gap-1"
                        >
                          <Video className="w-3 h-3" />
                          Reference
                        </a>
                      )}
                    </div>

                    {routine.notes && (
                      <p className="text-xs text-gray-400 mt-1">{routine.notes}</p>
                    )}
                  </div>

                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${LEVEL_STYLES[routine.level]}`}
                  >
                    {LEVEL_LABELS[routine.level]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
