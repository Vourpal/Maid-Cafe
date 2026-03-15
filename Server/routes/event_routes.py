from flask import Blueprint, request

from db import connect_db
from models import Event, EventUpdate
from queries.event_queries import get_event_by_id, get_events_paginated, get_total_events, create_event, update_event, delete_event
from utils import success_response, APIError

event_bp = Blueprint("events", __name__)


@event_bp.route("/events", methods=["GET", "POST"])
def events_collection():
    conn = connect_db()
    cur = conn.cursor()

    try:
        if request.method == "GET":
            page = int(request.args.get("page", 1))
            quantity = int(request.args.get("quantity", 10))
            offset = (page - 1) * quantity
            min_capacity = request.args.get("min_capacity")

            events = get_events_paginated(cur, quantity, offset, min_capacity)
            total = get_total_events(cur)

            if len(events) == 0:
                raise APIError("EVENTS_NOT_FOUND", "No events found", 404)

            return success_response({
                "page": page,
                "quantity": quantity,
                "count": len(events),
                "total": total,
                "events": [event.model_dump() for event in events],
            }, 200)

        elif request.method == "POST":
            data = request.get_json()
            posted_event = Event(**data)
            event_id = create_event(cur, posted_event)
            conn.commit()
            return success_response({"id": event_id}, 201)

    finally:
        conn.close()


@event_bp.route("/events/<int:event_id>", methods=["GET", "PATCH", "DELETE"])
def event_detail(event_id):
    conn = connect_db()
    cur = conn.cursor()
    try:
        if request.method == "GET":
            event = get_event_by_id(cur, event_id)
            if event is None:
                raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
            return success_response(event.model_dump(), 200)

        elif request.method == "PATCH":
            data = request.get_json()
            updated_event = EventUpdate(**data)
            updated_id = update_event(cur, event_id, updated_event)
            conn.commit()
            return success_response({"id": updated_id}, 200)

        elif request.method == "DELETE":
            deleted_id = delete_event(cur, event_id)
            if deleted_id is None:
                raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)
            conn.commit()
            return success_response({"deleted": deleted_id}, 200)

    finally:
        conn.close()
