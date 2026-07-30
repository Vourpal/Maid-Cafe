"""Costume and prop inventory, plus the check-out log.

Status is derived from `condition` and the open checkout rows rather than stored
in a column of its own — see queries/costume_queries.py for why.

The interesting rule is double-booking: handing the same item to two people for
overlapping events. That is refused once every copy of the item is already out,
and reported as a warning while copies remain, because an item with quantity 3
can legitimately be out three times at once.
"""

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import CostumeCheckout, CostumeItemCreate, CostumeItemUpdate, CostumeReturn
from queries.audit_queries import diff_changes, record_audit
from queries.costume_queries import (
    checkout_costume_item,
    count_costume_items,
    create_costume_item,
    delete_costume_item,
    find_conflicting_checkouts,
    get_costume_assignment_by_id,
    get_costume_item_by_id,
    get_costume_items,
    get_costume_stats,
    get_item_history,
    get_open_checkouts,
    lock_costume_item,
    return_costume_item,
    update_costume_item,
)
from queries.event_queries import get_event_by_id
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

costume_bp = Blueprint("costumes", __name__)

# Mirror the CHECK constraints so a bad value is a readable 422 rather than a
# CheckViolation surfacing as a 500 from the global handler.
_CATEGORIES = {"costume", "prop", "accessory", "wig", "other"}
_CONDITIONS = {"good", "needs_repair", "needs_cleaning", "retired"}

_AVAILABILITY = {"available", "assigned", "in_repair", "in_laundry", "retired"}
_SORT_OPTIONS = {"name", "category", "condition", "owner", "created_at"}

# Conditions that take an item out of circulation.
_BLOCKING_CONDITIONS = {"needs_repair", "needs_cleaning"}

_CONDITION_LABELS = {
    "needs_repair": "in repair",
    "needs_cleaning": "in the laundry",
}


def _validate_item_fields(requested: dict):
    category = requested.get("category")
    if category is not None and category not in _CATEGORIES:
        raise APIError(
            "VALIDATION_ERROR",
            f"Category must be one of: {', '.join(sorted(_CATEGORIES))}",
            422,
        )

    condition = requested.get("condition")
    if condition is not None and condition not in _CONDITIONS:
        raise APIError(
            "VALIDATION_ERROR",
            f"Condition must be one of: {', '.join(sorted(_CONDITIONS))}",
            422,
        )

    quantity = requested.get("quantity")
    if quantity is not None and quantity < 1:
        raise APIError("VALIDATION_ERROR", "Quantity must be at least 1", 422)


def _filters_from_request():
    return {
        "category": str_arg("category", allowed=_CATEGORIES),
        "condition": str_arg("condition", allowed=_CONDITIONS),
        "owner_id": int_arg("owner_id"),
        "group_owned": bool_arg("group_owned"),
        "search": str_arg("search"),
        "availability": str_arg("status", allowed=_AVAILABILITY),
    }


def _conflict_summary(conflict) -> str:
    holder = (
        f"{conflict['first_name']} {conflict['last_name']}"
        if conflict["first_name"]
        else "somebody"
    )
    where = f" for '{conflict['event_title']}'" if conflict["event_title"] else ""
    return f"out with {holder}{where}"


@costume_bp.route("/costumes", methods=["GET"])
@require_auth
def list_costumes(user_id):
    """Readable by any member: people need to know what exists and what is free
    before asking for it. Writes are admin-only."""
    with get_db() as (conn, cur):
        page, quantity, offset = pagination_args(default_quantity=50, max_quantity=200)
        filters = _filters_from_request()
        sort = str_arg("sort", default="name", allowed=_SORT_OPTIONS)

        items = get_costume_items(cur, limit=quantity, offset=offset, sort=sort, **filters)
        total = count_costume_items(cur, **filters)

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(items),
                "total": total,
                "stats": get_costume_stats(cur),
                "items": items,
            },
            200,
        )


