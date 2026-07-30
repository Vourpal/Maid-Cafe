"""CSV exports for admins.

Every endpoint streams a downloadable file rather than JSON, for printing
rosters or sharing data outside the portal. All are admin-only — these payloads
include contact details and attendance records.
"""

from flask import Blueprint

from middleware import require_admin
from queries.attendance_queries import (
    get_event_attendance_report,
    get_event_attendances,
)
from queries.audit_queries import get_audit_log
from queries.event_queries import get_event_by_id
from queries.practice_queries import (
    get_practice_attendance,
    get_practice_attendance_report,
    get_practice_session_by_id,
)
from queries.task_queries import get_tasks
from queries.user_queries import get_users
from utils import APIError, csv_response, get_db, int_arg, str_arg

export_bp = Blueprint("exports", __name__)


def _slug(value: str) -> str:
    """Filename-safe version of an event or session title."""
    cleaned = "".join(c if c.isalnum() or c in "-_ " else "" for c in (value or ""))
    return "-".join(cleaned.split()).lower() or "export"


def _yes_no(value) -> str:
    return "Yes" if value else "No"


@export_bp.route("/exports/staff.csv", methods=["GET"])
@require_admin
def export_staff(user_id):
    with get_db() as (conn, cur):
        search = str_arg("search")
        # A high limit rather than the paged default: an export should contain
        # everything that matches, not just the current page.
        staff = get_users(cur, limit=1000, offset=0, search=search, sort="name")

        rows = [
            [
                member.last_name,
                member.first_name,
                member.username,
                member.email,
                member.type or "",
                _yes_no(member.admin),
                _yes_no(member.active),
            ]
            for member in staff
        ]

        return csv_response(
            "staff.csv",
            [
                "Last Name",
                "First Name",
                "Username",
                "Email",
                "Type",
                "Admin",
                "Active",
            ],
            rows,
        )


@export_bp.route("/exports/events/<int:event_id>/roster.csv", methods=["GET"])
@require_admin
def export_event_roster(user_id, event_id):
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        roster = get_event_attendances(cur, event_id)

        rows = [
            [
                r["last_name"],
                r["first_name"],
                r["username"],
                r["type"] or "",
                r["status"],
                r["role"] or "",
                r["seats_available"] if r["seats_available"] is not None else "",
                r["notes"] or "",
            ]
            for r in roster
        ]

        return csv_response(
            f"roster-{_slug(event.title)}.csv",
            [
                "Last Name",
                "First Name",
                "Username",
                "Type",
                "RSVP",
                "Carpool Role",
                "Seats",
                "Notes",
            ],
            rows,
        )


@export_bp.route(
    "/exports/practice-sessions/<int:practice_id>/attendance.csv", methods=["GET"]
)
@require_admin
def export_practice_attendance(user_id, practice_id):
    with get_db() as (conn, cur):
        session = get_practice_session_by_id(cur, practice_id)
        if session is None:
            raise APIError(
                "NOT_FOUND", f"Practice session {practice_id} not found", 404
            )

        attendance = get_practice_attendance(cur, practice_id)

        rows = [
            [
                r["last_name"],
                r["first_name"],
                _yes_no(r["attended"]),
                _yes_no(r["late"]),
                r["notes"] or "",
            ]
            for r in attendance
        ]

        return csv_response(
            f"attendance-{_slug(session.title)}.csv",
            ["Last Name", "First Name", "Attended", "Late", "Notes"],
            rows,
        )


@export_bp.route("/exports/reports/practice-attendance.csv", methods=["GET"])
@require_admin
def export_practice_report(user_id):
    with get_db() as (conn, cur):
        report = get_practice_attendance_report(cur)

        rows = [
            [
                r["last_name"],
                r["first_name"],
                r["username"],
                r["type"] or "",
                r["recorded"],
                r["attended"],
                r["absent"],
                r["late"],
                f"{r['attendance_rate']}%" if r["attendance_rate"] is not None else "",
                r["last_attended"] or "",
            ]
            for r in report["rows"]
        ]

        return csv_response(
            "practice-attendance-report.csv",
            [
                "Last Name",
                "First Name",
                "Username",
                "Type",
                "Sessions Recorded",
                "Attended",
                "Absent",
                "Late",
                "Attendance Rate",
                "Last Attended",
            ],
            rows,
        )


@export_bp.route("/exports/reports/event-attendance.csv", methods=["GET"])
@require_admin
def export_event_report(user_id):
    with get_db() as (conn, cur):
        rows = [
            [
                r["last_name"],
                r["first_name"],
                r["username"],
                r["type"] or "",
                r["rsvps"],
                r["going"],
                r["maybe"],
                r["declined"],
                r["driving"],
            ]
            for r in get_event_attendance_report(cur)
        ]

        return csv_response(
            "event-attendance-report.csv",
            [
                "Last Name",
                "First Name",
                "Username",
                "Type",
                "Total RSVPs",
                "Going",
                "Maybe",
                "Declined",
                "Times Driving",
            ],
            rows,
        )


@export_bp.route("/exports/tasks.csv", methods=["GET"])
@require_admin
def export_tasks(user_id):
    with get_db() as (conn, cur):
        tasks = get_tasks(cur, limit=1000, offset=0, sort="status")

        rows = [
            [
                t["title"],
                t["description"] or "",
                (
                    f"{t['assignee']['first_name']} {t['assignee']['last_name']}"
                    if t["assignee"]
                    else "Unassigned"
                ),
                t["event_title"] or "",
                t["due_date"] or "",
                "Complete" if t["completed"] else "Open",
                t["created_at"] or "",
            ]
            for t in tasks
        ]

        return csv_response(
            "tasks.csv",
            [
                "Title",
                "Description",
                "Assigned To",
                "Event",
                "Due Date",
                "Status",
                "Created",
            ],
            rows,
        )


@export_bp.route("/exports/audit-log.csv", methods=["GET"])
@require_admin
def export_audit_log(user_id):
    with get_db() as (conn, cur):
        limit = int_arg("limit", default=1000, minimum=1, maximum=5000)
        entries = get_audit_log(cur, limit=limit, offset=0)

        rows = [
            [
                e["created_at"],
                e["actor_label"] or "System",
                e["action"],
                e["entity_type"],
                e["entity_id"] if e["entity_id"] is not None else "",
                e["summary"] or "",
            ]
            for e in entries
        ]

        return csv_response(
            "audit-log.csv",
            ["Timestamp", "Actor", "Action", "Entity", "Entity ID", "Summary"],
            rows,
        )
