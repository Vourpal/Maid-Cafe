"use client";

import { useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";

export default function Account() {
  const { user, loading, setUser } = useUserAuthentication();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");

  const [changingPassword, setChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");

  if (loading) return null;
  if (!user) return <div>You are not logged in.</div>;

  // -----------------------------
  // PASSWORD SUBMIT HANDLER
  // -----------------------------
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
        `http://localhost:5000/users/${user.id}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
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

      // Reset UI
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

  // -----------------------------
  // FIELD UPDATE HANDLER
  // -----------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingField) return;

    if (!user) return;

    try {
      const res = await fetch(`http://localhost:5000/users/${user.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [editingField]: newValue,
        }),
      });

      if (!res.ok) {
        console.error("Failed to update user");
        return;
      }

      // Update UI instantly
      setUser({
        ...user,
        [editingField]: newValue,
      });

      setEditingField(null);
    } catch (error) {
      console.error("Error updating user:", error);
    }
  }

  return (
    <div>
      <h1>Account information</h1>

      <div>
        <ul className="space-y-4">
          {/* FIRST NAME */}
          <li>
            First Name: {user.first_name}
            <button
              className="ml-2 px-4 py-2 bg-red-600 text-white rounded"
              onClick={() => {
                setEditingField("first_name");
                setNewValue(user.first_name);
              }}
            >
              Edit
            </button>
          </li>

          {/* LAST NAME */}
          <li>
            Last Name: {user.last_name}
            <button
              className="ml-2 px-4 py-2 bg-red-600 text-white rounded"
              onClick={() => {
                setEditingField("last_name");
                setNewValue(user.last_name);
              }}
            >
              Edit
            </button>
          </li>

          {/* EMAIL */}
          <li>
            Email: {user.email}
            <button
              className="ml-2 px-4 py-2 bg-red-600 text-white rounded"
              onClick={() => {
                setEditingField("email");
                setNewValue(user.email);
              }}
            >
              Edit
            </button>
          </li>

          {/* USERNAME */}
          <li>
            Username: {user.username}
            <button
              className="ml-2 px-4 py-2 bg-red-600 text-white rounded"
              onClick={() => {
                setEditingField("username");
                setNewValue(user.username);
              }}
            >
              Edit
            </button>
          </li>

          {/* PASSWORD */}
          <li>
            Password
            <button
              className="ml-2 px-4 py-2 bg-red-600 text-white rounded"
              onClick={() => setChangingPassword(true)}
            >
              Edit
            </button>
          </li>
        </ul>
      </div>

      {/* PASSWORD FORM */}
      {changingPassword && (
        <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-3">
          <h2 className="font-semibold">Change Password</h2>

          {passwordError && <div className="text-red-600">{passwordError}</div>}

          <input
            type="password"
            placeholder="Current password"
            className="border p-2 rounded w-full"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="New password"
            className="border p-2 rounded w-full"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />

          <input
            type="password"
            placeholder="Confirm new password"
            className="border p-2 rounded w-full"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <div>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Save Password
            </button>

            <button
              type="button"
              className="ml-2 px-4 py-2 bg-gray-500 text-white rounded"
              onClick={() => {
                setChangingPassword(false);
                setPasswordError("");
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* FIELD EDIT FORM */}
      {editingField && (
        <form onSubmit={handleSubmit} className="mt-6">
          <label className="block mb-2 capitalize">
            Edit {editingField.replace("_", " ")}
          </label>

          <input
            className="border p-2 rounded w-full"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
          />

          <div className="mt-3">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded"
            >
              Save
            </button>

            <button
              type="button"
              className="ml-2 px-4 py-2 bg-gray-500 text-white rounded"
              onClick={() => setEditingField(null)}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
