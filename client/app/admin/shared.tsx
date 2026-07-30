"use client";

import { Download } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import { downloadCsv } from "@/lib/api";
import type { DayAvailability, StaffType, TimeSlot } from "@/types/admin";

export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ─── Formatting ───────────────────────────────────────────────────────────────

export function getInitials(first: string, last: string) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
}

export function to12h(time: string): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "3 days ago" / "in 2 hours" — for audit entries and due dates. */
export function relativeTime(value: string | null | undefined) {
  if (!value) return "—";
  const diffMs = new Date(value).getTime() - Date.now();
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000000],
    ["month", 2592000000],
    ["day", 86400000],
    ["hour", 3600000],
    ["minute", 60000],
  ];

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, ms] of units) {
    if (Math.abs(diffMs) >= ms) {
      return formatter.format(Math.round(diffMs / ms), unit);
    }
  }
  return "just now";
}

export function percent(value: number | null | undefined) {
  return value === null || value === undefined ? "—" : `${value}%`;
}

/**
 * Availability is stored as free-form JSONB and has had two shapes over time
 * (a single start/end pair, and a slots array). Normalise both.
 */
export function normaliseDay(raw: unknown): DayAvailability {
  if (!raw || typeof raw !== "object") return { enabled: false, slots: [] };

  const day = raw as { enabled?: boolean; slots?: TimeSlot[]; start?: string; end?: string };

  if (Array.isArray(day.slots)) {
    return { enabled: day.enabled ?? false, slots: day.slots };
  }

  const slot: TimeSlot = { start: day.start ?? "", end: day.end ?? "" };
  return { enabled: day.enabled ?? false, slots: day.enabled ? [slot] : [] };
}

// ─── Building blocks ──────────────────────────────────────────────────────────

export function StatCard({
  label,
  value,
  hint,
  tone = "rose",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "rose" | "purple" | "amber" | "emerald" | "gray";
}) {
  const tones: Record<string, string> = {
    rose: "border-rose-100 text-rose-600",
    purple: "border-purple-100 text-purple-600",
    amber: "border-amber-100 text-amber-600",
    emerald: "border-emerald-100 text-emerald-600",
    gray: "border-gray-200 text-gray-600",
  };

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {label}
      </p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

export function SectionCard({
  title,
  children,
  action,
  count,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-rose-50 flex items-center justify-between gap-3">
        <h2 className="font-semibold text-gray-700 flex items-center gap-2">
          {title}
          {count !== undefined && (
            <span className="text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-normal">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-gray-400 text-sm">{message}</div>;
}

export function TypeBadge({ type }: { type: StaffType }) {
  return (
    <span
      className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
        type === "maid"
          ? "bg-rose-100 text-rose-600"
          : type === "butler"
            ? "bg-stone-100 text-stone-600"
            : "bg-gray-100 text-gray-400"
      }`}
    >
      {type ?? "—"}
    </span>
  );
}

/** Colour-codes a rate so outliers are visible at a glance. */
export function RateBadge({ rate }: { rate: number | null }) {
  if (rate === null) {
    return <span className="text-xs text-gray-400">No records</span>;
  }

  const tone =
    rate >= 85
      ? "bg-emerald-100 text-emerald-700"
      : rate >= 60
        ? "bg-amber-100 text-amber-700"
        : "bg-red-100 text-red-700";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tone}`}>
      {rate}%
    </span>
  );
}

/** CSV download button that manages its own pending state. */
export function ExportButton({
  path,
  filename,
  label = "Export CSV",
}: {
  path: string;
  filename: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      await downloadCsv(path, filename);
      toast.success("Export downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition text-gray-600"
    >
      <Download className="w-3.5 h-3.5" />
      {busy ? "Preparing..." : label}
    </button>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

export const inputClass =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";
