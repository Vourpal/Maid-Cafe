"""Menu management: a reusable catalog plus a per-event selection.

The catalog exists so the same latte is not retyped for every event. An event
menu row points at a catalog item and adds the things that are specific to that
day: who is preparing it, how much to make, and an optional one-off price.
"""

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import (
    EventMenuItemCreate,
    EventMenuItemUpdate,
    MenuItemCreate,
    MenuItemUpdate,
)
from queries.audit_queries import diff_changes, record_audit
from queries.event_queries import get_event_by_id
from queries.menu_queries import (
    add_event_menu_item,
    count_menu_items,
    create_menu_item,
    delete_menu_item,
    get_event_menu,
    get_event_menu_item_by_id,
    get_event_menu_summary,
    get_menu_item_by_id,
    get_menu_item_events,
    get_menu_items,
    get_menu_stats,
    remove_event_menu_item,
    update_event_menu_item,
    update_menu_item,
)
from queries.user_queries import get_me
from utils import (
    APIError,
    bool_arg,
    get_db,
    int_arg,
    pagination_args,
    str_arg,
    success_response,
)

menu_bp = Blueprint("menu", __name__)

# Mirrors the CHECK constraint on menu_items.category.
_CATEGORIES = {"food", "drink", "dessert", "special", "other"}
_SORT_OPTIONS = {"name", "category", "price", "created_at"}


def _validate_menu_fields(requested: dict):
    category = requested.get("category")
    if category is not None and category not in _CATEGORIES:
        raise APIError(
            "VALIDATION_ERROR",
            f"Category must be one of: {', '.join(sorted(_CATEGORIES))}",
            422,
        )

    price = requested.get("price")
    if price is not None and price < 0:
        raise APIError("VALIDATION_ERROR", "Price cannot be negative", 422)


def _validate_event_item_fields(requested: dict):
    price = requested.get("price_override")
    if price is not None and price < 0:
        raise APIError("VALIDATION_ERROR", "Price cannot be negative", 422)

    planned = requested.get("quantity_planned")
    if planned is not None and planned < 0:
        raise APIError("VALIDATION_ERROR", "Planned quantity cannot be negative", 422)


def _require_event(cur, event_id: int):
    event = get_event_by_id(cur, event_id)
    if event is None:
        raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
    return event


# ══════════════════════════════════════════════════════════════════════════════
# CATALOG
# ══════════════════════════════════════════════════════════════════════════════


@menu_bp.route("/menu-items", methods=["GET"])
@require_auth
def list_menu_items(user_id):
    """Readable by any member — staff need the allergen list on the floor."""
    with get_db() as (conn, cur):
        page, quantity, offset = pagination_args(default_quantity=100, max_quantity=300)
        filters = {
            "category": str_arg("category", allowed=_CATEGORIES),
            "active": bool_arg("active"),
            "search": str_arg("search"),
            "dietary": str_arg("dietary"),
        }
        sort = str_arg("sort", default="category", allowed=_SORT_OPTIONS)

        items = get_menu_items(cur, limit=quantity, offset=offset, sort=sort, **filters)
        total = count_menu_items(cur, **filters)

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(items),
                "total": total,
                "stats": get_menu_stats(cur),
                "menu_items": items,
            },
            200,
        )


@menu_bp.route("/menu-items", methods=["POST"])
@require_admin
def create_menu_item_route(user_id):
    with get_db() as (conn, cur):
        try:
            payload = MenuItemCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        name = payload.name.strip()
        if not name:
            raise APIError("VALIDATION_ERROR", "Name is required", 422)
        payload.name = name

        _validate_menu_fields(payload.model_dump())

        item_id = create_menu_item(cur, payload)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="menu_item",
            entity_id=item_id,
            summary=f"Added menu item '{name}' ({payload.category})",
            changes={
                "category": payload.category,
                "price": payload.price,
                "allergens": payload.allergens,
            },
        )

        return success_response(get_menu_item_by_id(cur, item_id), 201)


@menu_bp.route("/menu-items/<int:item_id>", methods=["GET"])
@require_auth
def get_menu_item_route(user_id, item_id):
    with get_db() as (conn, cur):
        item = get_menu_item_by_id(cur, item_id)
        if item is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)
        return success_response(item, 200)


@menu_bp.route("/menu-items/<int:item_id>", methods=["PATCH"])
@require_admin
def update_menu_item_route(user_id, item_id):
    with get_db() as (conn, cur):
        try:
            payload = MenuItemUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        if "name" in requested and not (requested["name"] or "").strip():
            raise APIError("VALIDATION_ERROR", "Name cannot be empty", 422)

        _validate_menu_fields(requested)

        before = get_menu_item_by_id(cur, item_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)

        updated = update_menu_item(cur, item_id, payload)
        if updated is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)

        after = get_menu_item_by_id(cur, item_id)
        changes = diff_changes(
            {key: before.get(key) for key in requested},
            {key: after.get(key) for key in requested},
        )

        if changes:
            record_audit(
                cur,
                actor_id=user_id,
                actor=get_me(cur, user_id),
                action="update",
                entity_type="menu_item",
                entity_id=item_id,
                summary=f"Updated menu item '{before['name']}' ({', '.join(changes)})",
                changes=changes,
            )

        return success_response(after, 200)


