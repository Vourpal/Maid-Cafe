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

export default function Account() {
  const { user, loading, setUser } = useUserAuthentication();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [availabilityEdit, setAvailabilityEdit] = useState<any>({});

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

  // =========================
  // GENERIC FIELD UPDATE
  // =========================
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingField || !user) return;

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`,
        {
          method: "PATCH",
          headers: authHeaders(),
          body: JSON.stringify({ [editingField]: newValue }),//bracket needed to show correct key
        }
      );

      if (!res.ok) return;

      setUser({ ...user, [editingField]: newValue }); //makes it so that you don't need to recall api to update stuff
      setEditingField(null);
    } catch (err) {
      console.error(err);
    }
  }

  // =========================
  // SAVE AVAILABILITY
  // =========================
  async function handleAvailabilitySave() {
    if (!user) return;

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

  // =========================
  // PASSWORD
  // =========================
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

  // =========================
  // RENDER
  // =========================
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
              { label: "Username", field: "username", value: user.username },
            ].map(({ label, field, value }) => (
              <li
                key={field}
                className="flex items-center justify-between border-b border-rose-100 pb-3"
              >
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    {label}
                  </p>
                  <p className="text-gray-800 font-medium">{value}</p>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="border-rose-300 text-rose-500 hover:bg-rose-50"
                  onClick={() => {
                    setEditingField(field);
                    setNewValue(value);
                  }}
                >
                  Edit
                </Button>
              </li>
            ))}

            {/* PASSWORD */}
            <li className="flex items-center justify-between border-b border-rose-100 pb-3">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Password
                </p>
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setChangingPassword(false)}
                >
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
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                  />
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
          <CardTitle className="text-rose-500 text-2xl">
            🏷️ Role
          </CardTitle>
        </CardHeader>

        <CardContent>
          <div className="flex items-center justify-between border-b border-rose-100 pb-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Type</p>
              <p className="text-gray-800 font-medium">
                {user.type || "Not set"}
              </p>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="border-rose-300 text-rose-500 hover:bg-rose-50"
              onClick={() => {
                setEditingField("type");
                setNewValue(user.type || "");
              }}
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
          <CardTitle className="text-rose-500 text-2xl">
            📅 Availability
          </CardTitle>
        </CardHeader>

        <CardContent>

          {/* VIEW MODE */}
          {!isEditingAvailability && (
            <>
              <div className="space-y-2">
                {days.map((day) => {
                  const d = user.availability?.[day];

                  return (
                    <div key={day} className="flex justify-between border-b border-rose-100 pb-2">
                      <span className="uppercase text-gray-600 w-12">{day}</span>
                      <span className="text-gray-800 font-medium">
                        {d?.enabled
                          ? `${d.start || "--"} → ${d.end || "--"}`
                          : "Unavailable"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* ✅ FIXED: initialize edit state HERE */}
              <Button
                className="mt-4 bg-rose-500 hover:bg-rose-600 text-white"
                onClick={() => {
                  setAvailabilityEdit(structuredClone(user.availability || {}));
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
              <div className="space-y-3">
                {days.map((day) => {
                  const d = availabilityEdit?.[day] || { enabled: false };

                  return (
                    <div key={day} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={d.enabled}
                        onChange={(e) =>
                          setAvailabilityEdit({
                            ...availabilityEdit,
                            [day]: { ...d, enabled: e.target.checked },
                          })
                        }
                      />

                      <span className="w-12 uppercase">{day}</span>

                      {d.enabled && (
                        <>
                          <input
                            type="time"
                            value={d.start || ""}
                            onChange={(e) =>
                              setAvailabilityEdit({
                                ...availabilityEdit,
                                [day]: { ...d, start: e.target.value },
                              })
                            }
                            className="border rounded px-1"
                          />
                          <span>→</span>
                          <input
                            type="time"
                            value={d.end || ""}
                            onChange={(e) =>
                              setAvailabilityEdit({
                                ...availabilityEdit,
                                [day]: { ...d, end: e.target.value },
                              })
                            }
                            className="border rounded px-1"
                          />
                        </>
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

                <Button
                  variant="outline"
                  onClick={() => setIsEditingAvailability(false)}
                >
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