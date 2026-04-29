/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authHeaders } from "@/lib/api";

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

/** Normalise a day entry coming from the DB into the new multi-slot shape.
 *  Old shape: { enabled, start, end }
 *  New shape: { enabled, slots: [{ start, end }] }
 */
function normaliseDay(raw: any): DayAvailability {
  if (!raw) return { enabled: false, slots: [] };

  // Already new shape
  if (Array.isArray(raw.slots)) {
    return { enabled: raw.enabled ?? false, slots: raw.slots };
  }

  // Legacy single-slot shape
  const slot: TimeSlot = { start: raw.start ?? "", end: raw.end ?? "" };
  return {
    enabled: raw.enabled ?? false,
    slots: raw.enabled ? [slot] : [],
  };
}

function normaliseAvailability(raw: any): AvailabilityMap {
  const out: AvailabilityMap = {};
  for (const day of days) {
    out[day] = normaliseDay(raw?.[day]);
  }
  return out;
}

/** Convert a "HH:MM" 24h string to "h:MMam/pm" */
function to12h(time: string): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function formatSlots(day: DayAvailability): string {
  if (!day.enabled || day.slots.length === 0) return "Unavailable";
  return day.slots
    .map((s) => `${to12h(s.start)} -> ${to12h(s.end)}`)
    .join(", ");
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
      <div className="max-w-lg mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );

  if (!user)
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center text-gray-500">
        You are not logged in.
      </div>
    );

  // ── Generic field update ───────────────────────────────────────────────────
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
        }
      );

      if (!res.ok) return;

      setUser({ ...user, [editingField]: newValue });
      setEditingField(null);
    } catch (err) {
      console.error(err);
    }
  }

  // ── Availability validation ────────────────────────────────────────────────

  /** Returns a map of day → error message for any invalid days, or {} if clean. */
  function validateAvailability(avail: AvailabilityMap): Record<string, string> {
    const errors: Record<string, string> = {};

    for (const day of days) {
      const d = avail[day];
      if (!d?.enabled || d.slots.length === 0) continue;

      // 1. Each slot must have both times filled
      for (const slot of d.slots) {
        if (!slot.start || !slot.end) {
          errors[day] = "Please fill in all start and end times.";
          break;
        }
      }

      if (errors[day]) continue;

      // 2. No two slots may overlap — sort by start, then check each adjacent pair
      const sorted = [...d.slots].sort((a, b) => a.start.localeCompare(b.start));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end > sorted[i + 1].start) {
          errors[day] = "There is an overlap in your times, please make sure to fix that.";
          break;
        }
      }
    }

    return errors;
  }

  // ── Availability helpers ───────────────────────────────────────────────────

  function setDay(day: string, patch: Partial<DayAvailability>) {
    setAvailabilityEdit((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
    // Clear any existing error for this day so feedback stays fresh
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
    const slots = current.slots.filter((_, i) => i !== index);
    setDay(day, { slots });
  }

  function updateSlot(
    day: string,
    index: number,
    field: keyof TimeSlot,
    value: string
  ) {
    const current = availabilityEdit[day];
    const slots = current.slots.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    setDay(day, { slots });
  }

  // ── Save availability ──────────────────────────────────────────────────────
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
        }
      );

      if (!res.ok) return;

      setUser({ ...user, availability: availabilityEdit });
      setIsEditingAvailability(false);
    } catch (err) {
      console.error(err);
    }
  }

  // ── Password ───────────────────────────────────────────────────────────────
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
        }
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

  // ── Derived availability (normalised) ─────────────────────────────────────
  const normalisedAvailability = normaliseAvailability(user.availability);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto px-4 py-10 space-y-6">

      {/* MAIN CARD */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">
            🎀 My Account
          </CardTitle>
        </CardHeader>

        <CardContent>
          <ul className="space-y-4">
            {[
              { label: "First Name", field: "first_name", value: user.first_name },
              { label: "Last Name", field: "last_name", value: user.last_name },
              { label: "Email", field: "email", value: user.email },
              { label: "Butler/Maid Name", field: "username", value: user.username },
            ].map(({ label, field, value }) => (
              <li
                key={field}
                className="flex items-center justify-between border-b border-rose-100 pb-3"
              >
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
                  <p className="text-gray-800 font-medium">{value}</p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-500 hover:bg-rose-50"
                  onClick={() => { setEditingField(field); setNewValue(value); }}
                >
                  Edit
                </Button>
              </li>
            ))}

            {/* PASSWORD */}
            <li className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Password</p>
                <p className="text-gray-800 font-medium">••••••••</p>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="border-rose-300 text-rose-500 hover:bg-rose-50"
                onClick={() => setChangingPassword(true)}
              >
                Edit
              </Button>
            </li>
          </ul>

          {/* PASSWORD FORM */}
          {changingPassword && (
            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-3">
              {passwordError && (
                <p className="text-red-500 text-sm">{passwordError}</p>
              )}

              <FieldGroup>
                <Field>
                  <FieldLabel>Current Password</FieldLabel>
                  <Input type="password" onChange={(e) => setCurrentPassword(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel>New Password</FieldLabel>
                  <Input type="password" onChange={(e) => setNewPassword(e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel>Confirm New Password</FieldLabel>
                  <Input type="password" onChange={(e) => setConfirmPassword(e.target.value)} />
                </Field>
              </FieldGroup>

              <div className="flex gap-2">
                <Button className="bg-rose-500 hover:bg-rose-600 text-white" type="submit">
                  Save Password
                </Button>
                <Button type="button" variant="outline" onClick={() => setChangingPassword(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* GENERIC FIELD EDIT */}
          {editingField && editingField !== "type" && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <FieldGroup>
                <Field>
                  <FieldLabel>Edit {editingField.replace("_", " ")}</FieldLabel>
                  <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                </Field>
              </FieldGroup>

              <div className="flex gap-2">
                <Button className="bg-rose-500 hover:bg-rose-600 text-white" type="submit">
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingField(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* ROLE CARD */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">🏷️ Role</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
              <p className="text-gray-800 font-medium">{user.type || "Not set"}</p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-500 hover:bg-rose-50"
              onClick={() => { setEditingField("type"); setNewValue(user.type || ""); }}
            >
              Edit
            </Button>
          </div>

          {editingField === "type" && (
            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <select
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                className="w-full border rounded px-2 py-2"
              >
                <option value="">None</option>
                <option value="maid">Maid</option>
                <option value="butler">Butler</option>
              </select>

              <div className="flex gap-2">
                <Button className="bg-rose-500 hover:bg-rose-600 text-white" type="submit">
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditingField(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      {/* AVAILABILITY CARD */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">📅 Availability</CardTitle>
        </CardHeader>

        <CardContent>

          {/* VIEW MODE */}
          {!isEditingAvailability && (
            <>
              <div className="space-y-2">
                {days.map((day) => {
                  const d = normalisedAvailability[day];

                  return (
                    <div key={day} className="border-b border-rose-100 pb-2">
                      <div className="flex justify-between items-start">
                        <span className="uppercase text-gray-600 w-12 pt-0.5">{day}</span>

                        {!d.enabled || d.slots.length === 0 ? (
                          <span className="text-gray-400 text-sm">Unavailable</span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {d.slots.map((s, i) => (
                              <span key={i} className="text-gray-800 font-medium text-sm">
                                {to12h(s.start)} → {to12h(s.end)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Button
                className="mt-4 bg-rose-500 hover:bg-rose-600 text-white"
                onClick={() => {
                  setAvailabilityEdit(normaliseAvailability(user.availability));
                  setIsEditingAvailability(true);
                }}
              >
                Edit Availability
              </Button>
            </>
          )}

          {/* EDIT MODE */}
          {isEditingAvailability && (
            <>
              <div className="space-y-4">
                {days.map((day) => {
                  const d = availabilityEdit[day] ?? { enabled: false, slots: [] };

                  return (
                    <div key={day} className={`border rounded-lg p-3 space-y-2 ${availabilityErrors[day] ? "border-red-300 bg-red-50/30" : "border-rose-100"}`}>

                      {/* Day header with enable toggle */}
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={d.enabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setDay(day, {
                              enabled,
                              // Add a blank slot when first enabling
                              slots: enabled && d.slots.length === 0
                                ? [{ start: "", end: "" }]
                                : d.slots,
                            });
                          }}
                          className="accent-rose-500"
                        />
                        <span className="uppercase font-semibold text-gray-700 w-10">{day}</span>

                        {d.enabled && (
                          <button
                            type="button"
                            onClick={() => addSlot(day)}
                            className="ml-auto text-xs text-rose-500 border border-rose-300 rounded px-2 py-0.5 hover:bg-rose-50"
                          >
                            + Add slot
                          </button>
                        )}
                      </div>

                      {/* Time slots */}
                      {d.enabled && (
                        <div className="space-y-1.5 pl-6">
                          {d.slots.length === 0 && (
                            <p className="text-xs text-gray-400">No slots — add one above.</p>
                          )}

                          {d.slots.map((slot, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}.</span>
                              <input
                                type="time"
                                value={slot.start}
                                onChange={(e) => updateSlot(day, i, "start", e.target.value)}
                                className="border rounded px-1 py-0.5 text-sm"
                              />
                              <span className="text-gray-400">→</span>
                              <input
                                type="time"
                                value={slot.end}
                                onChange={(e) => updateSlot(day, i, "end", e.target.value)}
                                className="border rounded px-1 py-0.5 text-sm"
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
                  className="bg-rose-500 hover:bg-rose-600 text-white"
                  onClick={handleAvailabilitySave}
                >
                  Save
                </Button>

                <Button variant="outline" onClick={() => setIsEditingAvailability(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}

        </CardContent>
      </Card>

    </div>
  );
}