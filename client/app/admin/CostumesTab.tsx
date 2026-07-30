"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Pencil, Plus, Shirt, Trash2, Undo2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch, queryString } from "@/lib/api";
import type {
  CheckoutResult,
  CostumeCategory,
  CostumeCondition,
  CostumeItem,
  CostumeCheckoutRecord,
  CostumeListResponse,
  CostumeStatus,
  StaffListResponse,
  StaffMember,
} from "@/types/admin";
import type { Event as EventType } from "@/types/event";
import {
  EmptyState,
  ExportButton,
  Field,
  SectionCard,
  StatCard,
  formatDate,
  inputClass,
} from "./shared";

const CATEGORIES: CostumeCategory[] = [
  "costume",
  "prop",
  "accessory",
  "wig",
  "other",
];

const CONDITIONS: CostumeCondition[] = [
  "good",
  "needs_repair",
  "needs_cleaning",
  "retired",
];

const CONDITION_LABELS: Record<CostumeCondition, string> = {
  good: "Good",
  needs_repair: "Needs repair",
  needs_cleaning: "Needs cleaning",
  retired: "Retired",
};

const STATUS_STYLES: Record<CostumeStatus, string> = {
  available: "bg-emerald-100 text-emerald-700",
  assigned: "bg-rose-100 text-rose-600",
  partially_out: "bg-amber-100 text-amber-700",
  in_repair: "bg-orange-100 text-orange-700",
  in_laundry: "bg-blue-100 text-blue-700",
  retired: "bg-gray-100 text-gray-500",
};

const STATUS_LABELS: Record<CostumeStatus, string> = {
  available: "Available",
  assigned: "Assigned",
  partially_out: "Partly out",
  in_repair: "In repair",
  in_laundry: "In laundry",
  retired: "Retired",
};

type ItemForm = {
  name: string;
  category: CostumeCategory;
  description: string;
  size: string;
  color: string;
  ownerId: string;
  condition: CostumeCondition;
  quantity: string;
  storageLocation: string;
  notes: string;
};

const emptyItem: ItemForm = {
  name: "",
  category: "costume",
  description: "",
  size: "",
  color: "",
  ownerId: "",
  condition: "good",
  quantity: "1",
  storageLocation: "",
  notes: "",
};

/**
 * Costume and prop inventory.
 *
 * Status is derived server-side from the condition plus the open checkout rows,
 * so there is nothing here that can drift out of step with who actually has the
 * item.
 */
