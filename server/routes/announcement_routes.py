"""Announcements shown on the member home page.

Admins get full CRUD; any logged-in member can read the feed. Members only ever
see published, unexpired entries — the include_unpublished / include_expired
switches are ignored unless the caller is an admin, so a draft cannot leak by
someone guessing the query parameter.
"""

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import AnnouncementCreate, AnnouncementUpdate
from queries.announcement_queries import (
    count_announcements,
    create_announcement,
    delete_announcement,
    get_announcement_by_id,
    get_announcement_stats,
    get_announcements,
    update_announcement,
)
from queries.audit_queries import actor_label, diff_changes, record_audit
from queries.event_queries import get_event_by_id
from queries.user_queries import get_me
from utils import (
    APIError,
    bool_arg,
    get_db,
    int_arg,
    pagination_args,
    str_arg,
    success_response,
)

announcement_bp = Blueprint("announcements", __name__)

# Mirrors the CHECK constraint on announcements.priority.
_PRIORITIES = {"normal", "important", "urgent"}
_SORT_OPTIONS = {"feed", "created_at", "title", "priority"}


def _validate_fields(requested: dict):
    priority = requested.get("priority")
    if priority is not None and priority not in _PRIORITIES:
        raise APIError(
            "VALIDATION_ERROR",
            f"Priority must be one of: {', '.join(sorted(_PRIORITIES))}",
            422,
        )

    if "title" in requested and not (requested["title"] or "").strip():
        raise APIError("VALIDATION_ERROR", "Title cannot be empty", 422)

    if "body" in requested and not (requested["body"] or "").strip():
        raise APIError("VALIDATION_ERROR", "Body cannot be empty", 422)


@announcement_bp.route("/announcements", methods=["GET"])
@require_auth
def list_announcements(user_id):
    """The feed. Pinned first, then newest; expired entries drop off by
    themselves because the filter is part of the query.
    """
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        if current_user is None:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        page, quantity, offset = pagination_args(default_quantity=25, max_quantity=100)

        # Only admins may look past the published/unexpired window.
        is_admin = bool(current_user.admin)
        filters = {
            "include_unpublished": is_admin and bool_arg("include_unpublished", False),
            "include_expired": is_admin and bool_arg("include_expired", False),
            "search": str_arg("search"),
            "event_id": int_arg("event_id"),
            "priority": str_arg("priority", allowed=_PRIORITIES),
        }
        sort = str_arg("sort", default="feed", allowed=_SORT_OPTIONS)

        entries = get_announcements(
            cur, limit=quantity, offset=offset, sort=sort, **filters
        )
        total = count_announcements(cur, **filters)

        payload = {
            "page": page,
            "quantity": quantity,
            "count": len(entries),
            "total": total,
            "announcements": entries,
        }

        # Stats are only meaningful to somebody who can see drafts.
        if is_admin:
            payload["stats"] = get_announcement_stats(cur)

        return success_response(payload, 200)


@announcement_bp.route("/announcements", methods=["POST"])
@require_admin
def create_announcement_route(user_id):
    with get_db() as (conn, cur):
        try:
            payload = AnnouncementCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        payload.title = payload.title.strip()
        payload.body = payload.body.strip()
        _validate_fields({"title": payload.title, "body": payload.body, "priority": payload.priority})

        if payload.event_id is not None:
            if get_event_by_id(cur, payload.event_id) is None:
                raise APIError(
                    "EVENT_NOT_FOUND",
                    f"Event {payload.event_id} does not exist",
                    404,
                )

        author = get_me(cur, user_id)

        try:
            announcement_id = create_announcement(
                cur, payload, created_by=user_id, author_label=actor_label(author)
            )
        except pg_errors.ForeignKeyViolation:
            raise APIError("INVALID_REFERENCE", "That event does not exist", 422)

        record_audit(
            cur,
            actor_id=user_id,
            actor=author,
            action="create",
            entity_type="announcement",
            entity_id=announcement_id,
            summary=f"Posted announcement '{payload.title}'",
            changes={
                "priority": payload.priority,
                "pinned": payload.pinned,
                "published": payload.published,
                "expires_at": (
                    payload.expires_at.isoformat() if payload.expires_at else None
                ),
            },
        )

        return success_response(get_announcement_by_id(cur, announcement_id), 201)


@announcement_bp.route("/announcements/<int:announcement_id>", methods=["GET"])
@require_auth
def get_announcement_route(user_id, announcement_id):
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        if current_user is None:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        entry = get_announcement_by_id(cur, announcement_id)
        if entry is None:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        # A draft is not readable by members, and neither is a 404 distinguishable
        # from a hidden one — same response either way.
        if not current_user.admin and not entry["published"]:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        return success_response(entry, 200)


@announcement_bp.route("/announcements/<int:announcement_id>", methods=["PATCH"])
@require_admin
def update_announcement_route(user_id, announcement_id):
    with get_db() as (conn, cur):
        try:
            payload = AnnouncementUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        _validate_fields(requested)

        before = get_announcement_by_id(cur, announcement_id)
        if before is None:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        if requested.get("event_id") is not None:
            if get_event_by_id(cur, requested["event_id"]) is None:
                raise APIError(
                    "EVENT_NOT_FOUND",
                    f"Event {requested['event_id']} does not exist",
                    404,
                )

        try:
            updated = update_announcement(cur, announcement_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError("INVALID_REFERENCE", "That event does not exist", 422)

        if updated is None:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        after = get_announcement_by_id(cur, announcement_id)
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
                entity_type="announcement",
                entity_id=announcement_id,
                summary=(
                    f"Updated announcement '{before['title']}' "
                    f"({', '.join(changes)})"
                ),
                changes=changes,
            )

        return success_response(after, 200)


@announcement_bp.route("/announcements/<int:announcement_id>", methods=["DELETE"])
@require_admin
def delete_announcement_route(user_id, announcement_id):
    with get_db() as (conn, cur):
        before = get_announcement_by_id(cur, announcement_id)
        if before is None:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        deleted = delete_announcement(cur, announcement_id)
        if deleted is None:
            raise APIError(
                "NOT_FOUND", f"Announcement {announcement_id} does not exist", 404
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="announcement",
            entity_id=announcement_id,
            summary=f"Deleted announcement '{before['title']}'",
        )

        return success_response({"deleted": deleted}, 200)
