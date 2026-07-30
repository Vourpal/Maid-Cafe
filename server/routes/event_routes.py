from flask import Blueprint, request
from pydantic import ValidationError
from psycopg2 import errors as pg_errors
from models import AdminAttendanceCreate, Event, EventUpdate, NewAttendance
from queries.attendance_queries import (
    get_attendance_by_user_and_event,
    get_carpool_snapshot,
    get_event_attendances,
    post_attendance,
)
from queries.audit_queries import diff_changes, record_audit
from queries.event_queries import (
    get_admin_event_info,
    get_event_by_id,
    get_events_paginated,
    get_total_events,
    create_event,
    update_event,
    delete_event,
)
from queries.task_queries import get_tasks_for_event
from middleware import require_admin, require_auth
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

event_bp = Blueprint("events", __name__)


@event_bp.route("/events", methods=["GET"])
def get_events():
    with get_db() as (conn, cur):
        # pagination_args coerces and clamps; previously non-numeric page or
        # quantity raised ValueError and surfaced as a 500.
        page, quantity, offset = pagination_args(default_quantity=10, max_quantity=200)
        min_capacity = int_arg("min_capacity", minimum=0)
        search = str_arg("search_term")
        future_only = bool_arg("future_only", default=False)

        events = get_events_paginated(
            cur, quantity, offset, min_capacity, search, future_only
        )
        total = get_total_events(cur, search, future_only)

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(events),
                "total": total,
                "events": [event.model_dump() for event in events],
            },
            200,
        )


@event_bp.route("/events", methods=["POST"])
@require_admin
def create_event_route(user_id):
    with get_db() as (conn, cur):
        data = request.get_json()
        try:
            posted_event = Event(**data)
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        if posted_event.end_datetime < posted_event.start_datetime:
            raise APIError(
                "VALIDATION_ERROR", "End time must be after the start time", 422
            )

        event_id = create_event(cur, posted_event)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="event",
            entity_id=event_id,
            summary=f"Created event '{posted_event.title}'",
        )

        return success_response({"id": event_id}, 201)


@event_bp.route("/events/<int:event_id>", methods=["GET"])
def get_event(event_id):
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
        return success_response(event.model_dump(), 200)


@event_bp.route("/events/<int:event_id>/admin_info", methods=["GET"])
@require_admin
def get_admin_event_info_route(event_id, user_id):
    with get_db() as (conn, cur):
        event_info = get_admin_event_info(cur, event_id)
        if event_info is None:
            raise APIError(
                "ADMIN_INFO_NOT_FOUND",
                f"Detailed information for Event {event_id} does not exist",
                404,
            )
        return success_response(event_info.model_dump(), 200)


@event_bp.route("/events/<int:event_id>/attendances", methods=["GET"])
@require_admin
def event_roster(user_id, event_id):
    """Editable roster for one event.

    Unlike /admin_info this includes each attendance id, which is what an admin
    needs in order to correct or remove somebody else's RSVP.
    """
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        roster = get_event_attendances(cur, event_id)
        total_seats, passengers = get_carpool_snapshot(cur, event_id)
        going = sum(1 for r in roster if r["status"] == "going")

        return success_response(
            {
                "event": {
                    "id": event.id,
                    "title": event.title,
                    "start_datetime": event.start_datetime.isoformat(),
                    "end_datetime": event.end_datetime.isoformat(),
                    "location": event.location,
                    "max_attendees": event.max_attendees,
                    "status": event.status,
                },
                "summary": {
                    "attendees": len(roster),
                    "going": going,
                    "seats_offered": total_seats,
                    "passengers": passengers,
                    "seats_left": max(0, total_seats - passengers),
                    "spots_left": (
                        event.max_attendees - going if event.max_attendees else None
                    ),
                },
                "attendances": roster,
            },
            200,
        )


@event_bp.route("/events/<int:event_id>/attendances", methods=["POST"])
@require_admin
def admin_add_attendance(user_id, event_id):
    """Sign a member up on their behalf — for RSVPs relayed in person or over
    chat rather than entered by the member."""
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        try:
            payload = AdminAttendanceCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        existing = get_attendance_by_user_and_event(cur, payload.user_id, event_id)
        if existing:
            raise APIError(
                "ALREADY_SIGNED_UP",
                "That member already has an RSVP for this event. Edit it instead.",
                409,
            )

        if payload.role == "Passenger":
            total_seats, passengers = get_carpool_snapshot(cur, event_id)
            if passengers >= total_seats:
                raise APIError(
                    "NO_SEATS_AVAILABLE",
                    "No passenger seats are available for this event.",
                    409,
                )

        new_attendance = NewAttendance(
            user_id=payload.user_id,
            event_id=event_id,
            status=payload.status,
            notes=payload.notes,
            role=payload.role,
            seats_available=payload.seats_available,
        )

        try:
            attendance_id = post_attendance(cur, new_attendance)
        except pg_errors.ForeignKeyViolation:
            raise APIError("USER_NOT_FOUND", "That member does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="attendance",
            entity_id=attendance_id,
            summary=(
                f"Added user {payload.user_id} to '{event.title}' "
                f"as {payload.status}"
            ),
            changes={
                "status": payload.status,
                "role": payload.role,
                "seats_available": payload.seats_available,
            },
        )

        return success_response({"id": attendance_id}, 201)


@event_bp.route("/events/<int:event_id>/tasks", methods=["GET"])
@require_auth
def event_tasks(user_id, event_id):
    """Tasks attached to an event, so the roster and its to-do list can be
    reviewed together."""
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
        return success_response(get_tasks_for_event(cur, event_id), 200)


@event_bp.route("/events/<int:event_id>", methods=["PATCH", "DELETE"])
@require_auth
def event_detail(event_id, user_id):
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
        if user_id != event.created_by and not current_user.admin:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        if request.method == "PATCH":
            data = request.get_json()
            try:
                updated_event = EventUpdate(**data)
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)

            requested = updated_event.model_dump(exclude_unset=True)

            # Validate against the merged result so patching one end of the
            # window cannot invert it.
            new_start = updated_event.start_datetime or event.start_datetime
            new_end = updated_event.end_datetime or event.end_datetime
            if new_end < new_start:
                raise APIError(
                    "VALIDATION_ERROR", "End time must be after the start time", 422
                )

            updated_id = update_event(cur, event_id, updated_event)

            before = {
                "title": event.title,
                "description": event.description,
                "location": event.location,
                "max_attendees": event.max_attendees,
                "status": event.status,
                "start_datetime": event.start_datetime.isoformat(),
                "end_datetime": event.end_datetime.isoformat(),
            }
            after = dict(before)
            for key, value in requested.items():
                after[key] = value.isoformat() if hasattr(value, "isoformat") else value

            changes = diff_changes(before, after)
            if changes:
                record_audit(
                    cur,
                    actor_id=user_id,
                    actor=current_user,
                    action="update",
                    entity_type="event",
                    entity_id=event_id,
                    summary=f"Updated event '{event.title}' ({', '.join(changes)})",
                    changes=changes,
                )

            return success_response({"id": updated_id}, 200)

        elif request.method == "DELETE":
            deleted_id = delete_event(cur, event_id)
            if deleted_id is None:
                raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

            record_audit(
                cur,
                actor_id=user_id,
                actor=current_user,
                action="delete",
                entity_type="event",
                entity_id=event_id,
                summary=f"Deleted event '{event.title}'",
                changes={"title": event.title, "status": event.status},
            )

            return success_response({"deleted": deleted_id}, 200)
