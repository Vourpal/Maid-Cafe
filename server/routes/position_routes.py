"""Event positions and shift assignments.

Admins hand out jobs to people who have signed up for an event. One person may
hold several positions at the same event, so the day can be run as shifts
(Server 10am-1pm, then Cashier 1pm-4pm).

Two guards matter here:

  * you can only assign somebody who actually has an attendances row for the
    event — assigning a job to a person who never signed up produces a schedule
    nobody is going to turn up for
  * the GET payload reports coverage gaps and double-bookings, so an admin can
    see the holes rather than having to eyeball a list of times
"""

from datetime import datetime

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import (
    AssignmentBulkCreate,
    AssignmentCreate,
    AssignmentUpdate,
    PositionCreate,
    PositionUpdate,
)
from queries.attendance_queries import get_attendance_by_user_and_event
from queries.audit_queries import diff_changes, record_audit
from queries.event_queries import get_event_by_id
from queries.position_queries import (
    create_assignment,
    create_position,
    delete_assignment,
    delete_position,
    get_assignment_by_id,
    get_event_assignments,
    get_event_shift_summary,
    get_position_by_id,
    get_positions,
    get_unassigned_signups,
    get_user_assignments,
    update_assignment,
    update_position,
)
from queries.user_queries import get_me
from utils import (
    APIError,
    bool_arg,
    get_db,
    int_arg,
    str_arg,
    success_response,
)

position_bp = Blueprint("positions", __name__)

_ASSIGNMENT_SORT_OPTIONS = {"time", "position", "person"}

# A gap shorter than this is scheduling noise (people handing over), not a hole
# worth flagging.
_GAP_TOLERANCE_MINUTES = 15


def _naive(value):
    """Drop the offset from a timestamp so shift times and event times can be
    compared.

    event_assignments.starts_at is TIMESTAMPTZ while events.start_date is a bare
    TIMESTAMP, and Python refuses to compare aware with naive. psycopg2 already
    hands back TIMESTAMPTZ converted into the connection's timezone, so dropping
    the offset leaves the same wall-clock reading the event columns hold.
    """
    if value is None:
        return None
    parsed = datetime.fromisoformat(value) if isinstance(value, str) else value
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def _minutes(delta) -> int:
    return int(delta.total_seconds() // 60)


def _merge(windows):
    """Merge overlapping/touching [start, end) windows, earliest first."""
    merged: list[list] = []
    for start, end in sorted(windows):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], end)
        else:
            merged.append([start, end])
    return merged


def _position_coverage(assignments, positions, event_start, event_end):
    """Per-position shift coverage across the event window.

    A position is covered when at least one assignment has no times at all
    (meaning "the whole event") or when its merged shift windows span the event
    start to the event end with no gap longer than the tolerance.
    """
    by_position: dict[int, list] = {}
    for entry in assignments:
        by_position.setdefault(entry["position_id"], []).append(entry)

    coverage = []
    for position in positions:
        rows = by_position.get(position["id"], [])

        if not rows:
            coverage.append(
                {
                    "position_id": position["id"],
                    "name": position["name"],
                    "color": position["color"],
                    "assignments": 0,
                    "people": 0,
                    "whole_event": False,
                    "covered": False,
                    "gaps": [],
                }
            )
            continue

        untimed = [r for r in rows if not r["starts_at"] or not r["ends_at"]]
        windows = [
            (_naive(r["starts_at"]), _naive(r["ends_at"]))
            for r in rows
            if r["starts_at"] and r["ends_at"]
        ]

        gaps = []
        if not untimed and event_start and event_end:
            # Clip to the event window: a setup shift that starts before doors
            # open should not read as covering the event itself.
            clipped = [
                (max(start, event_start), min(end, event_end))
                for start, end in windows
                if end > event_start and start < event_end
            ]

            cursor = event_start
            for start, end in _merge(clipped):
                if start > cursor and _minutes(start - cursor) > _GAP_TOLERANCE_MINUTES:
                    gaps.append(
                        {
                            "start": cursor.isoformat(),
                            "end": start.isoformat(),
                            "minutes": _minutes(start - cursor),
                        }
                    )
                cursor = max(cursor, end)

            if cursor < event_end and _minutes(event_end - cursor) > _GAP_TOLERANCE_MINUTES:
                gaps.append(
                    {
                        "start": cursor.isoformat(),
                        "end": event_end.isoformat(),
                        "minutes": _minutes(event_end - cursor),
                    }
                )

        coverage.append(
            {
                "position_id": position["id"],
                "name": position["name"],
                "color": position["color"],
                "assignments": len(rows),
                "people": len({r["user_id"] for r in rows}),
                "whole_event": bool(untimed),
                "covered": bool(untimed) or not gaps,
                "gaps": gaps,
            }
        )

    return coverage


