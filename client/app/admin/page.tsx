"use client";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { useUserAuthentication } from "../UserAuthentication";
import { Skeleton } from "@/components/ui/skeleton";
import { authHeaders } from "@/lib/api";
import { Users, Ticket, Copy, Trash2, ShieldCheck, Plus } from "lucide-react";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normaliseDay(raw: any): DayAvailability {
  if (!raw) return { enabled: false, slots: [] };
  if (Array.isArray(raw.slots)) {
    return { enabled: raw.enabled ?? false, slots: raw.slots };
  }
  const slot: TimeSlot = { start: raw.start ?? "", end: raw.end ?? "" };
  return { enabled: raw.enabled ?? false, slots: raw.enabled ? [slot] : [] };
}

function to12h(time: string): string {
  if (!time) return "--";
  const [h, m] = time.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")}${period}`;
}

function getInitials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Admin() {
  const { user, loading } = useUserAuthentication();
  const [activeTab, setActiveTab] = useState<"staff" | "invites">("staff");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);

  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [invites, setInvites] = useState<Invite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  useEffect(() => {
    if (!user?.admin) { setStaffLoading(false); return; }
    async function fetchStaff() {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/users`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const json = await res.json();
        setStaff(Array.isArray(json) ? json : json.data);
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
      if (!res.ok) { toast.error("Failed to generate invite code"); return; }
      const invite = json.data;
      setGeneratedCode(invite.code);
      setInvites((prev) => [invite, ...prev]);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/invites/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
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

  // Auth guards
  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!user?.admin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <p className="text-5xl mb-4">🔒</p>
        <p className="text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Admin Panel</h1>
          <p className="text-gray-500 text-sm">Manage staff and invite codes</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        <button
          onClick={() => setActiveTab("staff")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "staff"
              ? "bg-white text-rose-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Users className="w-4 h-4" />
          Staff
        </button>
        <button
          onClick={() => setActiveTab("invites")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "invites"
              ? "bg-white text-rose-600 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Ticket className="w-4 h-4" />
          Invite Codes
        </button>
      </div>

      {/* Staff Tab */}
      {activeTab === "staff" && (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-rose-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">
              Staff Members
              {!staffLoading && (
                <span className="ml-2 text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full font-normal">
                  {staff.length}
                </span>
              )}
            </h2>
          </div>

          {staffLoading ? (
            <div className="p-5 space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : staff.length === 0 ? (
            <div className="p-10 text-center text-gray-400 text-sm">
              No staff members found.
            </div>
          ) : (
            <div className="divide-y divide-rose-50">
              {staff.map((member) => (
                <div key={member.id} className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 font-bold text-sm flex items-center justify-center shrink-0">
                      {getInitials(member.first_name, member.last_name)}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Name + role */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-800">
                          {member.first_name} {member.last_name}
                        </p>
                        <span className="text-xs text-gray-400">
                          @{member.username}
                        </span>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ml-auto
                            ${
                              member.type === "maid"
                                ? "bg-rose-100 text-rose-600"
                                : member.type === "butler"
                                  ? "bg-stone-100 text-stone-600"
                                  : "bg-gray-100 text-gray-400"
                            }`}
                        >
                          {member.type ?? "—"}
                        </span>
                      </div>

                      {/* Availability */}
                      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
                        {days.map((day) => {
                          const d = normaliseDay(member.availability?.[day]);
                          const enabled = d.enabled && d.slots.length > 0;
                          return (
                            <div key={day} className={`rounded-xl border p-3 min-h-[120px] ${enabled?"bg-rose-50 border-rose-200":"bg-gray-50 border-gray-200"}`}>
                              <p className={`text-sm font-bold uppercase mb-3 ${enabled?"text-rose-600":"text-gray-400"}`}>{day}</p>
                              {enabled ? (
                                <div className="space-y-2">
                                  {d.slots.map((slot,i)=>(
                                    <div key={i} className="rounded-lg bg-white border border-rose-100 px-2 py-1 shadow-sm">
                                      <p className="text-xs text-gray-500">Start</p>
                                      <p className="font-medium text-gray-800">{to12h(slot.start)}</p>
                                      <p className="text-xs text-gray-500 mt-1">End</p>
                                      <p className="font-medium text-gray-800">{to12h(slot.end)}</p>
                                    </div>
                                  ))}
                                </div>
                              ):(
                                <div className="flex items-center justify-center h-[70px]"><span className="text-sm text-gray-400">Unavailable</span></div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Invite Codes Tab */}
      {activeTab === "invites" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Generator */}
          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
            <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-rose-500" />
              Generate Invite Code
            </h2>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Max Uses
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxUses}
                  onChange={(e) => setMaxUses(Number(e.target.value))}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Expiration (optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300"
                />
              </div>

              <button
                onClick={handleGenerateInvite}
                disabled={inviteLoading}
                className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition"
              >
                {inviteLoading ? "Generating..." : "Generate Invite Code"}
              </button>
            </div>

            {generatedCode && (
              <div className="mt-4 bg-rose-50 border border-rose-200 rounded-xl p-4 text-center space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Generated Code
                </p>
                <p className="text-xl font-bold text-rose-600 tracking-widest font-mono">
                  {generatedCode}
                </p>
                <button
                  onClick={() => handleCopy(generatedCode)}
                  className="inline-flex items-center gap-1.5 text-xs bg-white border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition"
                >
                  <Copy className="w-3 h-3" />
                  Copy Code
                </button>
              </div>
            )}
          </div>

          {/* Active invites list */}
          <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-rose-50">
              <h2 className="font-semibold text-gray-700">Active Invite Codes</h2>
            </div>

            {invitesLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : invites.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No invite codes yet.
              </div>
            ) : (
              <div className="divide-y divide-rose-50 max-h-[420px] overflow-y-auto">
                {invites.map((invite) => {
                  const isExpired =
                    invite.expires_at &&
                    new Date(invite.expires_at) < new Date();
                  const isUsedUp = invite.uses >= invite.max_uses;

                  return (
                    <div
                      key={invite.id}
                      className="px-5 py-3 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-mono text-rose-600 font-semibold tracking-widest text-sm">
                          {invite.code}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {invite.uses}/{invite.max_uses} uses
                          {invite.expires_at && (
                            <>
                              {" · "}
                              Expires{" "}
                              {new Date(invite.expires_at).toLocaleDateString()}
                            </>
                          )}
                        </p>
                        <div className="flex gap-2 mt-0.5">
                          {isExpired && (
                            <span className="text-[10px] text-red-500 font-medium">
                              Expired
                            </span>
                          )}
                          {isUsedUp && (
                            <span className="text-[10px] text-gray-400 font-medium">
                              Used up
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => handleCopy(invite.code)}
                          className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevoke(invite.id)}
                          className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                          title="Revoke"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