@menu_bp.route("/menu-items/<int:item_id>", methods=["DELETE"])
@require_admin
def delete_menu_item_route(user_id, item_id):
    """Deleting a catalog item removes it from every event menu it appears on
    (the FK cascades), so that needs force=true. Deactivating is usually what
    the admin actually wants, and the message says so."""
    with get_db() as (conn, cur):
        before = get_menu_item_by_id(cur, item_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)

        force = bool_arg("force", default=False)
        if before["event_count"] > 0 and not force:
            raise APIError(
                "MENU_ITEM_IN_USE",
                f"'{before['name']}' is on {before['event_count']} event "
                "menu(s). Deactivate it instead, or delete anyway with "
                "force=true.",
                409,
            )

        deleted = delete_menu_item(cur, item_id)
        if deleted is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="menu_item",
            entity_id=item_id,
            summary=(
                f"Deleted menu item '{before['name']}' "
                f"(was on {before['event_count']} event menu(s))"
            ),
        )

        return success_response({"deleted": deleted}, 200)


# ══════════════════════════════════════════════════════════════════════════════
# PER-EVENT MENU
# ══════════════════════════════════════════════════════════════════════════════


@menu_bp.route("/events/<int:event_id>/menu", methods=["GET"])
@require_auth
def get_event_menu_route(user_id, event_id):
    with get_db() as (conn, cur):
        event = _require_event(cur, event_id)

        return success_response(
            {
                "event": {
                    "id": event.id,
                    "title": event.title,
                    "start_datetime": event.start_datetime.isoformat(),
                    "end_datetime": event.end_datetime.isoformat(),
                    "status": event.status,
                },
                "summary": get_event_menu_summary(cur, event_id),
                "items": get_event_menu(cur, event_id),
            },
            200,
        )


@menu_bp.route("/events/<int:event_id>/menu", methods=["POST"])
@require_admin
def add_event_menu_item_route(user_id, event_id):
    """Put a catalog item on this event's menu."""
    with get_db() as (conn, cur):
        event = _require_event(cur, event_id)

        try:
            payload = EventMenuItemCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        _validate_event_item_fields(payload.model_dump(exclude_unset=True))

        catalog_item = get_menu_item_by_id(cur, payload.menu_item_id)
        if catalog_item is None:
            raise APIError(
                "NOT_FOUND",
                f"Menu item {payload.menu_item_id} does not exist",
                404,
            )

        try:
            entry_id = add_event_menu_item(cur, event_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "That menu item or member does not exist",
                422,
            )

        if entry_id is None:
            raise APIError(
                "ALREADY_ON_MENU",
                f"'{catalog_item['name']}' is already on this event's menu.",
                409,
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="event_menu_item",
            entity_id=entry_id,
            summary=f"Added '{catalog_item['name']}' to the menu for '{event.title}'",
            changes={
                "event_id": event_id,
                "menu_item_id": payload.menu_item_id,
                "assigned_to": payload.assigned_to,
                "quantity_planned": payload.quantity_planned,
            },
        )

        return success_response(get_event_menu_item_by_id(cur, entry_id), 201)


@menu_bp.route("/event-menu-items/<int:entry_id>", methods=["PATCH"])
@require_admin
def update_event_menu_item_route(user_id, entry_id):
    with get_db() as (conn, cur):
        try:
            payload = EventMenuItemUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        _validate_event_item_fields(requested)

        before = get_event_menu_item_by_id(cur, entry_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Menu entry {entry_id} does not exist", 404)

        try:
            updated = update_event_menu_item(cur, entry_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError("INVALID_REFERENCE", "That member does not exist", 422)

        if updated is None:
            raise APIError("NOT_FOUND", f"Menu entry {entry_id} does not exist", 404)

        after = get_event_menu_item_by_id(cur, entry_id)
        changes = diff_changes(
            {key: before.get(key) for key in requested},
            {key: after.get(key) for key in requested},
        )

        if changes:
            record_audit(
                cur,
                actor_id=user_id,
                actor=get_me(cur, user_id),
                action="update",
                entity_type="event_menu_item",
                entity_id=entry_id,
                summary=(
                    f"Updated '{before['name']}' on the menu for "
                    f"event {before['event_id']} ({', '.join(changes)})"
                ),
                changes=changes,
            )

        return success_response(after, 200)


@menu_bp.route("/event-menu-items/<int:entry_id>", methods=["DELETE"])
@require_admin
def remove_event_menu_item_route(user_id, entry_id):
    """Takes the item off this event's menu. The catalog entry is untouched."""
    with get_db() as (conn, cur):
        before = get_event_menu_item_by_id(cur, entry_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Menu entry {entry_id} does not exist", 404)

        deleted = remove_event_menu_item(cur, entry_id)
        if deleted is None:
            raise APIError("NOT_FOUND", f"Menu entry {entry_id} does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="event_menu_item",
            entity_id=entry_id,
            summary=(
                f"Removed '{before['name']}' from the menu for "
                f"event {before['event_id']}"
            ),
        )

        return success_response({"deleted": deleted}, 200)


@menu_bp.route("/menu-items/<int:item_id>/events", methods=["GET"])
@require_admin
def menu_item_events(user_id, item_id):
    """Which events a catalog item is on — the reuse view, and what the delete
    guard is talking about."""
    with get_db() as (conn, cur):
        item = get_menu_item_by_id(cur, item_id)
        if item is None:
            raise APIError("NOT_FOUND", f"Menu item {item_id} does not exist", 404)

        limit = int_arg("limit", default=50, minimum=1, maximum=200)
        return success_response(
            {"item": item, "events": get_menu_item_events(cur, item_id, limit)}, 200
        )