def _double_bookings(assignments):
    """Same person, two jobs at overlapping times.

    Holding several positions at one event is the point of the feature, so this
    is reported rather than blocked — but two of them at the same moment is a
    mistake the admin needs to see.
    """
    by_user: dict[int, list] = {}
    for entry in assignments:
        if entry["starts_at"] and entry["ends_at"]:
            by_user.setdefault(entry["user_id"], []).append(entry)

    clashes = []
    for user_id, rows in by_user.items():
        ordered = sorted(rows, key=lambda r: _naive(r["starts_at"]))
        for earlier, later in zip(ordered, ordered[1:]):
            if _naive(later["starts_at"]) < _naive(earlier["ends_at"]):
                clashes.append(
                    {
                        "user_id": user_id,
                        "name": f"{earlier['first_name']} {earlier['last_name']}",
                        "first": {
                            "id": earlier["id"],
                            "position_name": earlier["position_name"],
                            "starts_at": earlier["starts_at"],
                            "ends_at": earlier["ends_at"],
                        },
                        "second": {
                            "id": later["id"],
                            "position_name": later["position_name"],
                            "starts_at": later["starts_at"],
                            "ends_at": later["ends_at"],
                        },
                    }
                )

    return clashes


def _shift_label(assignment) -> str:
    """Readable window for audit summaries."""
    if not assignment.starts_at or not assignment.ends_at:
        return "whole event"
    return f"{assignment.starts_at.isoformat()} – {assignment.ends_at.isoformat()}"


def _validate_window(starts_at, ends_at):
    if starts_at and ends_at and ends_at <= starts_at:
        raise APIError(
            "VALIDATION_ERROR", "A shift must end after it starts", 422
        )


def _require_signed_up(cur, event_id: int, user_id: int):
    """Assignments are restricted to members who are actually on the roster."""
    if get_attendance_by_user_and_event(cur, user_id, event_id) is None:
        raise APIError(
            "NOT_SIGNED_UP",
            "That member has not signed up for this event. Add them to the "
            "roster first, then assign a position.",
            422,
        )


def _require_position(cur, position_id: int):
    position = get_position_by_id(cur, position_id)
    if position is None:
        raise APIError("NOT_FOUND", f"Position {position_id} does not exist", 404)
    if not position["active"]:
        raise APIError(
            "POSITION_INACTIVE",
            f"'{position['name']}' is archived and cannot be assigned. "
            "Reactivate it first.",
            422,
        )
    return position


# ══════════════════════════════════════════════════════════════════════════════
# POSITION CATALOG
# ══════════════════════════════════════════════════════════════════════════════


@position_bp.route("/positions", methods=["GET"])
@require_auth
def list_positions(user_id):
    """Readable by any member so the shift views can label assignments."""
    with get_db() as (conn, cur):
        include_inactive = bool_arg("include_inactive", default=False)
        return success_response(get_positions(cur, include_inactive), 200)


@position_bp.route("/positions", methods=["POST"])
@require_admin
def create_position_route(user_id):
    with get_db() as (conn, cur):
        try:
            payload = PositionCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        name = payload.name.strip()
        if not name:
            raise APIError("VALIDATION_ERROR", "Name is required", 422)
        payload.name = name

        position_id = create_position(cur, payload)
        if position_id is None:
            raise APIError(
                "DUPLICATE_POSITION", f"A position named '{name}' already exists", 409
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="position",
            entity_id=position_id,
            summary=f"Created position '{name}'",
        )

        return success_response(get_position_by_id(cur, position_id), 201)


@position_bp.route("/positions/<int:position_id>", methods=["PATCH"])
@require_admin
def update_position_route(user_id, position_id):
    with get_db() as (conn, cur):
        try:
            payload = PositionUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        if "name" in requested and not (requested["name"] or "").strip():
            raise APIError("VALIDATION_ERROR", "Name cannot be empty", 422)

        before = get_position_by_id(cur, position_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Position {position_id} does not exist", 404)

        try:
            updated = update_position(cur, position_id, payload)
        except pg_errors.UniqueViolation:
            raise APIError(
                "DUPLICATE_POSITION", "Another position already has that name", 409
            )

        if updated is None:
            raise APIError("NOT_FOUND", f"Position {position_id} does not exist", 404)

        after = get_position_by_id(cur, position_id)
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
                entity_type="position",
                entity_id=position_id,
                summary=f"Updated position '{before['name']}' ({', '.join(changes)})",
                changes=changes,
            )

        return success_response(after, 200)


