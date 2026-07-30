from flask import Blueprint, request
from pydantic import ValidationError

from psycopg2 import errors as pg_errors

from middleware import require_admin, require_auth
from queries.audit_queries import diff_changes, record_audit
from queries.practice_queries import (
    add_practice_attendance,
    add_routine_to_practice,
    create_routine,
    create_routine_standalone,
    delete_practice_sessions,
    delete_routine,
    get_all_practice_sessions,
    get_all_routines,
    get_practice_attendance,
    get_practice_session_by_id,
    get_routine_by_id,
    get_routines_by_practice,
    get_session_attendance_summary,
    post_practice_sessions,
    remove_routine_from_practice,
    update_practice_attendance,
    update_practice_session,
    update_routine,
    update_routines_bulk,
)
from queries.user_queries import get_me
from models import PracticeSession, RoutineCreate, RoutineUpdate
from utils import APIError, get_db, int_arg, success_response

practice_bp = Blueprint("practice", __name__)

# Matches the CHECK constraint on routines.difficulty. Validated here so a bad
# value comes back as a readable 422 instead of a CheckViolation surfacing as a
# 500 from the global handler.
_DIFFICULTIES = {"easy", "medium", "hard"}

# Fields on the routine detail that must be positive when supplied.
_POSITIVE_ROUTINE_FIELDS = ("duration_seconds", "bpm", "member_count")


def _validate_routine_detail(requested: dict):
    difficulty = requested.get("difficulty")
    if difficulty is not None and difficulty not in _DIFFICULTIES:
        raise APIError(
            "VALIDATION_ERROR",
            f"Difficulty must be one of: {', '.join(sorted(_DIFFICULTIES))}",
            422,
        )

    for field in _POSITIVE_ROUTINE_FIELDS:
        value = requested.get(field)
        if value is not None and value <= 0:
            raise APIError(
                "VALIDATION_ERROR",
                f"{field.replace('_', ' ').capitalize()} must be greater than zero",
                422,
            )


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

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="practice_session",
            entity_id=session_id,
            summary=f"Created practice session '{posted_session.title}'",
        )

        return success_response({"id": session_id}, 201)


@practice_bp.route("/practice-sessions/<int:practice_id>", methods=["GET"])
@require_auth
def get_practice(user_id, practice_id):
    with get_db() as (conn, cur):
        session = get_practice_session_by_id(cur, practice_id)
        if session is None:
            raise APIError(
                "NOT_FOUND", f"Practice session {practice_id} not found", 404
            )
        return success_response(session.model_dump(), 200)


