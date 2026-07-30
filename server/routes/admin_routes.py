"""Admin dashboard, reliability reports, and audit log."""

from flask import Blueprint

from middleware import require_admin
from queries.admin_queries import (
    get_event_stats,
    get_invite_stats,
    get_link_stats,
    get_next_practice_session,
    get_practice_stats,
    get_staff_stats,
    get_upcoming_events_with_signups,
)
from queries.attendance_queries import get_event_attendance_report
from queries.audit_queries import (
    ACTIONS,
    count_audit_log,
    get_audit_entity_types,
    get_audit_log,
)
from queries.practice_queries import (
    get_practice_attendance_report,
    get_session_attendance_summary,
)
from queries.task_queries import get_task_stats, get_tasks
from utils import get_db, int_arg, pagination_args, str_arg, success_response

admin_bp = Blueprint("admin", __name__)

_REPORT_SORTS = {"attendance_rate", "late", "name"}


@admin_bp.route("/admin/dashboard", methods=["GET"])
@require_admin
def dashboard(user_id):
    """Everything the admin landing view needs, in one request.

    Replaces the previous approach of pulling every event down to the browser
    and counting client-side.
    """
    with get_db() as (conn, cur):
        upcoming_limit = int_arg("upcoming_limit", default=5, minimum=1, maximum=25)

        return success_response(
            {
                "staff": get_staff_stats(cur),
                "events": get_event_stats(cur),
                "practice": get_practice_stats(cur),
                "tasks": get_task_stats(cur),
                "invites": get_invite_stats(cur),
                "links": get_link_stats(cur),
                "upcoming_events": get_upcoming_events_with_signups(cur, upcoming_limit),
                "next_practice": get_next_practice_session(cur),
                "recent_sessions": get_session_attendance_summary(cur, 5),
                "attention": {
                    # Small, actionable list rather than a full task dump.
                    "overdue_tasks": get_tasks(
                        cur, limit=5, offset=0, overdue_only=True, sort="due_date"
                    ),
                    "unassigned_tasks": get_tasks(
                        cur,
                        limit=5,
                        offset=0,
                        unassigned=True,
                        completed=False,
                        sort="due_date",
                    ),
                },
                "recent_activity": get_audit_log(cur, limit=8, offset=0),
            },
            200,
        )


@admin_bp.route("/admin/reports/practice-attendance", methods=["GET"])
@require_admin
def practice_attendance_report(user_id):
    """Per-member practice reliability, plus turnout per recent session."""
    with get_db() as (conn, cur):
        sort = str_arg("sort", default="attendance_rate", allowed=_REPORT_SORTS)
        session_limit = int_arg("session_limit", default=15, minimum=1, maximum=100)

        report = get_practice_attendance_report(cur, sort=sort)

        return success_response(
            {
                "sessions_held": report["sessions_held"],
                "members": report["rows"],
                "sessions": get_session_attendance_summary(cur, session_limit),
            },
            200,
        )


@admin_bp.route("/admin/reports/event-attendance", methods=["GET"])
@require_admin
def event_attendance_report(user_id):
    """Per-member event participation: RSVPs, going/maybe/declined, driving."""
    with get_db() as (conn, cur):
        return success_response(
            {"members": get_event_attendance_report(cur)},
            200,
        )


@admin_bp.route("/audit-log", methods=["GET"])
@require_admin
def audit_log(user_id):
    with get_db() as (conn, cur):
        page, quantity, offset = pagination_args(default_quantity=50, max_quantity=200)
        entity_type = str_arg("entity_type")
        action = str_arg("action", allowed=ACTIONS)
        actor_id = int_arg("actor_id")
        search = str_arg("search")

        entries = get_audit_log(
            cur,
            limit=quantity,
            offset=offset,
            entity_type=entity_type,
            action=action,
            actor_id=actor_id,
            search=search,
        )
        total = count_audit_log(
            cur,
            entity_type=entity_type,
            action=action,
            actor_id=actor_id,
            search=search,
        )

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(entries),
                "total": total,
                "entity_types": get_audit_entity_types(cur),
                "actions": sorted(ACTIONS),
                "entries": entries,
            },
            200,
        )