@position_bp.route("/positions/<int:position_id>", methods=["DELETE"])
@require_admin
def delete_position_route(user_id, position_id):
    """A position still referenced by assignments cannot be deleted — the FK is
    ON DELETE RESTRICT so historical schedules keep their labels. Archive it by
    setting active=false instead, which the error message points at.
    """
    with get_db() as (conn, cur):
        before = get_position_by_id(cur, position_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Position {position_id} does not exist", 404)

        if before["usage_count"] > 0:
            raise APIError(
                "POSITION_IN_USE",
                f"'{before['name']}' is used by {before['usage_count']} "
                "assignment(s). Archive it instead of deleting it.",
                409,
            )

        deleted = delete_position(cur, position_id)
        if deleted is None:
            raise APIError("NOT_FOUND", f"Position {position_id} does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="position",
            entity_id=position_id,
            summary=f"Deleted position '{before['name']}'",
        )

        return success_response({"deleted": deleted}, 200)


# ══════════════════════════════════════════════════════════════════════════════
# ASSIGNMENTS
# ══════════════════════════════════════════════════════════════════════════════


@position_bp.route("/events/<int:event_id>/assignments", methods=["GET"])
@require_auth
def list_event_assignments(user_id, event_id):
    """The full shift picture for one event: who is doing what, which positions
    are still unfilled, where the coverage gaps are, and who signed up but has
    no job yet.
    """
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        sort = str_arg("sort", default="time", allowed=_ASSIGNMENT_SORT_OPTIONS)
        assignments = get_event_assignments(cur, event_id, sort=sort)
        positions = get_positions(cur, include_inactive=False)
        unassigned = get_unassigned_signups(cur, event_id)

        event_start = _naive(event.start_datetime)
        event_end = _naive(event.end_datetime)
        coverage = _position_coverage(assignments, positions, event_start, event_end)

        filled = {c["position_id"] for c in coverage if c["assignments"] > 0}
        assigned_people = {a["user_id"] for a in assignments}

        return success_response(
            {
                "event": {
                    "id": event.id,
                    "title": event.title,
                    "start_datetime": event.start_datetime.isoformat(),
                    "end_datetime": event.end_datetime.isoformat(),
                    "location": event.location,
                    "status": event.status,
                },
                "summary": {
                    "assignments": len(assignments),
                    "people_assigned": len(assigned_people),
                    # Everyone with an assignment is on the roster by definition,
                    # so the roster size is the two groups added together.
                    "signups": len(assigned_people) + len(unassigned),
                    "positions_total": len(positions),
                    "positions_filled": len(filled),
                    "unassigned_count": len(unassigned),
                },
                "positions": positions,
                "assignments": assignments,
                "coverage": coverage,
                "unfilled_positions": [c for c in coverage if c["assignments"] == 0],
                "gaps": [
                    {"position_id": c["position_id"], "name": c["name"], **gap}
                    for c in coverage
                    for gap in c["gaps"]
                ],
                "double_booked": _double_bookings(assignments),
                "unassigned_signups": unassigned,
            },
            200,
        )


@position_bp.route("/events/<int:event_id>/assignments", methods=["POST"])
@require_admin
def create_event_assignments(user_id, event_id):
    """Accepts one assignment or a batch.

    A batch is all-or-nothing: get_db() only commits when the whole block
    succeeds, so a rejected row cannot leave half a shift plan behind.
    """
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        body = request.get_json() or {}

        try:
            if "assignments" in body:
                payload = AssignmentBulkCreate(**body)
                requested = payload.assignments
            else:
                requested = [AssignmentCreate(**body)]
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        if not requested:
            raise APIError("BAD_REQUEST", "No assignments supplied", 400)

        actor = get_me(cur, user_id)
        created = []

        for assignment in requested:
            _validate_window(_naive(assignment.starts_at), _naive(assignment.ends_at))
            position = _require_position(cur, assignment.position_id)
            _require_signed_up(cur, event_id, assignment.user_id)

            try:
                assignment_id = create_assignment(cur, event_id, assignment)
            except pg_errors.ForeignKeyViolation:
                raise APIError(
                    "INVALID_REFERENCE",
                    "The member or position referenced by this assignment does "
                    "not exist",
                    422,
                )

            row = get_assignment_by_id(cur, assignment_id)
            created.append(row)

            record_audit(
                cur,
                actor_id=user_id,
                actor=actor,
                action="create",
                entity_type="event_assignment",
                entity_id=assignment_id,
                summary=(
                    f"Assigned {row['first_name']} {row['last_name']} as "
                    f"{position['name']} for '{event.title}' "
                    f"({_shift_label(assignment)})"
                ),
                changes={
                    "event_id": event_id,
                    "user_id": assignment.user_id,
                    "position_id": assignment.position_id,
                    "starts_at": (
                        assignment.starts_at.isoformat()
                        if assignment.starts_at
                        else None
                    ),
                    "ends_at": (
                        assignment.ends_at.isoformat() if assignment.ends_at else None
                    ),
                },
            )

        # A single POST answers with the row itself; a batch answers with a list.
        return success_response(
            created[0] if len(created) == 1 else {"assignments": created}, 201
        )


@position_bp.route("/assignments/<int:assignment_id>", methods=["PATCH"])
@require_admin
def update_assignment_route(user_id, assignment_id):
    with get_db() as (conn, cur):
        try:
            payload = AssignmentUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        before = get_assignment_by_id(cur, assignment_id)
        if before is None:
            raise APIError(
                "NOT_FOUND", f"Assignment {assignment_id} does not exist", 404
            )

        # Validate the window the row will end up with, not just what was sent,
        # so moving one end of a shift past the other is still caught.
        starts_at = payload.starts_at if "starts_at" in requested else before["starts_at"]
        ends_at = payload.ends_at if "ends_at" in requested else before["ends_at"]
        _validate_window(_naive(starts_at), _naive(ends_at))

        if "position_id" in requested and requested["position_id"] is not None:
            _require_position(cur, requested["position_id"])

        if "user_id" in requested and requested["user_id"] is not None:
            _require_signed_up(cur, before["event_id"], requested["user_id"])

        try:
            updated = update_assignment(cur, assignment_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "The member or position referenced by this assignment does not exist",
                422,
            )

        if updated is None:
            raise APIError(
                "NOT_FOUND", f"Assignment {assignment_id} does not exist", 404
            )

        after = get_assignment_by_id(cur, assignment_id)
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
                entity_type="event_assignment",
                entity_id=assignment_id,
                summary=(
                    f"Updated {before['first_name']} {before['last_name']}'s "
                    f"{before['position_name']} shift for "
                    f"'{before['event_title']}' ({', '.join(changes)})"
                ),
                changes=changes,
            )

        return success_response(after, 200)


