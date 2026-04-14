from flask import Blueprint, request
from pydantic import ValidationError

from middleware import require_admin, require_auth
from queries.practice_queries import (
    add_practice_attendance,
    delete_practice_sessions,
    get_all_practice_sessions,
    get_practice_attendance,
    post_practice_sessions,
    update_practice_attendance,
)
from models import PracticeSession
from utils import APIError, get_db, success_response

practice_bp = Blueprint("practice", __name__)


# TODO: add validation errors
@practice_bp.route("/practice-sessions", methods=["GET"])
@require_auth
def get_practices(user_id):
    with get_db() as (conn, cur):
        data = get_all_practice_sessions(cur)
        print([d.model_dump() for d in data])
        return success_response([d.model_dump() for d in data], 200)


@practice_bp.route("/practice-sessions", methods=["POST"])
@require_admin
def post_practice(user_id):
    with get_db() as (conn, cur):
        data = request.get_json()
        try:
            posted_session = PracticeSession(**data)
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)
        session_id = post_practice_sessions(cur, posted_session)
        return success_response({"id": session_id}, 201)


@practice_bp.route("/practice-sessions/<int:practice_id>", methods=["DELETE"])
@require_admin
def delete_practice(user_id, practice_id):
    with get_db() as (conn, cur):
        deleted_id = delete_practice_sessions(cur, practice_id)
        if deleted_id is None:
            raise APIError(
                "NOT_FOUND", f"Practice session {practice_id} not found", 404
            )
        return success_response({"id": deleted_id}, 200)


@practice_bp.route("/practice-sessions/<int:practice_id>/attendance", methods=["POST"])
@require_admin
def add_attendance(user_id, practice_id):
    data = request.get_json()
    attendees = data.get("attendees", [])

    if not isinstance(attendees, list):
        raise APIError("VALIDATION_ERROR", "Attendees must be a list", 422)

    with get_db() as (conn, cur):
        try:
            add_practice_attendance(cur, practice_id, attendees)
            return success_response(
                {"message": "Attendance recorded", "count": len(attendees)}, 201
            )
        except Exception as e:
            print("Error:", e)
            raise APIError("DB_ERROR", "Failed to record attendance", 500)


@practice_bp.route("/practice-sessions/<int:practice_id>/attendance", methods=["GET"])
@require_auth
def get_attendance(user_id, practice_id):
    with get_db() as (conn, cur):
        data = get_practice_attendance(cur, practice_id)
        return success_response(data, 200)

@practice_bp.route("/practice-sessions/<int:practice_id>/attendance", methods=["PATCH"])
@require_admin
def edit_attendance(user_id, practice_id):
    data = request.get_json()
    updates = data.get("updates", [])

    if not isinstance(updates, list):
        raise APIError("VALIDATION_ERROR", "Invalid updates format", 422)

    with get_db() as (conn, cur):
        update_practice_attendance(cur, updates)
        return success_response({"updated": len(updates)}, 200)