@costume_bp.route("/costumes", methods=["POST"])
@require_admin
def create_costume_route(user_id):
    with get_db() as (conn, cur):
        try:
            payload = CostumeItemCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        name = payload.name.strip()
        if not name:
            raise APIError("VALIDATION_ERROR", "Name is required", 422)
        payload.name = name

        _validate_item_fields(payload.model_dump())

        try:
            item_id = create_costume_item(cur, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE", "That owner does not exist", 422
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="costume_item",
            entity_id=item_id,
            summary=f"Added {payload.category} '{name}' to inventory",
            changes={
                "category": payload.category,
                "owner_id": payload.owner_id,
                "quantity": payload.quantity,
                "condition": payload.condition,
            },
        )

        return success_response(get_costume_item_by_id(cur, item_id), 201)


@costume_bp.route("/costumes/me", methods=["GET"])
@require_auth
def my_costumes(user_id):
    """What the caller currently has out."""
    with get_db() as (conn, cur):
        return success_response(get_open_checkouts(cur, user_id=user_id), 200)


@costume_bp.route("/costumes/checked-out", methods=["GET"])
@require_admin
def checked_out_costumes(user_id):
    """Everything currently out, optionally for one event."""
    with get_db() as (conn, cur):
        return success_response(
            get_open_checkouts(cur, event_id=int_arg("event_id")), 200
        )


@costume_bp.route("/costumes/<int:item_id>", methods=["GET"])
@require_auth
def get_costume_route(user_id, item_id):
    with get_db() as (conn, cur):
        item = get_costume_item_by_id(cur, item_id)
        if item is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        return success_response(
            {"item": item, "history": get_item_history(cur, item_id)}, 200
        )


