"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, queryString } from "@/lib/api";
import type { AuditEntry } from "@/types/admin";
import {
  EmptyState,
  ExportButton,
  SectionCard,
  formatDateTime,
  inputClass,
  relativeTime,
} from "./shared";

const PAGE_SIZE = 40;

type AuditResponse = {
  page: number;
  total: number;
  entity_types: string[];
  actions: string[];
  entries: AuditEntry[];
};

const ACTION_TONES: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  restore: "bg-purple-100 text-purple-700",
  login: "bg-gray-100 text-gray-600",
};

export default function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString({
        page,
        quantity: PAGE_SIZE,
        entity_type: entityType,
        action,
        search,
      });
      const data = await apiFetch<AuditResponse>(`/audit-log${qs}`);
      setEntries(data.entries);
      setTotal(data.total);
      setEntityTypes(data.entity_types);
      setActions(data.actions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, [page, entityType, action, search]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <SectionCard
      title="Audit log"
      count={loading ? undefined : total}
      action={
        <ExportButton path="/exports/audit-log.csv" filename="audit-log.csv" />
      }
    >
      {/* Filters */}
      <div className="px-5 py-3 border-b border-rose-50 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search summary or person"
            className={`${inputClass} pl-9`}
          />
        </div>

        <select
          value={entityType}
          onChange={(e) => {
            setEntityType(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} w-auto`}
        >
          <option value="">All areas</option>
          {entityTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, " ")}
            </option>
          ))}
        </select>

        <select
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} w-auto`}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-5 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState
          message={
            search || entityType || action
              ? "No entries match those filters."
              : "Nothing has been logged yet. Entries appear here as admins make changes."
          }
        />
      ) : (
        <div className="divide-y divide-rose-50">
          {entries.map((entry) => {
            const hasChanges =
              entry.changes && Object.keys(entry.changes).length > 0;
            const isOpen = expanded === entry.id;

            return (
              <div key={entry.id} className="px-5 py-2.5">
                <div className="flex items-start gap-3">
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${
                      ACTION_TONES[entry.action] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {entry.action}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{entry.summary}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {entry.actor_label ?? "System"} ·{" "}
                      <span title={formatDateTime(entry.created_at)}>
                        {relativeTime(entry.created_at)}
                      </span>
                      {" · "}
                      <span className="capitalize">
                        {entry.entity_type.replace(/_/g, " ")}
                        {entry.entity_id !== null && ` #${entry.entity_id}`}
                      </span>
                    </p>
                  </div>

                  {hasChanges && (
                    <button
                      onClick={() => setExpanded(isOpen ? null : entry.id)}
                      className="p-1 rounded text-gray-400 hover:text-gray-600 shrink-0"
                      title="Show what changed"
                    >
                      <ChevronDown
                        className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                      />
                    </button>
                  )}
                </div>

                {/* Field-level diff */}
                {isOpen && hasChanges && (
                  <div className="mt-2 ml-16 bg-gray-50 rounded-lg p-3 space-y-1">
                    {Object.entries(entry.changes!).map(([field, value]) => {
                      const diff = value as { from?: unknown; to?: unknown };
                      const isDiff =
                        diff && typeof diff === "object" && "to" in diff;

                      return (
                        <p key={field} className="text-xs font-mono">
                          <span className="text-gray-500">{field}: </span>
                          {isDiff ? (
                            <>
                              <span className="text-red-500 line-through">
                                {String(diff.from ?? "—")}
                              </span>
                              <span className="text-gray-400"> → </span>
                              <span className="text-emerald-600">
                                {String(diff.to ?? "—")}
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-700">
                              {JSON.stringify(value)}
                            </span>
                          )}
                        </p>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="px-5 py-3 border-t border-rose-50 flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {page} of {totalPages} · {total} entries
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition text-gray-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
