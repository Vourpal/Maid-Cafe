"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChefHat, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch } from "@/lib/api";
import { ExportButton } from "../admin/shared";
import type {
  EventMenu,
  EventMenuItem,
  MenuListResponse,
  MenuItem,
  StaffListResponse,
  StaffMember,
} from "@/types/admin";

const inputClass =
  "w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-300";

const CATEGORY_LABELS: Record<string, string> = {
  food: "Food",
  drink: "Drinks",
  dessert: "Dessert",
  special: "Specials",
  other: "Other",
};

function money(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

type EntryForm = {
  assignedTo: string;
  quantity: string;
  priceOverride: string;
  notes: string;
};

/**
 * Per-event menu.
 *
 * The catalog is managed in Admin → Menu; this picks from it. Keeping the two
 * apart is the point of the feature: an event menu is a selection, not a
 * re-typing exercise.
 */
export default function EventMenuManager({
  eventId,
  onClose,
}: {
  eventId: number;
  onClose: () => void;
}) {
  const [data, setData] = useState<EventMenu | null>(null);
  const [catalog, setCatalog] = useState<MenuItem[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [adding, setAdding] = useState(false);
  const [addItemId, setAddItemId] = useState("");
  const [addQuantity, setAddQuantity] = useState("");
  const [addAssignee, setAddAssignee] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<EntryForm>({
    assignedTo: "",
    quantity: "",
    priceOverride: "",
    notes: "",
  });

  const [confirmRemove, setConfirmRemove] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [menu, catalogRes, staffRes] = await Promise.all([
        apiFetch<EventMenu>(`/events/${eventId}/menu`),
        apiFetch<MenuListResponse>("/menu-items?quantity=300&active=true"),
        apiFetch<StaffListResponse>("/users?quantity=1000&sort=name"),
      ]);
      setData(menu);
      setCatalog(catalogRes.menu_items);
      setStaff(staffRes.users);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load menu");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    load();
  }, [load]);

  async function addItem() {
    if (!addItemId) {
      toast.error("Pick an item from the catalog");
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/events/${eventId}/menu`, {
        method: "POST",
        body: JSON.stringify({
          menu_item_id: Number(addItemId),
          quantity_planned: addQuantity === "" ? null : Number(addQuantity),
          assigned_to: addAssignee === "" ? null : Number(addAssignee),
        }),
      });
      toast.success("Added to the menu");
      setAddItemId("");
      setAddQuantity("");
      setAddAssignee("");
      setAdding(false);
      load();
    } catch (err) {
      // ALREADY_ON_MENU comes back as a readable 409.
      toast.error(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setBusy(false);
    }
  }

  function startEdit(entry: EventMenuItem) {
    setEditingId(entry.id);
    setEditForm({
      assignedTo: entry.assigned_to !== null ? String(entry.assigned_to) : "",
      quantity:
        entry.quantity_planned !== null ? String(entry.quantity_planned) : "",
      priceOverride:
        entry.price_override !== null ? String(entry.price_override) : "",
      notes: entry.notes ?? "",
    });
  }

  async function saveEdit(entry: EventMenuItem) {
    // Only changed fields, and nulls clear: dropping the override falls back to
    // the catalog price rather than pinning the current one.
    const payload: Record<string, unknown> = {};

    const assignee = editForm.assignedTo === "" ? null : Number(editForm.assignedTo);
    if (assignee !== entry.assigned_to) payload.assigned_to = assignee;

    const quantity = editForm.quantity === "" ? null : Number(editForm.quantity);
    if (quantity !== entry.quantity_planned) payload.quantity_planned = quantity;

    const price =
      editForm.priceOverride === "" ? null : Number(editForm.priceOverride);
    if (price !== entry.price_override) payload.price_override = price;

    if (editForm.notes !== (entry.notes ?? "")) {
      payload.notes = editForm.notes.trim() || null;
    }

    if (Object.keys(payload).length === 0) {
      setEditingId(null);
      return;
    }

    setBusy(true);
    try {
      await apiFetch(`/event-menu-items/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Menu updated");
      setEditingId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(entry: EventMenuItem) {
    setBusy(true);
    try {
      await apiFetch(`/event-menu-items/${entry.id}`, { method: "DELETE" });
      toast.success(`Removed ${entry.name}`);
      setConfirmRemove(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove item");
    } finally {
      setBusy(false);
    }
  }

  const onMenu = new Set(data?.items.map((item) => item.menu_item_id) ?? []);
  const addable = catalog.filter((item) => !onMenu.has(item.id));

  // Group for display in the same order the printed menu uses.
  const grouped = (data?.items ?? []).reduce<Record<string, EventMenuItem[]>>(
    (acc, item) => {
      (acc[item.category] ??= []).push(item);
      return acc;
    },
    {},
  );

  return (
    <Modal
      open
      onClose={onClose}
      title={data ? `Menu — ${data.event.title}` : "Menu"}
      maxWidth="max-w-3xl"
    >
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : !data ? (
        <p className="text-sm text-red-500">Could not load the menu.</p>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs bg-rose-50 rounded-xl px-4 py-3 text-gray-600">
            <span>{data.summary.items} items</span>
            <span className="inline-flex items-center gap-1">
              <ChefHat className="w-3.5 h-3.5" />
              {data.summary.unassigned} without a cook
            </span>
            {data.summary.with_allergens > 0 && (
              <span className="inline-flex items-center gap-1 text-amber-700">
                <TriangleAlert className="w-3.5 h-3.5" />
                {data.summary.with_allergens} with allergens
              </span>
            )}
            {data.summary.projected_revenue !== null &&
              data.summary.projected_revenue > 0 && (
                <span>
                  Projected {money(data.summary.projected_revenue)} at planned
                  quantities
                </span>
              )}
            <span className="sm:ml-auto flex flex-wrap gap-2">
              <ExportButton
                path={`/exports/events/${eventId}/menu.csv`}
                filename={`menu-${eventId}.csv`}
                label="Menu CSV"
              />
              <ExportButton
                path={`/exports/events/${eventId}/menu.csv?prep=true`}
                filename={`prep-list-${eventId}.csv`}
                label="Prep list"
              />
            </span>
          </div>

          {/* Add from catalog */}
          {adding ? (
            <div className="border border-rose-200 bg-rose-50/50 rounded-xl p-3 space-y-2">
              <select
                className={inputClass}
                value={addItemId}
                onChange={(e) => setAddItemId(e.target.value)}
              >
                <option value="">Select from the catalog…</option>
                {addable.map((item) => (
                  <option key={item.id} value={item.id}>
                    {CATEGORY_LABELS[item.category] ?? item.category} ·{" "}
                    {item.name}
                    {item.price !== null ? ` · ${money(item.price)}` : ""}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  className={inputClass}
                  value={addQuantity}
                  onChange={(e) => setAddQuantity(e.target.value)}
                  placeholder="Planned quantity"
                />
                <select
                  className={inputClass}
                  value={addAssignee}
                  onChange={(e) => setAddAssignee(e.target.value)}
                >
                  <option value="">Nobody assigned to prep</option>
                  {staff.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addItem}
                  disabled={busy}
                  className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
                >
                  Add to menu
                </button>
                <button
                  onClick={() => setAdding(false)}
                  className="text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-white transition"
                >
                  Cancel
                </button>
              </div>

              {addable.length === 0 && (
                <p className="text-xs text-gray-500">
                  Every active catalog item is already on this menu. Add new ones
                  in Admin → Menu.
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1.5 text-xs border border-rose-200 text-rose-600 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add an item
            </button>
          )}

          {/* The menu itself */}
          {data.items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              Nothing on the menu for this event yet.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(grouped).map(([category, items]) => (
                <div
                  key={category}
                  className="border border-rose-100 rounded-xl overflow-hidden"
                >
                  <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-700">
                    {CATEGORY_LABELS[category] ?? category}
                    <span className="ml-2 text-xs text-gray-400">
                      {items.length}
                    </span>
                  </div>

                  <div className="divide-y divide-rose-50">
                    {items.map((entry) => (
                      <div key={entry.id} className="px-4 py-2.5">
                        {editingId === entry.id ? (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-800">
                              {entry.name}
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              <select
                                className={`${inputClass} col-span-2 sm:col-span-1`}
                                value={editForm.assignedTo}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    assignedTo: e.target.value,
                                  })
                                }
                              >
                                <option value="">No cook</option>
                                {staff.map((member) => (
                                  <option key={member.id} value={member.id}>
                                    {member.first_name} {member.last_name}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="number"
                                min={0}
                                className={inputClass}
                                value={editForm.quantity}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    quantity: e.target.value,
                                  })
                                }
                                placeholder="Qty"
                              />
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                className={inputClass}
                                value={editForm.priceOverride}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    priceOverride: e.target.value,
                                  })
                                }
                                placeholder={
                                  entry.catalog_price !== null
                                    ? `Catalog ${entry.catalog_price}`
                                    : "Price"
                                }
                              />
                            </div>
                            <input
                              className={inputClass}
                              value={editForm.notes}
                              onChange={(e) =>
                                setEditForm({
                                  ...editForm,
                                  notes: e.target.value,
                                })
                              }
                              placeholder="Notes for the day"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => saveEdit(entry)}
                                disabled={busy}
                                className="inline-flex items-center gap-1 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 disabled:opacity-60 transition"
                              >
                                <Check className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="inline-flex items-center gap-1 text-xs text-gray-500 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800">
                                {entry.name}
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                  {money(entry.price)}
                                  {entry.price_override !== null && " (override)"}
                                </span>
                              </p>
                              <p className="text-xs text-gray-400">
                                {entry.assignee
                                  ? `Prep: ${entry.assignee.first_name} ${entry.assignee.last_name}`
                                  : "Prep: unassigned"}
                                {entry.quantity_planned !== null &&
                                  ` · ${entry.quantity_planned} planned`}
                                {entry.notes && ` · ${entry.notes}`}
                              </p>
                              {(entry.allergens || entry.dietary) && (
                                <p className="text-xs mt-0.5">
                                  {entry.allergens && (
                                    <span className="text-amber-700">
                                      Allergens: {entry.allergens}
                                    </span>
                                  )}
                                  {entry.allergens && entry.dietary && " · "}
                                  {entry.dietary && (
                                    <span className="text-emerald-700">
                                      {entry.dietary}
                                    </span>
                                  )}
                                </p>
                              )}
                            </div>

                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => startEdit(entry)}
                                className="text-xs px-2 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-500"
                              >
                                Edit
                              </button>
                              {confirmRemove === entry.id ? (
                                <button
                                  onClick={() => removeItem(entry)}
                                  disabled={busy}
                                  className="text-xs bg-red-500 text-white px-2 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                                >
                                  Confirm
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmRemove(entry.id)}
                                  className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                                  title="Remove from menu"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