@costume_bp.route("/costumes/<int:item_id>", methods=["PATCH"])
@require_admin
def update_costume_route(user_id, item_id):
    with get_db() as (conn, cur):
        try:
            payload = CostumeItemUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        if "name" in requested and not (requested["name"] or "").strip():
            raise APIError("VALIDATION_ERROR", "Name cannot be empty", 422)

        _validate_item_fields(requested)

        before = get_costume_item_by_id(cur, item_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        try:
            updated = update_costume_item(cur, item_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError("INVALID_REFERENCE", "That owner does not exist", 422)

        if updated is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        after = get_costume_item_by_id(cur, item_id)
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
                entity_type="costume_item",
                entity_id=item_id,
                summary=f"Updated '{before['name']}' ({', '.join(changes)})",
                changes=changes,
            )

        return success_response(after, 200)


@costume_bp.route("/costumes/<int:item_id>", methods=["DELETE"])
@require_admin
def delete_costume_route(user_id, item_id):
    """Refused while the item is still out with somebody — deleting it would
    take the checkout history with it and lose track of a physical object."""
    with get_db() as (conn, cur):
        before = get_costume_item_by_id(cur, item_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        force = bool_arg("force", default=False)
        if before["out_count"] > 0 and not force:
            raise APIError(
                "ITEM_CHECKED_OUT",
                f"'{before['name']}' is still checked out. Mark it returned "
                "first, or retire it instead of deleting it.",
                409,
            )

        deleted = delete_costume_item(cur, item_id)
        if deleted is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="costume_item",
            entity_id=item_id,
            summary=f"Deleted {before['category']} '{before['name']}' from inventory",
        )

        return success_response({"deleted": deleted}, 200)


@costume_bp.route("/costumes/<int:item_id>/checkout", methods=["POST"])
@require_admin
def checkout_costume_route(user_id, item_id):
    """Assign an item to a member, optionally for a specific event.

    The item row is locked before the overlap check so two admins checking the
    same costume out at the same moment cannot both pass it.
    """
    with get_db() as (conn, cur):
        try:
            payload = CostumeCheckout(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        if payload.user_id is None and payload.event_id is None:
            raise APIError(
                "VALIDATION_ERROR",
                "Give a member, an event, or both — otherwise there is nothing "
                "to track the item against.",
                422,
            )

        if lock_costume_item(cur, item_id) is None:
            raise APIError("NOT_FOUND", f"Item {item_id} does not exist", 404)

        item = get_costume_item_by_id(cur, item_id)
        force = bool_arg("force", default=False)

        if item["condition"] == "retired":
            raise APIError(
                "ITEM_RETIRED",
                f"'{item['name']}' is retired and cannot be assigned.",
                409,
            )

        if item["condition"] in _BLOCKING_CONDITIONS and not force:
            raise APIError(
                "ITEM_UNAVAILABLE",
                f"'{item['name']}' is {_CONDITION_LABELS[item['condition']]}. "
                "Assign it anyway with force=true.",
                409,
            )

        if payload.event_id is not None:
            event = get_event_by_id(cur, payload.event_id)
            if event is None:
                raise APIError(
                    "EVENT_NOT_FOUND",
                    f"Event {payload.event_id} does not exist",
                    404,
                )

        conflicts = find_conflicting_checkouts(cur, item_id, payload.event_id)
        capacity_reached = item["out_count"] >= max(item["quantity"], 1)

        # Every copy is already out, and at least one of them clashes with the
        # target event. That is a genuine double-booking, so refuse it.
        if conflicts and capacity_reached and not force:
            raise APIError(
                "ITEM_DOUBLE_BOOKED",
                f"'{item['name']}' is already {_conflict_summary(conflicts[0])} "
                "over the same dates. Return it first, or override with "
                "force=true.",
                409,
            )

        try:
            assignment_id = checkout_costume_item(cur, item_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "That member or event does not exist",
                422,
            )

        assignment = get_costume_assignment_by_id(cur, assignment_id)

        holder = (
            f"{assignment['first_name']} {assignment['last_name']}"
            if assignment["first_name"]
            else "the group"
        )
        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="update",
            entity_type="costume_item",
            entity_id=item_id,
            summary=(
                f"Checked out '{item['name']}' to {holder}"
                + (f" for '{assignment['event_title']}'" if assignment["event_title"] else "")
            ),
            changes={
                "assignment_id": assignment_id,
                "user_id": payload.user_id,
                "event_id": payload.event_id,
                "forced": force,
            },
        )

        return success_response(
            {
                "assignment": assignment,
                "item": get_costume_item_by_id(cur, item_id),
                # Copies remain, so this is a heads-up rather than a refusal.
                "warnings": (
                    [
                        f"Also {_conflict_summary(conflict)} over the same dates"
                        for conflict in conflicts
                    ]
                    if conflicts
                    else []
                ),
            },
            201,
        )


@costume_bp.route("/costume-assignments/<int:assignment_id>/return", methods=["POST"])
@require_admin
def return_costume_route(user_id, assignment_id):
    """Close a checkout and optionally record the condition it came back in."""
    with get_db() as (conn, cur):
        try:
            payload = CostumeReturn(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        if payload.condition is not None and payload.condition not in _CONDITIONS:
            raise APIError(
                "VALIDATION_ERROR",
                f"Condition must be one of: {', '.join(sorted(_CONDITIONS))}",
                422,
            )

        before = get_costume_assignment_by_id(cur, assignment_id)
        if before is None:
            raise APIError(
                "NOT_FOUND", f"Checkout {assignment_id} does not exist", 404
            )

        if not before["open"]:
            raise APIError(
                "ALREADY_RETURNED",
                f"'{before['item_name']}' was already marked returned.",
                409,
            )

        returned = return_costume_item(cur, assignment_id, payload.notes)
        if returned is None:
            raise APIError(
                "ALREADY_RETURNED",
                f"'{before['item_name']}' was already marked returned.",
                409,
            )

        # A costume coming back dirty or torn is the normal way condition gets
        # updated, so the return payload can carry it.
        if payload.condition is not None:
            update_costume_item(
                cur,
                before["item_id"],
                CostumeItemUpdate(condition=payload.condition),
            )

        holder = (
            f"{before['first_name']} {before['last_name']}"
            if before["first_name"]
            else "the group"
        )
        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="update",
            entity_type="costume_item",
            entity_id=before["item_id"],
            summary=f"'{before['item_name']}' returned by {holder}",
            changes={
                "assignment_id": assignment_id,
                "condition": payload.condition,
            },
        )

        return success_response(
            {
                "assignment": get_costume_assignment_by_id(cur, assignment_id),
                "item": get_costume_item_by_id(cur, before["item_id"]),
            },
            200,
        )


@costume_bp.route("/events/<int:event_id>/costumes", methods=["GET"])
@require_auth
def event_costumes(user_id, event_id):
    """What is currently signed out against one event."""
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        return success_response(get_open_checkouts(cur, event_id=event_id), 200)
