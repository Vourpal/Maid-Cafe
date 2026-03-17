from flask import Blueprint, request

from auth import verify_token
from db import connect_db
from queries.attendance_queries import (
    delete_attendance,
    get_attendances_by_user,
    post_attendance,
    update_attendance,
)
from models import NewAttendance, UpdatedAttendance
from utils import APIError, success_response


attendance_bp = Blueprint("attendances", __name__)


@attendance_bp.route("/attendances/me", methods=["GET", "POST", "DELETE"])
def my_attendances():
    token = request.cookies.get("token")

    if not token:
        raise APIError("UNAUTHORIZED", "Not logged in", 401)

    user_id = verify_token(token)

    if not user_id:
        raise APIError("UNAUTHORIZED", "Invalid token", 401)

    conn = connect_db()
    cur = conn.cursor()
    # for the toggle of events pertaining the user
    try:
        if request.method == "GET":
            attendances = get_attendances_by_user(cur, user_id)
            return success_response([a.model_dump() for a in attendances])

        elif request.method == "POST":
            data = request.get_json()
            data_post = NewAttendance(
                **data, user_id=user_id
            )  # want user_id from token not body
            new_attendance = post_attendance(cur, data_post)
            conn.commit()
            return success_response({"id": new_attendance}, 201)

    finally:
        conn.close()


@attendance_bp.route("/attendances/<int:attendance_id>", methods=["PATCH", "DELETE"])
def attendance_detail(attendance_id):
    token = request.cookies.get("token")

    if not token:
        raise APIError("UNAUTHORIZED", "Not logged in", 401)

    user_id = verify_token(token)

    if not user_id:
        raise APIError("UNAUTHORIZED", "Invalid token", 401)

    conn = connect_db()
    cur = conn.cursor()

    try:
        if request.method == "PATCH":
            data = request.get_json()
            attendance_data = UpdatedAttendance(**data)
            edited_attendance = update_attendance(cur, attendance_id, attendance_data)
            if edited_attendance is None:
                raise APIError(
                    "ATTENDANCE_NOT_FOUND",
                    f"Attendance {attendance_id} does not exist",
                    404,
                )
            conn.commit()
            return success_response({"updated": edited_attendance}, 200)
        elif request.method == "DELETE":
            deleted = delete_attendance(cur, attendance_id)
            if deleted is None:
                raise APIError(
                    "ATTENDANCE_NOT_FOUND",
                    f"Attendance {attendance_id} does not exist",
                    404,
                )
            conn.commit()
            return success_response({"deleted": deleted}, 200)
    finally:
        conn.close()
