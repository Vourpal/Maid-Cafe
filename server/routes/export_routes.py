"""CSV exports for admins.

Every endpoint streams a downloadable file rather than JSON, for printing
rosters or sharing data outside the portal. All are admin-only — these payloads
include contact details and attendance records.
"""

from datetime import datetime

from flask import Blueprint

from middleware import require_admin
from queries.attendance_queries import (
    get_event_attendance_report,
    get_event_attendances,
)
from queries.audit_queries import get_audit_log
from queries.costume_queries import get_costume_items, get_open_checkouts
from queries.event_queries import get_event_by_id
from queries.menu_queries import get_event_menu
from queries.position_queries import get_event_assignments, get_unassigned_signups
from queries.practice_queries import (
    get_practice_attendance,
    get_practice_attendance_report,
    get_practice_session_by_id,
)
from queries.task_queries import get_tasks
from queries.user_queries import get_users
from utils import APIError, bool_arg, csv_response, get_db, int_arg, str_arg

export_bp = Blueprint("exports", __name__)


def _slug(value: str) -> str:
    """Filename-safe version of an event or session title."""
    cleaned = "".join(c if c.isalnum() or c in "-_ " else "" for c in (value or ""))
    return "-".join(cleaned.split()).lower() or "export"


def _yes_no(value) -> str:
    return "Yes" if value else "No"


def _clock(value: str | None) -> str:
    """Time-only rendering for a printed schedule, where the date is in the
    heading and repeating it on every row is just noise."""
    if not value:
        return ""
    return datetime.fromisoformat(value).strftime("%I:%M %p").lstrip("0")


def _money(value) -> str:
    return f"{value:.2f}" if value is not None else ""


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


@export_bp.route("/exports/events/<int:event_id>/shifts.csv", methods=["GET"])
@require_admin
def export_event_shifts(user_id, event_id):
    """The shift schedule for one event, meant to be printed and pinned up on
    the day.

    Rows come back in time order and anybody on the roster without a job is
    listed at the bottom as unassigned, so the printout shows the whole crew
    rather than only the people who already have a position.
    """
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        rows = [
            [
                entry["position_name"],
                _clock(entry["starts_at"]) or "All day",
                _clock(entry["ends_at"]) or "All day",
                f"{entry['last_name']}, {entry['first_name']}",
                entry["username"],
                entry["type"] or "",
                entry["notes"] or "",
            ]
            for entry in get_event_assignments(cur, event_id, sort="time")
        ]

        rows.extend(
            [
                "— Unassigned —",
                "",
                "",
                f"{person['last_name']}, {person['first_name']}",
                person["username"],
                person["type"] or "",
                f"RSVP: {person['status']}",
            ]
            for person in get_unassigned_signups(cur, event_id)
        )

        return csv_response(
            f"shifts-{_slug(event.title)}.csv",
            ["Position", "Start", "End", "Name", "Username", "Type", "Notes"],
            rows,
        )


@export_bp.route("/exports/costumes.csv", methods=["GET"])
@require_admin
def export_costumes(user_id):
    """Full costume and prop inventory with current whereabouts.

    The status column is the derived one (available / assigned / in_repair /
    in_laundry / retired), and the holder columns are filled from the open
    checkout so the sheet doubles as a stocktake list.
    """
    with get_db() as (conn, cur):
        items = get_costume_items(
            cur,
            limit=2000,
            offset=0,
            category=str_arg("category"),
            search=str_arg("search"),
            availability=str_arg("status"),
            sort="category",
        )

        # One pass over the open checkouts rather than a query per item.
        holders: dict[int, list] = {}
        for checkout in get_open_checkouts(cur):
            holders.setdefault(checkout["item_id"], []).append(checkout)

        rows = []
        for item in items:
            out_with = holders.get(item["id"], [])
            names = "; ".join(
                f"{c['first_name']} {c['last_name']}" if c["first_name"] else "Group"
                for c in out_with
            )
            events = "; ".join(c["event_title"] for c in out_with if c["event_title"])

            rows.append(
                [
                    item["name"],
                    item["category"],
                    item["size"] or "",
                    item["color"] or "",
                    item["condition"],
                    item["status"],
                    "Group" if item["group_owned"] else (
                        f"{item['owner']['first_name']} {item['owner']['last_name']}"
                        if item["owner"]
                        else ""
                    ),
                    item["quantity"],
                    item["available_count"],
                    item["storage_location"] or "",
                    names,
                    events,
                    item["notes"] or "",
                ]
            )

        return csv_response(
            "costume-inventory.csv",
            [
                "Name",
                "Category",
                "Size",
                "Colour",
                "Condition",
                "Status",
                "Owner",
                "Quantity",
                "Available",
                "Storage",
                "Checked Out To",
                "For Event",
                "Notes",
            ],
            rows,
        )


@export_bp.route("/exports/events/<int:event_id>/menu.csv", methods=["GET"])
@require_admin
def export_event_menu(user_id, event_id):
    """One event's menu.

    Two shapes from one endpoint, because they are the same data ordered for two
    different jobs:

      * default — a printable menu: item, description, price, allergens
      * ?prep=true — a prep list: who is making what, how much, and notes
    """
    with get_db() as (conn, cur):
        event = get_event_by_id(cur, event_id)
        if event is None:
            raise APIError("EVENT_NOT_FOUND", f"Event {event_id} does not exist", 404)

        items = get_event_menu(cur, event_id)
        prep = bool_arg("prep", default=False)

        if prep:
            rows = [
                [
                    item["category"],
                    item["name"],
                    (
                        f"{item['assignee']['first_name']} "
                        f"{item['assignee']['last_name']}"
                        if item["assignee"]
                        else "Unassigned"
                    ),
                    item["quantity_planned"] if item["quantity_planned"] is not None else "",
                    _money(item["price"]),
                    item["allergens"] or "",
                    item["dietary"] or "",
                    item["notes"] or "",
                ]
                for item in items
            ]

            return csv_response(
                f"prep-list-{_slug(event.title)}.csv",
                [
                    "Category",
                    "Item",
                    "Prepared By",
                    "Planned Qty",
                    "Price",
                    "Allergens",
                    "Dietary",
                    "Notes",
                ],
                rows,
            )

        rows = [
            [
                item["category"],
                item["name"],
                item["description"] or "",
                _money(item["price"]),
                item["allergens"] or "",
                item["dietary"] or "",
            ]
            for item in items
        ]

        return csv_response(
            f"menu-{_slug(event.title)}.csv",
            ["Category", "Item", "Description", "Price", "Allergens", "Dietary"],
            rows,
        )
