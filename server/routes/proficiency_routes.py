"""Routine proficiency — who knows which routine, and how well.

The admin view is a grid of members × routines. The payload is deliberately
three flat lists (members, routines, entries) rather than a pre-built matrix:
most cells are empty, so sending only the real records keeps the response small
and lets the client render the grid whichever way round it likes.
"""

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import ProficiencyBulkSet, ProficiencySet
from queries.audit_queries import record_audit
from queries.practice_queries import get_all_routines, get_routine_by_id
from queries.proficiency_queries import (
    LEVELS,
    delete_proficiency,
    get_proficiency_entries,
    get_routine_proficiency,
    get_routine_readiness,
    get_user_proficiency,
    set_proficiency,
)
from queries.user_queries import get_me, get_users
from utils import APIError, bool_arg, get_db, success_response

proficiency_bp = Blueprint("proficiency", __name__)

_LEVEL_LABELS = {
    "learning": "learning",
    "can_perform": "able to perform",
    "lead": "lead",
}


def _validate_level(level: str):
    if level not in LEVELS:
        raise APIError(
            "VALIDATION_ERROR",
            f"Level must be one of: {', '.join(LEVELS)}",
            422,
        )


def _require_routine(cur, routine_id: int):
    routine = get_routine_by_id(cur, routine_id)
    if routine is None:
        raise APIError("NOT_FOUND", f"Routine {routine_id} does not exist", 404)
    return routine


@proficiency_bp.route("/proficiency/matrix", methods=["GET"])
@require_admin
def proficiency_matrix(user_id):
    """Everything the grid needs in one request."""
    with get_db() as (conn, cur):
        include_inactive = bool_arg("include_inactive", default=False)

        members = get_users(
            cur,
            limit=1000,
            offset=0,
            sort="name",
            active=None if include_inactive else True,
        )

        return success_response(
            {
                "members": [
                    {
                        "id": member.id,
                        "first_name": member.first_name,
                        "last_name": member.last_name,
                        "username": member.username,
                        "type": member.type,
                        "active": member.active,
                    }
                    for member in members
                ],
                "routines": get_all_routines(cur),
                "entries": get_proficiency_entries(cur),
                "readiness": get_routine_readiness(cur),
            },
            200,
        )


@proficiency_bp.route("/proficiency/readiness", methods=["GET"])
@require_auth
def proficiency_readiness(user_id):
    """Per-routine head counts: how many people could perform it today."""
    with get_db() as (conn, cur):
        return success_response(get_routine_readiness(cur), 200)


@proficiency_bp.route("/proficiency/me", methods=["GET"])
@require_auth
def my_proficiency(user_id):
    """The caller's own routine list."""
    with get_db() as (conn, cur):
        return success_response(get_user_proficiency(cur, user_id), 200)


@proficiency_bp.route("/routines/<int:routine_id>/proficiency", methods=["GET"])
@require_auth
def routine_proficiency(user_id, routine_id):
    """One routine's roster plus its readiness numbers."""
    with get_db() as (conn, cur):
        routine = _require_routine(cur, routine_id)
        readiness = get_routine_readiness(cur, routine_id)

        return success_response(
            {
                "routine": routine,
                "readiness": readiness[0] if readiness else None,
                "members": get_routine_proficiency(cur, routine_id),
            },
            200,
        )


@proficiency_bp.route("/routines/<int:routine_id>/proficiency", methods=["POST"])
@require_admin
def set_routine_proficiency(user_id, routine_id):
    """Set one member's level for one routine. Upsert: re-posting the same pair
    updates the level rather than failing on the unique constraint."""
    with get_db() as (conn, cur):
        try:
            payload = ProficiencySet(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        _validate_level(payload.level)
        routine = _require_routine(cur, routine_id)

        # Snapshot the previous level so the audit entry reads as a transition
        # rather than just "set to lead".
        before = {
            row["user_id"]: row["level"]
            for row in get_routine_proficiency(cur, routine_id)
        }.get(payload.user_id)

        try:
            set_proficiency(cur, routine_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                f"User {payload.user_id} does not exist",
                422,
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="update" if before else "create",
            entity_type="routine_proficiency",
            entity_id=routine_id,
            summary=(
                f"Set member {payload.user_id} to "
                f"{_LEVEL_LABELS[payload.level]} on '{routine['name']}'"
            ),
            changes={"user_id": payload.user_id, "level": {"from": before, "to": payload.level}},
        )

        return success_response(
            {
                "readiness": (get_routine_readiness(cur, routine_id) or [None])[0],
                "members": get_routine_proficiency(cur, routine_id),
            },
            200,
        )


@proficiency_bp.route("/routines/<int:routine_id>/proficiency", methods=["PUT"])
@require_admin
def set_routine_proficiency_bulk(user_id, routine_id):
    """Save a whole column of the grid at once.

    All-or-nothing: get_db() only commits if every entry validates, so a typo in
    one row cannot leave the routine half-updated.
    """
    with get_db() as (conn, cur):
        try:
            payload = ProficiencyBulkSet(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        if not payload.entries:
            raise APIError("BAD_REQUEST", "No entries supplied", 400)

        routine = _require_routine(cur, routine_id)

        for entry in payload.entries:
            _validate_level(entry.level)

        try:
            for entry in payload.entries:
                set_proficiency(cur, routine_id, entry)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "One of those members does not exist",
                422,
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="update",
            entity_type="routine_proficiency",
            entity_id=routine_id,
            summary=(
                f"Updated proficiency for {len(payload.entries)} member(s) on "
                f"'{routine['name']}'"
            ),
            changes={
                "entries": [
                    {"user_id": entry.user_id, "level": entry.level}
                    for entry in payload.entries
                ]
            },
        )

        return success_response(
            {
                "readiness": (get_routine_readiness(cur, routine_id) or [None])[0],
                "members": get_routine_proficiency(cur, routine_id),
            },
            200,
        )


@proficiency_bp.route(
    "/routines/<int:routine_id>/proficiency/<int:member_id>", methods=["DELETE"]
)
@require_admin
def clear_routine_proficiency(user_id, routine_id, member_id):
    """Remove the record entirely, which is different from setting it to
    'learning' — it means nobody has assessed this pair."""
    with get_db() as (conn, cur):
        routine = _require_routine(cur, routine_id)

        deleted = delete_proficiency(cur, routine_id, member_id)
        if deleted is None:
            raise APIError(
                "NOT_FOUND",
                f"No proficiency record for member {member_id} on that routine",
                404,
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="routine_proficiency",
            entity_id=routine_id,
            summary=(
                f"Cleared member {member_id}'s proficiency on '{routine['name']}'"
            ),
            changes={"user_id": member_id},
        )

        return success_response({"deleted": deleted}, 200)
