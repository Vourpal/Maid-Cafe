from flask import Blueprint, request
from pydantic import ValidationError

from queries.attendance_queries import (
    delete_attendance,
    get_attendance_by_id,
    get_attendances_by_user,
    post_attendance,
    update_attendance,
)
from models import NewAttendance, UpdatedAttendance
from middleware import require_auth
from utils import APIError, success_response, get_db


attendance_bp = Blueprint("attendances", __name__)


@attendance_bp.route("/attendances/me", methods=["GET", "POST"])
@require_auth
def my_attendance(user_id):
    with get_db() as (conn, cur):
        if request.method == "GET":
            attendances = get_attendances_by_user(cur, user_id)
            return success_response([a.model_dump() for a in attendances])

        elif request.method == "POST":
            data = request.get_json()
            try:
                data_post = NewAttendance(**data, user_id=user_id)  # want user_id from token not body
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)
            new_attendance = post_attendance(cur, data_post)
            return success_response({"id": new_attendance}, 201)


@attendance_bp.route("/attendances/<int:attendance_id>", methods=["PATCH", "DELETE"])
@require_auth
def attendance_detail(user_id, attendance_id):
    with get_db() as (conn, cur):
        attendance = get_attendance_by_id(cur, attendance_id)
        if attendance is None:
            raise APIError("ATTENDANCE_NOT_FOUND", f"Attendance {attendance_id} does not exist", 404)
        if attendance.user_id != user_id:
            raise APIError("FORBIDDEN", "Not your attendance", 403)

        if request.method == "PATCH":
            data = request.get_json()
            try:
                attendance_data = UpdatedAttendance(**data)
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)
            edited_attendance = update_attendance(cur, attendance_id, attendance_data)
            if edited_attendance is None:
                raise APIError("ATTENDANCE_NOT_FOUND", f"Attendance {attendance_id} does not exist", 404)
            return success_response({"updated": edited_attendance}, 200)

        elif request.method == "DELETE":
            deleted = delete_attendance(cur, attendance_id)
            if deleted is None:
                raise APIError("ATTENDANCE_NOT_FOUND", f"Attendance {attendance_id} does not exist", 404)
            return success_response({"deleted": deleted}, 200)