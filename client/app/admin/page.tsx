"use client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

interface StaffMember {
  id: number;
  first_name: string;
  last_name: string;
  type: string | null;
  username: string;
  availability: Record<string, any>;
}

interface Invite {
  id: number;
  code: string;
  created_by: number | null;
  max_uses: number;
  uses: number;
  expires_at: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a raw DB day entry into the multi-slot shape. */
function normaliseDay(raw: any): DayAvailability {
  if (!raw) return { enabled: false, slots: [] };

  if (Array.isArray(raw.slots)) {
    return { enabled: raw.enabled ?? false, slots: raw.slots };
  }

  // Legacy single-slot shape from DB
  const slot: TimeSlot = { start: raw.start ?? "", end: raw.end ?? "" };
  return {
    enabled: raw.enabled ?? false,
    slots: raw.enabled ? [slot] : [],
  };
}

/** Convert a "HH:MM" 24h string to "h:MMam/pm" */
function to12h(time: string): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading } = useUserAuthentication();

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  useEffect(() => {
    if (!user || !user.admin) {
      setStaffLoading(false);
      return;
    }

    async function fetchStaff() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: authHeaders(),
        });

        if (!res.ok) return;

        const json = await res.json();
        const users: StaffMember[] = Array.isArray(json) ? json : json.data;
        setStaff(users);
      } catch (err) {
        console.error(err);
      } finally {
        setStaffLoading(false);
      }
    }

    fetchStaff();
  }, [user]);

  useEffect(() => {
    if (!user?.admin) return;

    async function fetchInvites() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invites`, {
          headers: authHeaders(),
        });

        if (!res.ok) return;

        const json = await res.json();
        setInvites(json.data || json);
      } catch (err) {
        console.error(err);
      } finally {
        setInvitesLoading(false);
      }
    }

    fetchInvites();
  }, [user]);

  async function handleGenerateInvite() {
    setInviteLoading(true);
    setGeneratedCode(null);

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invites`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ max_uses: maxUses, expires_at: expiresAt || null }),
      });

      const json = await res.json();

      if (!res.ok) {
        toast.error("Failed to generate invite code");
        return;
      }

      const invite = json.data;
      setGeneratedCode(invite.code);
      await navigator.clipboard.writeText(invite.code);
      toast.success("Invite code copied to clipboard!");
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/invites/${id}`,
        { method: "DELETE", headers: authHeaders() }
      );

      if (!res.ok) throw new Error();

      toast.success("Invite revoked");
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch {
      toast.error("Failed to revoke invite");
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard!");
  }

  // ── Auth guards ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!user || !user.admin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center text-gray-500">
        You do not have access to this page.
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-6">

      {/* HEADER */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">🛡️ Admin Panel</CardTitle>
        </CardHeader>
      </Card>

      {/* INVITE GENERATOR */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">🎟️ Invite Codes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 uppercase">Max Uses</label>
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(Number(e.target.value))}
                className="w-full mt-1 border rounded-md px-2 py-1 text-sm"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase">Expiration (optional)</label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full mt-1 border rounded-md px-2 py-1 text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateInvite}
            disabled={inviteLoading}
            className="w-full bg-rose-500 hover:bg-rose-600 text-white text-sm font-medium py-2 rounded-md transition"
          >
            {inviteLoading ? "Generating..." : "Generate Invite Code"}
          </button>

          {generatedCode && (
            <div className="bg-rose-50 border border-rose-200 rounded-md p-3 text-center space-y-2">
              <p className="text-xs text-gray-400 uppercase">Generated Code</p>
              <p className="text-lg font-semibold text-rose-600 tracking-widest">{generatedCode}</p>
              <button
                onClick={() => handleCopy(generatedCode)}
                className="text-xs bg-white border border-rose-200 px-3 py-1 rounded-md hover:bg-rose-100 transition"
              >
                Copy Code
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ACTIVE INVITES */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">📋 Active Invite Codes</CardTitle>
        </CardHeader>

        <CardContent>
          {invitesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : invites.length === 0 ? (
            <p className="text-sm text-gray-400">No invites found.</p>
          ) : (
            <div className="space-y-3">
              {invites.map((invite) => {
                const isExpired = invite.expires_at && new Date(invite.expires_at) < new Date();
                const isUsedUp = invite.uses >= invite.max_uses;

                return (
                  <div
                    key={invite.id}
                    className="border border-rose-100 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <p className="font-mono text-rose-600 font-semibold tracking-widest">
                        {invite.code}
                      </p>
                      <p className="text-xs text-gray-400">
                        {invite.uses} / {invite.max_uses} uses
                        {invite.expires_at && (
                          <> · Expires {new Date(invite.expires_at).toLocaleDateString()}</>
                        )}
                      </p>
                      <div className="flex gap-2 text-xs">
                        {isExpired && <span className="text-red-500">Expired</span>}
                        {isUsedUp && <span className="text-gray-500">Used up</span>}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(invite.code)}
                        className="text-xs bg-white border border-rose-200 px-3 py-1 rounded-md hover:bg-rose-100 transition"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        className="text-xs bg-red-50 border border-red-200 px-3 py-1 rounded-md hover:bg-red-100 transition"
                      >
                        Revoke
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* STAFF */}
      <Card className="border-rose-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-rose-500 text-2xl">👥 Staff Members</CardTitle>
        </CardHeader>

        <CardContent>
          {staffLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : staff.length === 0 ? (
            <p className="text-gray-400 text-sm">No staff members found.</p>
          ) : (
            <div className="space-y-4">
              {staff.map((member) => (
                <div
                  key={member.id}
                  className="border border-rose-100 rounded-lg p-4 space-y-3"
                >
                  {/* Name + Role badge */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-800 font-semibold text-lg">
                        {member.first_name} {member.last_name}
                      </p>
                      <p className="text-xs text-gray-400 uppercase tracking-wide mt-0.5">
                        {member.username ?? "Unknown"}
                      </p>
                    </div>

                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize
                        ${
                          member.type === "maid"
                            ? "bg-rose-100 text-rose-600"
                            : member.type === "butler"
                              ? "bg-stone-100 text-stone-600"
                              : "bg-gray-100 text-gray-500"
                        }`}
                    >
                      {member.type ?? "—"}
                    </span>
                  </div>

                  {/* Availability — multi-slot aware */}
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">
                      Availability
                    </p>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-1">
                      {days.map((day) => {
                        const d = normaliseDay(member.availability?.[day]);
                        const enabled = d.enabled && d.slots.length > 0;

                        return (
                          <div
                            key={day}
                            className={`rounded-md px-2 py-1.5 text-center text-xs
                              ${enabled
                                ? "bg-rose-50 border border-rose-200 text-rose-700"
                                : "bg-gray-50 border border-gray-100 text-gray-400"
                              }`}
                          >
                            <p className="font-semibold uppercase">{day}</p>
                            {enabled ? (
                              <div className="mt-0.5 leading-tight space-y-1">
                                {d.slots.map((slot, i) => (
                                  <p key={i}>
                                    {to12h(slot.start)}
                                    <br />
                                    {to12h(slot.end)}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-0.5 text-gray-300">—</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}