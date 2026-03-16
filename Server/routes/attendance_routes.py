from flask import Blueprint, request

from auth import verify_token
from db import connect_db
from queries.attendance_queries import get_attendances_by_user
from utils import APIError, success_response


attendance_bp = Blueprint("attendances", __name__)


@attendance_bp.route("/attendances/me", methods=["GET"])
def my_attendances():
    token = request.cookies.get("token")

    if not token:
        raise APIError("UNAUTHORIZED", "Not logged in", 401)

    user_id = verify_token(token)

    if not user_id:
        raise APIError("UNAUTHORIZED", "Invalid token", 401)

    conn = connect_db()
    cur = conn.cursor()

    try:
        attendances = get_attendances_by_user(cur, user_id)

        return success_response([a.model_dump() for a in attendances])
    finally:
        conn.close()

