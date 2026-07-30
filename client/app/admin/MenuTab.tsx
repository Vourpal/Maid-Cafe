"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Coffee, Pencil, Plus, Trash2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import Modal from "../components/Modal";
import { apiFetch, queryString } from "@/lib/api";
import EventMenuManager from "../events/EventMenuManager";
import type {
  MenuCategory,
  MenuItem,
  MenuListResponse,
} from "@/types/admin";
import type { Event as EventType } from "@/types/event";
import {
  EmptyState,
  ExportButton,
  Field,
  SectionCard,
  StatCard,
  formatDateTime,
  inputClass,
} from "./shared";

const CATEGORIES: MenuCategory[] = ["food", "drink", "dessert", "special", "other"];

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  food: "Food",
  drink: "Drink",
  dessert: "Dessert",
  special: "Special",
  other: "Other",
};

type ItemForm = {
  name: string;
  category: MenuCategory;
  description: string;
  price: string;
  allergens: string;
  dietary: string;
  notes: string;
  active: boolean;
};

const emptyItem: ItemForm = {
  name: "",
  category: "food",
  description: "",
  price: "",
  allergens: "",
  dietary: "",
  notes: "",
  active: true,
};

function money(value: number | null): string {
  return value === null ? "—" : `$${value.toFixed(2)}`;
}

/**
 * Menu catalog.
 *
 * The catalog is the reusable half of the feature; the per-event selection lives
 * behind "Manage menu" on each event, which is also where the printable menu and
 * prep-list exports are.
 */
