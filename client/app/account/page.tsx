/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authHeaders } from "@/lib/api";
import { User, Lock, CalendarDays, Pencil } from "lucide-react";

const days = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSlot {
  start: string;
  end: string;
}

interface DayAvailability {
  enabled: boolean;
  slots: TimeSlot[];
}

type AvailabilityMap = Record<string, DayAvailability>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normaliseDay(raw: any): DayAvailability {
  if (!raw) return { enabled: false, slots: [] };
  if (Array.isArray(raw.slots)) {
    return { enabled: raw.enabled ?? false, slots: raw.slots };
  }
  const slot: TimeSlot = { start: raw.start ?? "", end: raw.end ?? "" };
  return { enabled: raw.enabled ?? false, slots: raw.enabled ? [slot] : [] };
}

function normaliseAvailability(raw: any): AvailabilityMap {
  const out: AvailabilityMap = {};
  for (const day of days) {
    out[day] = normaliseDay(raw?.[day]);
  }
  return out;
}

function to12h(time: string): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// ─── Section wrapper ─────────────────────────────────────────────────────────

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-rose-50 flex items-center gap-2">
        <div className="text-rose-500">{icon}</div>
        <h2 className="font-semibold text-gray-700">{title}</h2>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Account() {
  const { user, loading, setUser } = useUserAuthentication();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [availabilityEdit, setAvailabilityEdit] = useState<AvailabilityMap>({});
  const [availabilityErrors, setAvailabilityErrors] = useState<Record<string, string>>({});

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (loading)
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );

  if (!user)
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center text-gray-500">
        <p className="text-3xl mb-3">🔒</p>
        You are not logged in.
      </div>
    );

  const initials = `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();

  // ── Generic field update ─────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingField || !user) return;
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ [editingField]: newValue }),
        },
      );
      if (!res.ok) return;
      setUser({ ...user, [editingField]: newValue });
      setEditingField(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ── Availability validation ──────────────────────────────────────────────

  function validateAvailability(avail: AvailabilityMap): Record<string, string> {
    const errors: Record<string, string> = {};
    for (const day of days) {
      const d = avail[day];
      if (!d?.enabled || d.slots.length === 0) continue;
      for (const slot of d.slots) {
        if (!slot.start || !slot.end) {
          errors[day] = "Please fill in all start and end times.";
          break;
        }
      }
      if (errors[day]) continue;
      const sorted = [...d.slots].sort((a, b) =>
        a.start.localeCompare(b.start),
      );
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end > sorted[i + 1].start) {
          errors[day] =
            "There is an overlap in your times, please fix that.";
          break;
        }
      }
    }
    return errors;
  }

  function setDay(day: string, patch: Partial<DayAvailability>) {
    setAvailabilityEdit((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
    setAvailabilityErrors((prev) => {
      const next = { ...prev };
      delete next[day];
      return next;
    });
  }

  function addSlot(day: string) {
    const current = availabilityEdit[day];
    setDay(day, { slots: [...current.slots, { start: "", end: "" }] });
  }

  function removeSlot(day: string, index: number) {
    const current = availabilityEdit[day];
    setDay(day, { slots: current.slots.filter((_, i) => i !== index) });
  }

  function updateSlot(
    day: string,
    index: number,
    field: keyof TimeSlot,
    value: string,
  ) {
    const current = availabilityEdit[day];
    setDay(day, {
      slots: current.slots.map((s, i) =>
        i === index ? { ...s, [field]: value } : s,
      ),
    });
  }

  async function handleAvailabilitySave() {
    if (!user) return;
    const errors = validateAvailability(availabilityEdit);
    if (Object.keys(errors).length > 0) {
      setAvailabilityErrors(errors);
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ availability: availabilityEdit }),
        },
      );
      if (!res.ok) return;
      setUser({ ...user, availability: availabilityEdit });
      setIsEditingAvailability(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError("All fields are required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({
            current_password: currentPassword,
            password: newPassword,
          }),
        },
      );
      if (!res.ok) {
        setPasswordError("Incorrect current password or server error.");
        return;
      }
      setChangingPassword(false);
      setPasswordError("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error(err);
    }
  }

  const normalisedAvailability = normaliseAvailability(user.availability);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto space-y-5">

      {/* Profile header */}
      <div className="bg-gradient-to-br from-rose-400 to-rose-600 rounded-2xl p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 text-white font-bold text-xl flex items-center justify-center border-2 border-white/40">
            {initials}
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {user.first_name} {user.last_name}
            </h1>
            <p className="text-rose-100 text-sm">@{user.username}</p>
            <div className="flex items-center gap-2 mt-1.5">
              {user.type && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full capitalize font-medium">
                  {user.type}
                </span>
              )}
              {user.admin && (
                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">
                  Admin
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Profile info */}
      <Section icon={<User className="w-4 h-4" />} title="Profile Information">
        <ul className="space-y-0 divide-y divide-rose-50">
          {[
            { label: "First Name", field: "first_name", value: user.first_name },
            { label: "Last Name", field: "last_name", value: user.last_name },
            { label: "Email", field: "email", value: user.email },
            { label: "Butler/Maid Name", field: "username", value: user.username },
          ].map(({ label, field, value }) => (
            <li key={field} className="py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                <p className="text-gray-800 font-medium text-sm mt-0.5">{value}</p>
              </div>
              <button
                onClick={() => { setEditingField(field); setNewValue(value); }}
                className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}

          {/* Role */}
          <li className="py-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
              <p className="text-gray-800 font-medium text-sm mt-0.5 capitalize">
                {user.type || "Not set"}
              </p>
            </div>
            <button
              onClick={() => { setEditingField("type"); setNewValue(user.type || ""); }}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </li>
        </ul>

        {/* Inline edit form */}
        {editingField && editingField !== "type" && (
          <form onSubmit={handleSubmit} className="mt-4 p-4 bg-rose-50 rounded-xl space-y-3">
            <FieldGroup>
              <Field>
                <FieldLabel>
                  Edit {editingField.replace("_", " ")}
                </FieldLabel>
                <Input
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  className="border-rose-200 focus:ring-rose-300"
                />
              </Field>
            </FieldGroup>
            <div className="flex gap-2">
              <Button className="bg-rose-500 hover:bg-rose-600 text-white h-8 text-sm" type="submit">
                Save
              </Button>
              <Button type="button" variant="outline" className="h-8 text-sm" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}

        {editingField === "type" && (
          <form onSubmit={handleSubmit} className="mt-4 p-4 bg-rose-50 rounded-xl space-y-3">
            <label className="text-xs font-medium text-gray-600 uppercase tracking-wide block mb-1">
              Type
            </label>
            <select
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300"
            >
              <option value="">None</option>
              <option value="maid">Maid</option>
              <option value="butler">Butler</option>
            </select>
            <div className="flex gap-2">
              <Button className="bg-rose-500 hover:bg-rose-600 text-white h-8 text-sm" type="submit">
                Save
              </Button>
              <Button type="button" variant="outline" className="h-8 text-sm" onClick={() => setEditingField(null)}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Section>

      {/* Password */}
      <Section icon={<Lock className="w-4 h-4" />} title="Password">
        {!changingPassword ? (
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm">••••••••</p>
            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-500 hover:bg-rose-50 h-8 text-sm"
              onClick={() => setChangingPassword(true)}
            >
              Change Password
            </Button>
          </div>
        ) : (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            {passwordError && (
              <p className="text-red-500 text-sm">{passwordError}</p>
            )}
            <FieldGroup>
              <Field>
                <FieldLabel>Current Password</FieldLabel>
                <Input
                  type="password"
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="border-rose-200"
                />
              </Field>
              <Field>
                <FieldLabel>New Password</FieldLabel>
                <Input
                  type="password"
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="border-rose-200"
                />
              </Field>
              <Field>
                <FieldLabel>Confirm New Password</FieldLabel>
                <Input
                  type="password"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="border-rose-200"
                />
              </Field>
            </FieldGroup>
            <div className="flex gap-2">
              <Button className="bg-rose-500 hover:bg-rose-600 text-white h-8 text-sm" type="submit">
                Save Password
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-8 text-sm"
                onClick={() => { setChangingPassword(false); setPasswordError(""); }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Section>

      {/* Availability */}
      <Section icon={<CalendarDays className="w-4 h-4" />} title="Availability">
        {!isEditingAvailability ? (
          <>
            <div className="space-y-1.5">
              {days.map((day) => {
                const d = normalisedAvailability[day];
                return (
                  <div key={day} className="flex items-start justify-between py-1.5 border-b border-rose-50 last:border-0">
                    <span className="uppercase text-xs font-semibold text-gray-500 w-10 pt-0.5">
                      {day}
                    </span>
                    {!d.enabled || d.slots.length === 0 ? (
                      <span className="text-gray-300 text-sm">Unavailable</span>
                    ) : (
                      <div className="flex flex-col items-end gap-0.5">
                        {d.slots.map((s, i) => (
                          <span key={i} className="text-gray-700 text-sm font-medium">
                            {to12h(s.start)} → {to12h(s.end)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <Button
              className="mt-4 bg-rose-500 hover:bg-rose-600 text-white h-8 text-sm"
              onClick={() => {
                setAvailabilityEdit(normaliseAvailability(user.availability));
                setIsEditingAvailability(true);
              }}
            >
              Edit Availability
            </Button>
          </>
        ) : (
          <>
            <div className="space-y-3">
              {days.map((day) => {
                const d = availabilityEdit[day] ?? { enabled: false, slots: [] };
                return (
                  <div
                    key={day}
                    className={`border rounded-xl p-3 space-y-2 ${
                      availabilityErrors[day]
                        ? "border-red-300 bg-red-50/30"
                        : "border-rose-100"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) => {
                          const enabled = e.target.checked;
                          setDay(day, {
                            enabled,
                            slots:
                              enabled && d.slots.length === 0
                                ? [{ start: "", end: "" }]
                                : d.slots,
                          });
                        }}
                        className="accent-rose-500 w-4 h-4"
                      />
                      <span className="uppercase font-semibold text-gray-700 text-xs w-10">
                        {day}
                      </span>
                      {d.enabled && (
                        <button
                          type="button"
                          onClick={() => addSlot(day)}
                          className="ml-auto text-xs text-rose-500 border border-rose-300 rounded-lg px-2 py-0.5 hover:bg-rose-50"
                        >
                          + Add slot
                        </button>
                      )}
                    </div>

                    {d.enabled && (
                      <div className="space-y-1.5 pl-6">
                        {d.slots.length === 0 && (
                          <p className="text-xs text-gray-400">
                            No slots — add one above.
                          </p>
                        )}
                        {d.slots.map((slot, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-4 shrink-0">
                              {i + 1}.
                            </span>
                            <input
                              type="time"
                              value={slot.start}
                              onChange={(e) =>
                                updateSlot(day, i, "start", e.target.value)
                              }
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                            />
                            <span className="text-gray-400">→</span>
                            <input
                              type="time"
                              value={slot.end}
                              onChange={(e) =>
                                updateSlot(day, i, "end", e.target.value)
                              }
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                            />
                            {d.slots.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeSlot(day, i)}
                                className="text-xs text-red-400 hover:text-red-600 ml-1"
                                aria-label="Remove slot"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                        {availabilityErrors[day] && (
                          <p className="text-xs text-red-500 mt-1">
                            ⚠ {availabilityErrors[day]}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2 mt-4">
              <Button
                className="bg-rose-500 hover:bg-rose-600 text-white h-8 text-sm"
                onClick={handleAvailabilitySave}
              >
                Save
              </Button>
              <Button
                variant="outline"
                className="h-8 text-sm"
                onClick={() => setIsEditingAvailability(false)}
              >
                Cancel
              </Button>
            </div>
          </>
        )}
      </Section>
    </div>
  );
}
