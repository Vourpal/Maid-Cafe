"""Task assignment.

The tasks table, FKs and query layer already existed but were never exposed;
this wires them up. Admins own task lifecycle, and the person a task is assigned
to may tick it off.
"""

from flask import Blueprint, request
from psycopg2 import errors as pg_errors
from pydantic import ValidationError

from middleware import require_admin, require_auth
from models import Task, TaskCreate, TaskUpdate
from queries.audit_queries import diff_changes, record_audit
from queries.task_queries import (
    count_tasks,
    create_task,
    delete_task,
    get_task_by_id,
    get_task_stats,
    get_tasks,
    update_task,
)
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

task_bp = Blueprint("tasks", __name__)

_SORT_OPTIONS = {"due_date", "created_at", "title", "assignee", "status"}


def _task_filters_from_request():
    return {
        "assigned_to": int_arg("assigned_to"),
        "event_id": int_arg("event_id"),
        "completed": bool_arg("completed"),
        "search": str_arg("search"),
        "overdue_only": bool_arg("overdue", default=False),
        "unassigned": bool_arg("unassigned", default=False),
    }


@task_bp.route("/tasks", methods=["GET"])
@require_admin
def list_tasks(user_id):
    with get_db() as (conn, cur):
        page, quantity, offset = pagination_args(default_quantity=50, max_quantity=200)
        filters = _task_filters_from_request()
        sort = str_arg("sort", default="status", allowed=_SORT_OPTIONS)

        tasks = get_tasks(cur, limit=quantity, offset=offset, sort=sort, **filters)
        total = count_tasks(cur, **filters)

        return success_response(
            {
                "page": page,
                "quantity": quantity,
                "count": len(tasks),
                "total": total,
                "stats": get_task_stats(cur),
                "tasks": tasks,
            },
            200,
        )


@task_bp.route("/tasks", methods=["POST"])
@require_admin
def create_task_route(user_id):
    with get_db() as (conn, cur):
        try:
            payload = TaskCreate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        title = payload.title.strip()
        if not title:
            raise APIError("VALIDATION_ERROR", "Title is required", 422)

        task = Task(
            title=title,
            description=payload.description,
            assigned_to=payload.assigned_to,
            created_by=user_id,  # taken from the JWT, never the request body
            due_date=payload.due_date,
            event_id=payload.event_id,
            completed=payload.completed,
        )

        try:
            task_id = create_task(cur, task)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "The assignee or event referenced by this task does not exist",
                422,
            )

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="create",
            entity_type="task",
            entity_id=task_id,
            summary=f"Created task '{title}'",
            changes={
                "assigned_to": payload.assigned_to,
                "event_id": payload.event_id,
                "due_date": payload.due_date.isoformat() if payload.due_date else None,
            },
        )

        return success_response(get_task_by_id(cur, task_id), 201)


@task_bp.route("/tasks/me", methods=["GET"])
@require_auth
def my_tasks(user_id):
    """Tasks assigned to the caller. Open ones first, soonest due first."""
    with get_db() as (conn, cur):
        completed = bool_arg("completed")
        tasks = get_tasks(
            cur,
            limit=200,
            offset=0,
            assigned_to=user_id,
            completed=completed,
            sort="status",
        )
        return success_response(tasks, 200)


@task_bp.route("/tasks/<int:task_id>", methods=["GET"])
@require_auth
def get_task_route(user_id, task_id):
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        task = get_task_by_id(cur, task_id)
        if task is None:
            raise APIError("NOT_FOUND", f"Task {task_id} does not exist", 404)

        if not current_user.admin and task["assigned_to"] != user_id:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        return success_response(task, 200)


@task_bp.route("/tasks/<int:task_id>", methods=["PATCH"])
@require_auth
def update_task_route(user_id, task_id):
    """Admins may change anything. The assignee may only toggle `completed`,
    so people can tick off their own work without being able to reassign it.
    """
    with get_db() as (conn, cur):
        current_user = get_me(cur, user_id)
        if current_user is None:
            raise APIError("UNAUTHORIZED", "Invalid token", 401)

        before = get_task_by_id(cur, task_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Task {task_id} does not exist", 404)

        is_assignee = before["assigned_to"] == user_id
        if not current_user.admin and not is_assignee:
            raise APIError("FORBIDDEN", "Not authorized", 403)

        try:
            payload = TaskUpdate(**(request.get_json() or {}))
        except ValidationError as e:
            raise APIError("VALIDATION_ERROR", str(e), 422)

        requested = payload.model_dump(exclude_unset=True)
        if not requested:
            raise APIError("BAD_REQUEST", "No fields to update", 400)

        if not current_user.admin and set(requested) - {"completed"}:
            raise APIError(
                "FORBIDDEN",
                "You can only mark your own tasks complete or incomplete.",
                403,
            )

        if "title" in requested and not (requested["title"] or "").strip():
            raise APIError("VALIDATION_ERROR", "Title cannot be empty", 422)

        try:
            updated = update_task(cur, task_id, payload)
        except pg_errors.ForeignKeyViolation:
            raise APIError(
                "INVALID_REFERENCE",
                "The assignee or event referenced by this task does not exist",
                422,
            )

        if updated is None:
            raise APIError("NOT_FOUND", f"Task {task_id} does not exist", 404)

        after = get_task_by_id(cur, task_id)
        changes = diff_changes(
            {k: before.get(k) for k in requested},
            {k: after.get(k) for k in requested},
        )

        if changes:
            record_audit(
                cur,
                actor_id=user_id,
                actor=current_user,
                action="update",
                entity_type="task",
                entity_id=task_id,
                summary=f"Updated task '{before['title']}' ({', '.join(changes)})",
                changes=changes,
            )

        return success_response(after, 200)


@task_bp.route("/tasks/<int:task_id>", methods=["DELETE"])
@require_admin
def delete_task_route(user_id, task_id):
    with get_db() as (conn, cur):
        before = get_task_by_id(cur, task_id)
        if before is None:
            raise APIError("NOT_FOUND", f"Task {task_id} does not exist", 404)

        deleted = delete_task(cur, task_id)
        if deleted is None:
            raise APIError("NOT_FOUND", f"Task {task_id} does not exist", 404)

        record_audit(
            cur,
            actor_id=user_id,
            actor=get_me(cur, user_id),
            action="delete",
            entity_type="task",
            entity_id=task_id,
            summary=f"Deleted task '{before['title']}'",
        )

        return success_response({"deleted": deleted}, 200)
