"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { authHeaders } from "@/lib/api";

export default function Account() {
  const { user, loading, setUser } = useUserAuthentication();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`, {
        method: "PATCH",
        // credentials: "include",
        headers:authHeaders(),
        body: JSON.stringify({
          current_password: currentPassword,
          password: newPassword,
        }),
      });

      if (!res.ok) {
        setPasswordError("Incorrect current password or server error.");
        return;
      }

      setChangingPassword(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError("");
    } catch (error) {
      console.error("Error updating password:", error);
      setPasswordError("Something went wrong.");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingField || !user) return;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users/${user.id}`, {
        method: "PATCH",
        // credentials: "include",
        headers: authHeaders(),
        body: JSON.stringify({ [editingField]: newValue }),
      });

      if (!res.ok) {
        console.error("Failed to update user");
        return;
      }

      setUser({ ...user, [editingField]: newValue });
      setEditingField(null);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">🎀 My Account</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-4">
            {[
              { label: "First Name", field: "first_name", value: user.first_name },
              { label: "Last Name", field: "last_name", value: user.last_name },
              { label: "Email", field: "email", value: user.email },
              { label: "Username", field: "username", value: user.username },
            ].map(({ label, field, value }) => (
              <li key={field} className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
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
              {passwordError && <p className="text-red-500 text-sm">{passwordError}</p>}
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
                <Button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white">
                  Save Password
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setChangingPassword(false); setPasswordError(""); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}

          {/* FIELD EDIT FORM */}
          {editingField && (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <FieldGroup>
                <Field>
                  <FieldLabel>Edit {editingField.replace("_", " ")}</FieldLabel>
                  <Input value={newValue} onChange={(e) => setNewValue(e.target.value)} />
                </Field>
              </FieldGroup>
              <div className="flex gap-2">
                <Button type="submit" className="bg-rose-500 hover:bg-rose-600 text-white">
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
    </div>
  );
}