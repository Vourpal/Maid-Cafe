"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, ShieldCheck, UserX } from "lucide-react";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import type { StaffMember, StaffType } from "@/types/admin";
import { Field, inputClass } from "./shared";

type Props = {
  member: StaffMember;
  /** The signed-in admin, so self-targeted destructive controls can be hidden. */
  currentUserId: number;
  onClose: () => void;
  onSaved: (updates: Partial<StaffMember>) => void;
  onDeleted: (id: number) => void;
};

export default function EditStaffModal({
  member,
  currentUserId,
  onClose,
  onSaved,
  onDeleted,
}: Props) {
  const isSelf = member.id === currentUserId;

  const [firstName, setFirstName] = useState(member.first_name);
  const [lastName, setLastName] = useState(member.last_name);
  const [email, setEmail] = useState(member.email);
  const [username, setUsername] = useState(member.username);
  const [type, setType] = useState<StaffType>(member.type);
  const [isAdmin, setIsAdmin] = useState(member.admin);
  const [isActive, setIsActive] = useState(member.active);

  const [newPassword, setNewPassword] = useState("");
  const [showPasswordReset, setShowPasswordReset] = useState(false);

  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** Only send what actually changed, so the audit diff stays meaningful. */
  function buildPayload() {
    const payload: Record<string, unknown> = {};
    if (firstName !== member.first_name) payload.first_name = firstName.trim();
    if (lastName !== member.last_name) payload.last_name = lastName.trim();
    if (email !== member.email) payload.email = email.trim();
    if (username !== member.username) payload.username = username.trim();
    if (type !== member.type) payload.type = type;
    if (isAdmin !== member.admin) payload.admin = isAdmin;
    if (isActive !== member.active) payload.active = isActive;
    return payload;
  }

  async function handleSave() {
    const payload = buildPayload();

    if (Object.keys(payload).length === 0) {
      toast.info("Nothing changed");
      return;
    }

    if (!firstName.trim() || !lastName.trim() || !email.trim() || !username.trim()) {
      toast.error("Name, email and username cannot be empty");
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/users/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success(`Updated ${firstName} ${lastName}`);
      onSaved(payload as Partial<StaffMember>);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      // An admin resetting someone else's password does not supply the old one;
      // the reset is recorded in the audit log instead.
      await apiFetch(`/users/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword }),
      });
      toast.success("Password reset. Share the new one with them directly.");
      setNewPassword("");
      setShowPasswordReset(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await apiFetch(`/users/${member.id}`, { method: "DELETE" });
      toast.success(`Removed ${member.first_name} ${member.last_name}`);
      onDeleted(member.id);
      onClose();
    } catch (err) {
      // Members with event or practice history cannot be hard-deleted; the API
      // says so and suggests deactivating instead.
      toast.error(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${member.first_name} ${member.last_name}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="First name">
            <input
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </Field>
          <Field label="Last name">
            <input
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Email">
          <input
            type="email"
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        <Field label="Username">
          <input
            className={inputClass}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </Field>

        <Field label="Role">
          <select
            className={inputClass}
            value={type ?? ""}
            onChange={(e) => setType((e.target.value || null) as StaffType)}
          >
            <option value="">Not set</option>
            <option value="maid">Maid</option>
            <option value="butler">Butler</option>
          </select>
        </Field>

        {/* ── Permissions ──────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdmin}
              disabled={isSelf}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="accent-rose-500 mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                Administrator
              </span>
              <span className="text-xs text-gray-400">
                {isSelf
                  ? "You cannot change your own admin access."
                  : "Can manage staff, events, practices and tasks."}
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              disabled={isSelf}
              onChange={(e) => setIsActive(e.target.checked)}
              className="accent-rose-500 mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium text-gray-800">Active</span>
              <span className="text-xs text-gray-400 block">
                {isSelf
                  ? "You cannot deactivate your own account."
                  : "Marks whether this member is currently on the roster. Note: login is not yet blocked for inactive accounts."}
              </span>
            </span>
          </label>
        </div>

        {/* ── Password reset ───────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4">
          {!showPasswordReset ? (
            <button
              onClick={() => setShowPasswordReset(true)}
              className="inline-flex items-center gap-1.5 text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Reset password
            </button>
          ) : (
            <div className="space-y-2">
              <Field label="New password">
                <input
                  type="password"
                  className={inputClass}
                  value={newPassword}
                  placeholder="At least 8 characters"
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  onClick={handlePasswordReset}
                  disabled={saving}
                  className="text-xs bg-gray-800 text-white px-3 py-1.5 rounded-lg hover:bg-gray-900 disabled:opacity-60 transition"
                >
                  Set password
                </button>
                <button
                  onClick={() => {
                    setShowPasswordReset(false);
                    setNewPassword("");
                  }}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Save / remove ────────────────────────────────────────────── */}
        <div className="border-t border-gray-100 pt-4 flex items-center justify-between gap-3">
          {!isSelf ? (
            confirmingDelete ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={saving}
                  className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                >
                  Confirm remove
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-xs text-gray-500 px-2 py-1.5 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="inline-flex items-center gap-1.5 text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
              >
                <UserX className="w-3.5 h-3.5" />
                Remove
              </button>
            )
          ) : (
            <span />
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