export default function MenuTab() {
  const [data, setData] = useState<MenuListResponse | null>(null);
  const [events, setEvents] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [form, setForm] = useState<ItemForm>(emptyItem);

  const [pendingDelete, setPendingDelete] = useState<MenuItem | null>(null);
  const [menuEventId, setMenuEventId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = queryString({
        search,
        category,
        active: showInactive ? "" : "true",
        quantity: 300,
        sort: "category",
      });
      setData(await apiFetch<MenuListResponse>(`/menu-items${qs}`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the menu");
    } finally {
      setLoading(false);
    }
  }, [search, category, showInactive]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    apiFetch<{ events: EventType[] }>("/events?quantity=50&future_only=true")
      .then((res) => setEvents(res.events))
      .catch(() => toast.error("Could not load events"));
  }, []);

  function openCreate() {
    setForm(emptyItem);
    setCreating(true);
  }

  function openEdit(item: MenuItem) {
    setForm({
      name: item.name,
      category: item.category,
      description: item.description ?? "",
      price: item.price !== null ? String(item.price) : "",
      allergens: item.allergens ?? "",
      dietary: item.dietary ?? "",
      notes: item.notes ?? "",
      active: item.active,
    });
    setEditing(item);
  }

  async function saveItem() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }

    const payload = {
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim() || null,
      price: form.price === "" ? null : Number(form.price),
      allergens: form.allergens.trim() || null,
      dietary: form.dietary.trim() || null,
      notes: form.notes.trim() || null,
      active: form.active,
    };

    setBusy(true);
    try {
      if (editing) {
        await apiFetch(`/menu-items/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Item updated");
      } else {
        await apiFetch("/menu-items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Item added to the catalog");
      }
      setCreating(false);
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setBusy(false);
    }
  }

  /** Deactivating keeps the item on past event menus; deleting does not. */
  async function toggleActive(item: MenuItem) {
    setBusy(true);
    try {
      await apiFetch(`/menu-items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !item.active }),
      });
      toast.success(item.active ? "Item deactivated" : "Item reactivated");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setBusy(false);
    }
  }

  async function deleteItem(item: MenuItem, force: boolean) {
    setBusy(true);
    try {
      await apiFetch(`/menu-items/${item.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      toast.success(`Deleted "${item.name}"`);
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete item");
    } finally {
      setBusy(false);
    }
  }

  const items = data?.menu_items ?? [];
  const stats = data?.stats;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Catalog items"
          value={stats?.total ?? 0}
          hint={`${stats?.active ?? 0} active`}
        />
        <StatCard label="Food" value={stats?.food ?? 0} tone="amber" />
        <StatCard label="Drinks" value={stats?.drink ?? 0} tone="purple" />
        <StatCard
          label="With allergens"
          value={stats?.with_allergens ?? 0}
          hint="Flagged for the floor"
        />
      </div>

      {/* Event menus — where the printable exports live */}
      <SectionCard title="Event menus" count={events.length}>
        {events.length === 0 ? (
          <EmptyState message="No upcoming events to build a menu for." />
        ) : (
          <div className="divide-y divide-rose-50">
            {events.map((event) => (
              <div
                key={event.id}
                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                    <UtensilsCrossed className="w-4 h-4 text-amber-500" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDateTime(event.start_datetime)}
                      {event.location && ` · ${event.location}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 shrink-0 pl-11 sm:pl-0">
                  <button
                    onClick={() => setMenuEventId(event.id)}
                    className="text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
                  >
                    Manage menu
                  </button>
                  <ExportButton
                    path={`/exports/events/${event.id}/menu.csv?prep=true`}
                    filename={`prep-list-${event.id}.csv`}
                    label="Prep list"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Catalog */}
      <SectionCard
        title="Catalog"
        count={loading ? undefined : (data?.total ?? 0)}
        action={
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 text-xs bg-rose-500 text-white px-3 py-1.5 rounded-lg hover:bg-rose-600 transition font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            New item
          </button>
        }
      >
        <div className="px-5 py-3 border-b border-rose-50 flex flex-wrap items-center gap-2">
          <input
            className={`${inputClass} max-w-xs`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, description, allergens…"
          />
          <select
            className={`${inputClass} max-w-[10rem]`}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          <label className="text-xs text-gray-500 inline-flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-rose-500"
            />
            Include inactive
          </label>
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
                {/* Stacks on a phone so the three actions do not squeeze the
                    name and allergen line. */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center shrink-0">
                      {item.category === "drink" ? (
                        <Coffee className="w-4 h-4 text-rose-500" />
                      ) : (
                        <UtensilsCrossed className="w-4 h-4 text-rose-500" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">
                        {item.name}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          {money(item.price)}
                        </span>
                        {!item.active && (
                          <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-normal">
                            Inactive
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {CATEGORY_LABELS[item.category]}
                        {item.description && ` · ${item.description}`}
                        {` · on ${item.event_count} event menu${item.event_count === 1 ? "" : "s"}`}
                      </p>
                      {(item.allergens || item.dietary) && (
                        <p className="text-xs mt-0.5">
                          {item.allergens && (
                            <span className="text-amber-700 inline-flex items-center gap-1">
                              <TriangleAlert className="w-3 h-3" />
                              {item.allergens}
                            </span>
                          )}
                          {item.allergens && item.dietary && " · "}
                          {item.dietary && (
                            <span className="text-emerald-700">{item.dietary}</span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1 shrink-0 pl-11 sm:pl-0 sm:ml-auto">
                    <button
                      onClick={() => toggleActive(item)}
                      disabled={busy}
                      className="text-xs border border-gray-200 px-2 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-60 transition text-gray-500"
                    >
                      {item.active ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition text-gray-400 hover:text-gray-600"
                      title="Edit"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setPendingDelete(item)}
                      className="p-1.5 rounded-lg border border-red-100 hover:bg-red-50 transition text-red-400 hover:text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {pendingDelete?.id === item.id && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-800">
                      {item.event_count === 0
                        ? `Delete "${item.name}"?`
                        : `"${item.name}" is on ${item.event_count} event menu${item.event_count === 1 ? "" : "s"}. Deleting removes it from all of them — deactivating keeps the history.`}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => deleteItem(item, item.event_count > 0)}
                        disabled={busy}
                        className="text-xs bg-red-500 text-white px-3 py-1.5 rounded-lg hover:bg-red-600 disabled:opacity-60 transition"
                      >
                        {item.event_count === 0 ? "Delete" : "Delete anyway"}
                      </button>
                      {item.event_count > 0 && (
                        <button
                          onClick={() => {
                            setPendingDelete(null);
                            toggleActive(item);
                          }}
                          disabled={busy}
                          className="text-xs bg-gray-600 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-60 transition"
                        >
                          Deactivate instead
                        </button>
                      )}
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
        title={editing ? `Edit ${editing.name}` : "New menu item"}
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
                className={inputClass}
                value={form.category}
                onChange={(e) =>
                  setForm({ ...form, category: e.target.value as MenuCategory })
                }
              >
                {CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Price">
              <input
                type="number"
                min={0}
                step="0.01"
                className={inputClass}
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="Leave empty for no price"
              />
            </Field>
          </div>

          <Field label="Description">
            <input
              className={inputClass}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="How it reads on the menu"
            />
          </Field>

          <Field label="Allergens">
            <input
              className={inputClass}
              value={form.allergens}
              onChange={(e) => setForm({ ...form, allergens: e.target.value })}
              placeholder="Contains milk, eggs, wheat…"
            />
          </Field>

          <Field label="Dietary">
            <input
              className={inputClass}
              value={form.dietary}
              onChange={(e) => setForm({ ...form, dietary: e.target.value })}
              placeholder="Vegetarian, vegan, gluten free…"
            />
          </Field>

          <Field label="Notes">
            <textarea
              className={inputClass}
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Prep notes, recipe link…"
            />
          </Field>

          <label className="text-sm text-gray-600 inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm({ ...form, active: e.target.checked })}
              className="accent-rose-500"
            />
            Available to add to event menus
          </label>

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

      {menuEventId !== null && (
        <EventMenuManager
          eventId={menuEventId}
          onClose={() => {
            setMenuEventId(null);
            load();
          }}
        />
      )}
    </div>
  );
}