export default function CostumesTab() {
  const [data, setData] = useState<CostumeListResponse | null>(null);
  const [openCheckouts, setOpenCheckouts] = useState<CostumeCheckoutRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");

  const [editing, setEditing] = useState<CostumeItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ItemForm>(emptyItem);

  const [checkoutItem, setCheckoutItem] = useState<CostumeItem | null>(null);
  const [checkoutUser, setCheckoutUser] = useState("");
  const [checkoutEvent, setCheckoutEvent] = useState("");
  const [checkoutDue, setCheckoutDue] = useState("");
  const [checkoutNotes, setCheckoutNotes] = useState("");

  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString({
        search,
        category,
        status,
        quantity: 200,
        sort: "category",
      });
      const [items, checkouts] = await Promise.all([
        apiFetch<CostumeListResponse>(`/costumes${qs}`),
        apiFetch<CostumeCheckoutRecord[]>("/costumes/checked-out"),
      ]);
      setData(items);
      setOpenCheckouts(checkouts);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [search, category, status]);

  useEffect(() => {
    load();
  }, [load]);

  // Owner and checkout dropdowns need the roster; events need the calendar.
  useEffect(() => {
    apiFetch<StaffListResponse>("/users?quantity=1000&sort=name")
      .then((res) => setStaff(res.users))
      .catch(() => toast.error("Could not load the staff list"));
  }, []);

  useEffect(() => {
    if (!checkoutItem || events.length > 0) return;
    apiFetch<{ events: EventType[] }>("/events?quantity=200&future_only=true")
      .then((res) => setEvents(res.events))
      .catch(() => toast.error("Could not load events"));
  }, [checkoutItem, events.length]);

  function openCreate() {
    setForm(emptyItem);
    setCreating(true);
  }

  function openEdit(item: CostumeItem) {
    setForm({
      name: item.name,
      category: item.category,
      description: item.description ?? "",
      size: item.size ?? "",
      color: item.color ?? "",
      ownerId: item.owner_id !== null ? String(item.owner_id) : "",
      condition: item.condition,
      quantity: String(item.quantity),
      storageLocation: item.storage_location ?? "",
      notes: item.notes ?? "",
    });
    setEditing(item);
  }

  function formPayload() {
    return {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      size: form.size.trim() || null,
      color: form.color.trim() || null,
      owner_id: form.ownerId === "" ? null : Number(form.ownerId),
      condition: form.condition,
      quantity: form.quantity === "" ? 1 : Number(form.quantity),
      storage_location: form.storageLocation.trim() || null,
      notes: form.notes.trim() || null,
    };
  }

  async function saveItem() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/costumes/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(formPayload()),
        });
        toast.success("Item updated");
      } else {
        await apiFetch("/costumes", {
          method: "POST",
          body: JSON.stringify(formPayload()),
        });
        toast.success("Item added");
      }
      setEditing(null);
      setCreating(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item: CostumeItem) {
    setBusy(true);
    try {
      await apiFetch(`/costumes/${item.id}`, { method: "DELETE" });
      toast.success(`Deleted "${item.name}"`);
      setPendingDelete(null);
      load();
    } catch (err) {
      // ITEM_CHECKED_OUT explains why retiring is usually the better move.
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }

  /**
   * `force` overrides the double-booking guard. Without it the server refuses
   * once every copy is out over overlapping dates.
   */
  async function checkout(force: boolean) {
    if (!checkoutItem) return;

    if (!checkoutUser && !checkoutEvent) {
      toast.error("Pick a member, an event, or both");
      return;
    }

    setBusy(true);
    try {
      const result = await apiFetch<CheckoutResult>(
        `/costumes/${checkoutItem.id}/checkout${force ? "?force=true" : ""}`,
        {
          method: "POST",
          body: JSON.stringify({
            user_id: checkoutUser === "" ? null : Number(checkoutUser),
            event_id: checkoutEvent === "" ? null : Number(checkoutEvent),
            due_back_at: checkoutDue || null,
            notes: checkoutNotes.trim() || null,
          }),
        },
      );

      toast.success(`${checkoutItem.name} checked out`);
      // Copies remained, so the clash was reported rather than refused.
      for (const warning of result.warnings) toast.warning(warning);

      setCheckoutItem(null);
      setCheckoutUser("");
      setCheckoutEvent("");
      setCheckoutDue("");
      setCheckoutNotes("");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to check out");
    } finally {
      setBusy(false);
    }
  }

  async function markReturned(record: CostumeCheckoutRecord) {
    setBusy(true);
    try {
      await apiFetch(`/costume-assignments/${record.id}/return`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      toast.success(`${record.item_name} marked returned`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record return");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.items ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Items"
          value={stats?.total ?? 0}
          hint={`${stats?.costumes ?? 0} costumes · ${stats?.props ?? 0} props`}
        />
        <StatCard
          label="Checked out"
          value={stats?.checked_out ?? 0}
          tone="purple"
        />
        <StatCard
          label="Needs attention"
          value={(stats?.needs_repair ?? 0) + (stats?.needs_cleaning ?? 0)}
          hint={`${stats?.needs_repair ?? 0} repair · ${stats?.needs_cleaning ?? 0} laundry`}
          tone="amber"
        />
        <StatCard
          label="Overdue back"
          value={stats?.overdue ?? 0}
          tone={(stats?.overdue ?? 0) > 0 ? "amber" : "emerald"}
        />
      </div>

      {/* Currently out */}
      {openCheckouts.length > 0 && (
        <SectionCard title="Currently checked out" count={openCheckouts.length}>
          <div className="divide-y divide-rose-50">
            {openCheckouts.map((record) => (
              <div
                key={record.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {record.item_name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {record.first_name
                      ? `${record.first_name} ${record.last_name}`
                      : "Group"}
                    {record.event_title && ` · ${record.event_title}`}
                    {record.due_back_at && ` · due ${formatDate(record.due_back_at)}`}
                  </p>
                </div>

                {record.overdue && (
                  <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full shrink-0">
                    Overdue
                  </span>
                )}

                <button
                  onClick={() => markReturned(record)}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 text-xs border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition text-gray-600 shrink-0"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  Mark returned
                </button>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Inventory */}
      <SectionCard
        title="Inventory"
        count={loading ? undefined : (data?.total ?? 0)}
        action={
          <div className="flex items-center gap-2">
            <ExportButton path="/exports/costumes.csv" filename="costume-inventory.csv" />
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              New item
            </button>
          </div>
        }
      >
        <div className="px-5 py-3 border-b border-rose-50 flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, colour, storage…"
          />
          <select
            className={`${inputClass} max-w-[10rem]`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value} className="capitalize">
                {value}
              </option>
            ))}
          </select>
          <select
            className={`${inputClass} max-w-[10rem]`}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Any status</option>
            <option value="available">Available</option>
            <option value="assigned">Checked out</option>
            <option value="in_repair">In repair</option>
            <option value="in_laundry">In laundry</option>
            <option value="retired">Retired</option>
          </select>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState message="Nothing matches those filters." />
        ) : (
          <div className="divide-y divide-rose-50">
            {items.map((item) => (
              <div key={item.id} className="px-5 py-3">
                {/* Stacks on a phone: the status badge and three actions do not
                    fit beside the name at that width. */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                      {item.category === "prop" ? (
                        <Package className="w-4 h-4 text-rose-500" />
                      ) : (
                        <Shirt className="w-4 h-4 text-rose-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {item.name}
                        <span className="ml-2 text-xs font-normal text-gray-400 capitalize">
                          {item.category}
                        </span>
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {item.group_owned
                          ? "Group-owned"
                          : `Owned by ${item.owner?.first_name ?? ""} ${item.owner?.last_name ?? ""}`}
                        {item.size && ` · size ${item.size}`}
                        {item.color && ` · ${item.color}`}
                        {` · ${CONDITION_LABELS[item.condition]}`}
                        {item.quantity > 1 &&
                          ` · ${item.available_count}/${item.quantity} free`}
                        {item.storage_location && ` · ${item.storage_location}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pl-11 sm:pl-0 sm:ml-auto shrink-0">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_STYLES[item.status]}`}
                    >
                      {STATUS_LABELS[item.status]}
                    </span>

                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => setCheckoutItem(item)}
                        disabled={item.status === "retired"}
                        className="text-xs border border-rose-200 text-rose-600 px-2 py-1.5 rounded-lg hover:bg-rose-50 disabled:opacity-40 transition"
                        title={
                          item.status === "retired"
                            ? "Retired items cannot be assigned"
                            : "Check out"
                        }
                      >
                        Check out
                      </button>
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setPendingDelete(item.id)}
                        className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {pendingDelete === item.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-800">
                      Delete &quot;{item.name}&quot; and its checkout history?
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => deleteItem(item)}
                        disabled={busy}
                        className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setPendingDelete(null)}
                        className="text-xs text-gray-600 px-3 py-1.5 rounded-lg hover:bg-white transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Create / edit */}
      <Modal
        open={creating || editing !== null}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        title={editing ? `Edit ${editing.name}` : "New inventory item"}
        maxWidth="max-w-lg"
      >
        <div className="space-y-3">
          <Field label="Name">
            <input
              className={inputClass}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                className={`${inputClass} capitalize`}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as CostumeCategory })
                }
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value} className="capitalize">
                    {value}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Condition">
              <select
                className={inputClass}
                value={form.condition}
                onChange={(e) =>
                  setForm({ ...form, condition: e.target.value as CostumeCondition })
                }
              >
                {CONDITIONS.map((value) => (
                  <option key={value} value={value}>
                    {CONDITION_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Field label="Size">
              <input
                className={inputClass}
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
                placeholder="M, 8, one size"
              />
            </Field>
            <Field label="Colour">
              <input
                className={inputClass}
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
              />
            </Field>
            <Field label="Quantity">
              <input
                type="number"
                min={1}
                className={inputClass}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Owner">
            <select
              className={inputClass}
              value={form.ownerId}
              onChange={(e) => setForm({ ...form, ownerId: e.target.value })}
            >
              <option value="">Group-owned</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Storage location">
            <input
              className={inputClass}
              value={form.storageLocation}
              onChange={(e) =>
                setForm({ ...form, storageLocation: e.target.value })
              }
              placeholder="Bin 3, back closet…"
            />
          </Field>

          <Field label="Description">
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </Field>

          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>

          <div className="flex gap-2 pt-1">
            <button
              onClick={saveItem}
              disabled={busy}
              className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
            >
              {editing ? "Save changes" : "Add item"}
            </button>
            <button
              onClick={() => {
                setCreating(false);
                setEditing(null);
              }}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Check out */}
      <Modal
        open={checkoutItem !== null}
        onClose={() => setCheckoutItem(null)}
        title={checkoutItem ? `Check out ${checkoutItem.name}` : "Check out"}
        maxWidth="max-w-md"
      >
        <div className="space-y-3">
          <Field label="To member">
            <select
              className={inputClass}
              value={checkoutUser}
              onChange={(e) => setCheckoutUser(e.target.value)}
            >
              <option value="">Nobody in particular</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="For event">
            <select
              className={inputClass}
              value={checkoutEvent}
              onChange={(e) => setCheckoutEvent(e.target.value)}
            >
              <option value="">No specific event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due back">
            <input
              type="date"
              className={inputClass}
              value={checkoutDue}
              onChange={(e) => setCheckoutDue(e.target.value)}
            />
          </Field>

          <Field label="Notes">
            <input
              className={inputClass}
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
            />
          </Field>

          <p className="text-xs text-gray-400">
            Tying the checkout to an event is what lets the double-booking check
            work — without one, the item just reads as out.
          </p>

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => checkout(false)}
              disabled={busy}
              className="text-sm bg-rose-500 text-white px-4 py-2 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition font-medium"
            >
              Check out
            </button>
            <button
              onClick={() => checkout(true)}
              disabled={busy}
              className="text-sm text-amber-700 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-50 disabled:opacity-60 transition"
              title="Ignore the double-booking and condition guards"
            >
              Force
            </button>
            <button
              onClick={() => setCheckoutItem(null)}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
