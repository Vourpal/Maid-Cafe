from flask import Blueprint, request
from pydantic import ValidationError
from models import Event, EventUpdate
from queries.event_queries import (
    get_admin_event_info,
    get_event_by_id,
    get_events_paginated,
    get_total_events,
    create_event,
    update_event,
    delete_event,
)
from middleware import require_admin, require_auth
from queries.user_queries import get_me
from utils import success_response, APIError, get_db

event_bp = Blueprint("events", __name__)


@event_bp.route("/events", methods=["GET"])
def get_events():
    with get_db() as (conn, cur):
        page = int(request.args.get("page", 1))
        quantity = int(request.args.get("quantity", 10))
        offset = (page - 1) * quantity
        min_capacity = request.args.get("min_capacity")
        search = request.args.get("search_term")

        events = get_events_paginated(cur, quantity, offset, min_capacity, search)
        total = get_total_events(cur, search)

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
        event_id = create_event(cur, posted_event)
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
            updated_id = update_event(cur, event_id, updated_event)
            return success_response({"id": updated_id}, 200)

        elif request.method == "DELETE":
            deleted_id = delete_event(cur, event_id)
            if deleted_id is None:
                raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
            return success_response({"deleted": deleted_id}, 200)