@position_bp.route("/assignments/<int:assignment_id>", methods=["DELETE"])
@require_admin
def delete_assignment_route(user_id, assignment_id):
    with get_db() as (conn, cur):
        before = get_assignment_by_id(cur, assignment_id)
        if before is None:
            raise APIError(
                "NOT_FOUND", f"Assignment {assignment_id} does not exist", 404
            )

        deleted = delete_assignment(cur, assignment_id)
        if deleted is None:
            raise APIError(
                "NOT_FOUND", f"Assignment {assignment_id} does not exist", 404
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="event_assignment",
            entity_id=assignment_id,
            summary=(
                f"Removed {before['first_name']} {before['last_name']} from "
                f"{before['position_name']} at '{before['event_title']}'"
            ),
        )

        return success_response({"deleted": deleted}, 200)


@position_bp.route("/assignments/me", methods=["GET"])
@require_auth
def my_assignments(user_id):
    """The caller's own shifts. Upcoming only by default — the point is what is
    coming, not a history."""
    with get_db() as (conn, cur):
        upcoming_only = bool_arg("upcoming", default=True)
        return success_response(
            get_user_assignments(cur, user_id, upcoming_only=upcoming_only), 200
        )


@position_bp.route("/assignments/coverage", methods=["GET"])
@require_admin
def assignment_coverage(user_id):
    """One row per event with staffing counts, for the admin shifts tab."""
    with get_db() as (conn, cur):
        future_only = bool_arg("future", default=True)
        limit = int_arg("limit", default=25, minimum=1, maximum=100)
        return success_response(
            get_event_shift_summary(cur, future_only=future_only, limit=limit), 200
        )
