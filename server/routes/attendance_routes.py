from flask import Blueprint, request
from pydantic import ValidationError

from queries.attendance_queries import (
    delete_attendance,
    get_attendance_by_id,
    get_attendances_by_user,
    get_carpool_snapshot,
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
                # user_id comes from the JWT, not the request body
                data_post = NewAttendance(**data, user_id=user_id)
            except ValidationError as e:
                raise APIError("VALIDATION_ERROR", str(e), 422)

            # ── Passenger seat check (race-condition safe via FOR UPDATE) ──
            if data_post.role == "Passenger":
                total_seats, passengers = get_carpool_snapshot(cur, data_post.event_id)
                if passengers >= total_seats:
                    raise APIError(
                        "NO_SEATS_AVAILABLE",
                        "No passenger seats are available for this event.",
                        409,
                    )

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

            # ── Passenger seat check on role change ──
            # Triggers when the user is switching TO Passenger from a different role.
            new_role = attendance_data.role
            was_passenger = attendance.role == "Passenger"
            becoming_passenger = new_role == "Passenger" and not was_passenger

            if becoming_passenger:
                total_seats, passengers = get_carpool_snapshot(cur, attendance.event_id)
                if passengers >= total_seats:
                    raise APIError(
                        "NO_SEATS_AVAILABLE",
                        "No passenger seats are available for this event.",
                        409,
                    )

            # ── Driver reducing seats check ──
            # If a driver reduces their seats_available below the current passenger
            # count, that would strand passengers — reject it.
            if attendance.role == "Driver" and attendance_data.seats_available is not None:
                total_seats, passengers = get_carpool_snapshot(cur, attendance.event_id)
                # Current driver's contribution to total_seats; new total if they reduce
                current_driver_seats = attendance.seats_available or 0
                new_driver_seats = attendance_data.seats_available
                new_total = total_seats - current_driver_seats + new_driver_seats
                if passengers > new_total:
                    raise APIError(
                        "SEATS_BELOW_PASSENGERS",
                        f"Cannot reduce seats to {new_driver_seats} — {passengers} passenger(s) are already signed up.",
                        409,
                    )

            edited_attendance = update_attendance(cur, attendance_id, attendance_data)
            if edited_attendance is None:
                raise APIError("ATTENDANCE_NOT_FOUND", f"Attendance {attendance_id} does not exist", 404)
            return success_response({"updated": edited_attendance}, 200)

        elif request.method == "DELETE":
            deleted = delete_attendance(cur, attendance_id)
            if deleted is None:
                raise APIError("ATTENDANCE_NOT_FOUND", f"Attendance {attendance_id} does not exist", 404)
            return success_response({"deleted": deleted}, 200)


@attendance_bp.route("/attendances/carpool/<int:event_id>", methods=["GET"])
@require_auth
def carpool_status(user_id, event_id):
    """Returns current seat availability so the frontend can show it before sign-up."""
    with get_db() as (conn, cur):
        total_seats, passengers = get_carpool_snapshot(cur, event_id)
        seats_left = max(0, total_seats - passengers)
        return success_response({
            "total_seats": total_seats,
            "passengers": passengers,
            "seats_left": seats_left,
        })
