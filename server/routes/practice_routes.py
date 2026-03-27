from flask import Blueprint, request
from pydantic import ValidationError

from middleware import require_admin, require_auth
from queries.practice_queries import (
    delete_practice_sessions,
    get_all_practice_sessions,
    post_practice_sessions,
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