@practice_bp.route("/practice-sessions/<int:practice_id>", methods=["DELETE"])
@require_admin
def delete_practice(user_id, practice_id):
    with get_db() as (conn, cur):
        session = get_practice_session_by_id(cur, practice_id)

        deleted_id = delete_practice_sessions(cur, practice_id)
        if deleted_id is None:
            raise APIError(
                "NOT_FOUND", f"Practice session {practice_id} not found", 404
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="practice_session",
            entity_id=practice_id,
            summary=(
                f"Deleted practice session '{session.title}'"
                if session
                else f"Deleted practice session {practice_id}"
            ),
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

            if attendees:
                record_audit(
                    cur,
                    actor_id=user_id,
                    actor=get_me(cur, user_id),
                    action="create",
                    entity_type="practice_attendance",
                    entity_id=practice_id,
                    summary=(
                        f"Recorded {len(attendees)} attendee(s) for practice "
                        f"session {practice_id}"
                    ),
                    changes={"user_ids": attendees},
                )

            # 🔥 IMPORTANT: return FULL updated attendance list
            updated_attendance = get_practice_attendance(cur, practice_id)

            return success_response(updated_attendance, 201)

        except Exception as e:
            print("Error:", e)
            raise APIError("DB_ERROR", "Failed to record attendance", 500)

@practice_bp.route("/practice-sessions/<int:practice_id>/attendance", methods=["GET"])
@require_auth
def get_attendance(user_id, practice_id):
    with get_db() as (conn, cur):
        data = get_practice_attendance(cur, practice_id)
        return success_response(data, 200)


@practice_bp.route("/routines", methods=["GET"])
@require_auth
def get_all_routines_route(user_id):
    """Routine catalog. Each row carries usage_count/last_used so admins can see
    what a routine is attached to before deleting it."""
    with get_db() as (conn, cur):
        data = get_all_routines(cur)
        return success_response(data, 200)


@practice_bp.route("/routines", methods=["POST"])
@require_admin
def create_routine_route(user_id):
    """Add a routine to the catalog directly.

    Previously routines could only come into existence as a side effect of
    attaching one to a practice session.
    """
    with get_db() as (conn, cur):
        try:
            payload = RoutineCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        name = payload.name.strip()
        if not name:
            raise APIError("VALIDATION_ERROR", "Name is required", 422)
        payload.name = name

        _validate_routine_detail(payload.model_dump(exclude_unset=True))

        routine_id = create_routine_standalone(cur, payload)
        if routine_id is None:
            raise APIError(
                "DUPLICATE_ROUTINE", f"A routine named '{name}' already exists", 409
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="routine",
            entity_id=routine_id,
            summary=f"Created routine '{name}'",
        )

        return success_response(get_routine_by_id(cur, routine_id), 201)


@practice_bp.route("/routines/<int:routine_id>", methods=["DELETE"])
@require_admin
def delete_routine_route(user_id, routine_id):
    """Remove a routine from the catalog entirely.

    This also detaches it from every practice session (the join table cascades),
    so it requires ?force=true when the routine is still in use.
    """
    with get_db() as (conn, cur):
        routine = get_routine_by_id(cur, routine_id)
        if routine is None:
            raise APIError("NOT_FOUND", "Routine not found", 404)

        force = request.args.get("force", "false").lower() == "true"
        if routine["usage_count"] > 0 and not force:
            raise APIError(
                "ROUTINE_IN_USE",
                f"'{routine['name']}' is used by {routine['usage_count']} "
                "practice session(s). Delete anyway with force=true.",
                409,
            )

        deleted = delete_routine(cur, routine_id)
        if deleted is None:
            raise APIError("NOT_FOUND", "Routine not found", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="routine",
            entity_id=routine_id,
            summary=(
                f"Deleted routine '{routine['name']}' "
                f"(was linked to {routine['usage_count']} session(s))"
            ),
        )

        return success_response({"deleted": deleted}, 200)


@practice_bp.route("/practice-sessions/attendance-summary", methods=["GET"])
@require_admin
def practice_session_summary(user_id):
    """Turnout per session, newest first."""
    with get_db() as (conn, cur):
        limit = int_arg("limit", default=10, minimum=1, maximum=100)
        return success_response(get_session_attendance_summary(cur, limit), 200)


@practice_bp.route("/practice-sessions/<int:practice_id>", methods=["PUT"])
@require_admin
def edit_practice(user_id, practice_id):
    data = request.get_json()

    try:
        updated_session = PracticeSession(**data)
    except ValidationError as e:
        raise APIError("VALIDATION_ERROR", str(e), 422)

    with get_db() as (conn, cur):
        before = get_practice_session_by_id(cur, practice_id)

        updated_id = update_practice_session(
            cur,
            practice_id,
            updated_session,
        )

        if not updated_id:
            raise APIError(
                "NOT_FOUND",
                f"Practice session {practice_id} not found",
                404,
            )

        changes = {}
        if before is not None:
            changes = diff_changes(
                {
                    "title": before.title,
                    "location": before.location,
                    "notes": before.notes,
                    "date": before.date.isoformat(),
                },
                {
                    "title": updated_session.title,
                    "location": updated_session.location,
                    "notes": updated_session.notes,
                    "date": updated_session.date.isoformat(),
                },
            )

        if changes:
            record_audit(
                cur,
                actor_id=user_id,
                actor=get_me(cur, user_id),
                action="update",
                entity_type="practice_session",
                entity_id=practice_id,
                summary=(
                    f"Updated practice session '{updated_session.title}' "
                    f"({', '.join(changes)})"
                ),
                changes=changes,
            )

        return success_response({"id": updated_id}, 200)


@practice_bp.route("/practice-sessions/<int:practice_id>/attendance", methods=["PATCH"])
@require_admin
def edit_attendance(user_id, practice_id):
    data = request.get_json()
    updates = data.get("updates", [])

    if not isinstance(updates, list):
        raise APIError("VALIDATION_ERROR", "Invalid updates format", 422)

    with get_db() as (conn, cur):
        updated = update_practice_attendance(cur, updates)

        if updated:
            record_audit(
                cur,
                actor_id=user_id,
                actor=get_me(cur, user_id),
                action="update",
                entity_type="practice_attendance",
                entity_id=practice_id,
                summary=(
                    f"Edited {updated} attendance record(s) for practice "
                    f"session {practice_id}"
                ),
            )

        return success_response({"updated": updated}, 200)


@practice_bp.route("/practice-sessions/<int:practice_id>/routines", methods=["POST"])
@require_admin
def add_routine(user_id, practice_id):
    data = request.get_json()

    routine_id = data.get("routine_id")

    with get_db() as (conn, cur):
        # EXISTING ROUTINE
        if routine_id:
            add_routine_to_practice(cur, practice_id, routine_id)

            return success_response(
                {"id": routine_id},
                201,
            )

        # NEW ROUTINE
        name = data.get("name")
        notes = data.get("notes")

        if not name:
            raise APIError(
                "VALIDATION_ERROR",
                "Name is required",
                422,
            )

        new_routine_id = create_routine(cur, name, notes)

        add_routine_to_practice(
            cur,
            practice_id,
            new_routine_id,
        )

        return success_response(
            {"id": new_routine_id},
            201,
        )


@practice_bp.route("/practice-sessions/<int:practice_id>/routines", methods=["GET"])
@require_auth
def get_routines(user_id, practice_id):
    with get_db() as (conn, cur):
        data = get_routines_by_practice(cur, practice_id)
        return success_response(data, 200)


@practice_bp.route("/routines/<int:routine_id>", methods=["PATCH"])
@require_admin
def edit_routine(user_id, routine_id):
    try:
        payload = RoutineUpdate(**(request.get_json() or {}))
    except ValidationError as e:
        raise APIError("VALIDATION_ERROR", str(e), 422)

    requested = payload.model_dump(exclude_unset=True)
    if not requested:
        raise APIError("BAD_REQUEST", "No fields to update", 400)

    if "name" in requested and not (requested["name"] or "").strip():
        raise APIError("VALIDATION_ERROR", "Name cannot be empty", 422)

    _validate_routine_detail(requested)

    with get_db() as (conn, cur):
        before = get_routine_by_id(cur, routine_id)
        if before is None:
            raise APIError("NOT_FOUND", "Routine not found", 404)

        try:
            updated = update_routine(cur, routine_id, payload)
        except pg_errors.UniqueViolation:
            raise APIError(
                "DUPLICATE_ROUTINE", "Another routine already has that name", 409
            )

        if not updated:
            raise APIError("NOT_FOUND", "Routine not found", 404)

        after = get_routine_by_id(cur, routine_id)

        # Diff only the fields the caller actually sent, so a PATCH that touches
        # the BPM does not log the whole record.
        changes = diff_changes(
            {key: before.get(key) for key in requested},
            {key: after.get(key) for key in requested},
        )
        if changes:
            record_audit(
                cur,
                actor_id=user_id,
                actor=get_me(cur, user_id),
                action="update",
                entity_type="routine",
                entity_id=routine_id,
                summary=f"Updated routine '{before['name']}' ({', '.join(changes)})",
                changes=changes,
            )

        return success_response(after, 200)


@practice_bp.route(
    "/practice-sessions/<int:practice_id>/routines/<int:routine_id>",
    methods=["DELETE"],
)
@require_admin
def delete_routine_from_practice(user_id, practice_id, routine_id):
    with get_db() as (conn, cur):
        deleted = remove_routine_from_practice(cur, practice_id, routine_id)

        if not deleted:
            raise APIError("NOT_FOUND", "Routine not linked to practice", 404)

        return success_response({"deleted": routine_id}, 200)


@practice_bp.route("/routines/bulk", methods=["PATCH"])
@require_admin
def edit_routines_bulk(user_id):
    data = request.get_json()

    routines = data.get("routines", [])

    if not isinstance(routines, list):
        raise APIError("VALIDATION_ERROR", "Routines must be a list", 422)

    with get_db() as (conn, cur):
        updated = update_routines_bulk(cur, routines)

        return success_response(updated, 200)
