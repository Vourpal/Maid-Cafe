"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import type { Invite } from "@/types/admin";
import { EmptyState, Field, SectionCard, inputClass } from "./shared";

export default function InvitesTab() {
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [maxUses, setMaxUses] = useState(1);
  const [expiresAt, setExpiresAt] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    apiFetch<Invite[]>("/invites")
      .then(setInvites)
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setGeneratedCode(null);
    try {
      const invite = await apiFetch<Invite>("/invites", {
        method: "POST",
        body: JSON.stringify({
          max_uses: maxUses,
          expires_at: expiresAt || null,
        }),
      });
      setGeneratedCode(invite.code);
      setInvites((prev) => [invite, ...prev]);
      await navigator.clipboard.writeText(invite.code);
      toast.success("Invite code copied to clipboard!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: number) {
    try {
      await apiFetch(`/invites/${id}`, { method: "DELETE" });
      setInvites((prev) => prev.filter((i) => i.id !== id));
      toast.success("Invite revoked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke invite");
    }
  }

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code);
    toast.success("Copied to clipboard!");
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Generator */}
      <div className="bg-white rounded-2xl border border-rose-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4 text-rose-500" />
          Generate Invite Code
        </h2>

        <div className="space-y-3">
          <Field label="Max Uses">
            <input
              type="number"
              min={1}
              value={maxUses}
              onChange={(e) => setMaxUses(Number(e.target.value))}
              className={inputClass}
            />
          </Field>

          <Field label="Expiration (optional)">
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className={inputClass}
            />
          </Field>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full bg-rose-500 hover:bg-rose-600 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg transition"
          >
            {generating ? "Generating..." : "Generate Invite Code"}
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

      {/* Existing codes */}
      <SectionCard title="Active Invite Codes" count={loading ? undefined : invites.length}>
        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : invites.length === 0 ? (
          <EmptyState message="No invite codes yet." />
        ) : (
          <div className="divide-y divide-rose-50 max-h-[420px] overflow-y-auto">
            {invites.map((invite) => {
              const isExpired =
                invite.expires_at && new Date(invite.expires_at) < new Date();
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
                          {" · "}Expires{" "}
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
      </SectionCard>
    </div>
  );
}
