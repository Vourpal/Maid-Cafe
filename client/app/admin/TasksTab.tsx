"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Pencil,
  Plus,
  Search,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, queryString } from "@/lib/api";
import type {
  StaffListResponse,
  StaffMember,
  Task,
  TaskListResponse,
  TaskStats,
} from "@/types/admin";
import type { Event } from "@/types/event";
import TaskModal from "./TaskModal";
import {
  EmptyState,
  ExportButton,
  SectionCard,
  StatCard,
  formatDate,
  inputClass,
  relativeTime,
} from "./shared";

type Filter = "all" | "open" | "completed" | "overdue" | "unassigned";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "unassigned", label: "Unassigned" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

/** Map the UI filter onto the API's query parameters. */
function filterParams(filter: Filter) {
  switch (filter) {
    case "open":
      return { completed: false };
    case "completed":
      return { completed: true };
    case "overdue":
      return { overdue: true };
    case "unassigned":
      return { unassigned: true, completed: false };
    default:
      return {};
  }
}

export default function TasksTab() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [filter, setFilter] = useState<Filter>("open");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<Event[]>([]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString({
        quantity: 100,
        search,
        sort: "status",
        ...filterParams(filter),
      });
      const data = await apiFetch<TaskListResponse>(`/tasks${qs}`);
      setTasks(data.tasks);
      setStats(data.stats);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    load();
  }, [load]);

  // Options for the create/edit modal. Fetched once; a staff group this size
  // fits comfortably in one request.
  useEffect(() => {
    apiFetch<StaffListResponse>("/users?quantity=1000&sort=name")
      .then((data) => setStaff(data.users))
      .catch(() => setStaff([]));

    apiFetch<{ events: Event[] }>("/events?quantity=200&future_only=false")
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setEvents([]));
  }, []);

  async function toggleComplete(task: Task) {
    const next = !task.completed;
    // Optimistic: the row flips immediately and reverts if the call fails.
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, completed: next } : t)),
    );

    try {
      await apiFetch(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: next }),
      });
      load();
    } catch (err) {
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, completed: !next } : t)),
      );
      toast.error(err instanceof Error ? err.message : "Failed to update task");
    }
  }

  async function handleDelete(taskId: number) {
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setConfirmDelete(null);
      toast.success("Task deleted");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete task");
    }
  }

  function isOverdue(task: Task) {
    return (
      !task.completed && task.due_date && new Date(task.due_date) < new Date()
    );
  }

  return (
    <div className="space-y-5">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open" value={stats.open} />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            tone={stats.overdue > 0 ? "amber" : "gray"}
          />
          <StatCard label="Unassigned" value={stats.unassigned} tone="gray" />
          <StatCard label="Completed" value={stats.completed} tone="emerald" />
        </div>
      )}

      <SectionCard
        title="Tasks"
        count={loading ? undefined : tasks.length}
        action={
          <div className="flex gap-2">
            <ExportButton path="/exports/tasks.csv" filename="tasks.csv" />
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New task
            </button>
          </div>
        }
      >
        {/* Filters */}
        <div className="px-5 py-3 border-b border-rose-50 flex flex-wrap gap-2 items-center">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {FILTERS.map((option) => (
              <button
                key={option.value}
                onClick={() => setFilter(option.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  filter === option.value
                    ? "bg-white text-rose-600 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search tasks"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            message={
              search
                ? `No tasks match "${search}".`
                : filter === "open"
                  ? "No open tasks. Nice."
                  : "No tasks here."
            }
          />
        ) : (
          <div className="divide-y divide-rose-50">
            {tasks.map((task) => (
              <div key={task.id} className="px-5 py-3 flex items-start gap-3">
                <button
                  onClick={() => toggleComplete(task)}
                  className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition ${
                    task.completed
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-gray-300 hover:border-rose-400"
                  }`}
                  title={task.completed ? "Mark incomplete" : "Mark complete"}
                >
                  {task.completed && <Check className="w-3 h-3" />}
                </button>

                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium truncate ${
                      task.completed
                        ? "text-gray-400 line-through"
                        : "text-gray-800"
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3 mt-1.5 text-xs">
                    <span className="text-gray-400 inline-flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      {task.assignee
                        ? `${task.assignee.first_name} ${task.assignee.last_name}`
                        : "Unassigned"}
                    </span>

                    {task.due_date && (
                      <span
                        className={`inline-flex items-center gap-1 ${
                          isOverdue(task)
                            ? "text-red-600 font-medium"
                            : "text-gray-400"
                        }`}
                      >
                        <CalendarDays className="w-3 h-3" />
                        {formatDate(task.due_date)}
                        {isOverdue(task) && ` (${relativeTime(task.due_date)})`}
                      </span>
                    )}

                    {task.event_title && (
                      <span className="text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full">
                        {task.event_title}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(task)}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                    title="Edit"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {confirmDelete === task.id ? (
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="text-xs bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 transition"
                    >
                      Confirm
                    </button>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(task.id)}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {(creating || editing) && (
        <TaskModal
          task={editing}
          staff={staff}
          events={events}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={load}
        />
      )}
    </div>
  );
}
